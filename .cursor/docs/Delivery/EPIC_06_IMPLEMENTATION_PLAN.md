# EPIC 06 - Distribution Engine Implementation Plan

**Epic:** Distribution Engine (Fair & Atomic)  
**Created:** Jan 4, 2026  
**Target:** MVP Core - Lead Distribution  
**Dependencies:** EPIC 01 ✅, EPIC 02 ✅, EPIC 03 ✅, EPIC 04 ✅, EPIC 05 ✅, EPIC 07 ✅, EPIC 10 ✅  
**Status:** Planning

---

## Pre-Implementation Checklist

### ✅ Deferred Items Review
- [x] Checked `DEFERRED_ITEMS_SUMMARY.md` - No deferred items assigned to EPIC 06
- [x] Checked epic specification - No deferred items from other epics

### ✅ Dependencies Verified
| Epic | Dependency | Status | Component |
|------|------------|--------|-----------|
| 01 | Auth/RBAC | ✅ | Admin endpoint protection |
| 02 | Lead Intake | ✅ | Lead confirmation flow |
| 03 | Lead Approval | ✅ | Only approved leads distributed |
| 04 | Competition Levels | ✅ | `competition_levels`, `competition_level_subscriptions` |
| 05 | Eligibility | ✅ | `getEligibleSubscriptionsByLevel()` |
| 07 | Billing | ✅ | `chargeForLeadAssignment()`, `checkAndUpdateSubscriptionStatus()` |
| 10 | Email | ✅ | Provider notifications |

### ✅ Existing Infrastructure Verified
- `provider_subscriptions.last_received_at` - ✅ Exists
- `lead_assignments` table - ✅ Exists with `UNIQUE(lead_id, provider_id)`
- `chargeForLeadAssignment()` - ✅ Available in EPIC 07
- `getEligibleSubscriptionsByLevel()` - ✅ Available in EPIC 05
- BullMQ worker - ✅ Running in `apps/worker`

---

## Implementation Phases

### Phase 1: Database Schema Updates
**Effort:** 0.5 hours  
**Files:**
- `packages/database/schema.sql`
- `packages/database/migrate.ts`

**Tasks:**
1. Add `niches.next_start_level_order_position INT NOT NULL DEFAULT 1`
2. Add fairness index on `competition_level_subscriptions` (if needed)
3. Add `leads.distributed_at TIMESTAMPTZ` for outcome tracking
4. Add `leads.distribution_attempts INTEGER DEFAULT 0`
5. Run migration

**Schema Changes:**
```sql
-- Niche rotation pointer for across-level fairness
ALTER TABLE niches
  ADD COLUMN IF NOT EXISTS next_start_level_order_position INT NOT NULL DEFAULT 1;

-- Lead distribution outcome tracking
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS distributed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS distribution_attempts INT NOT NULL DEFAULT 0;
```

**Acceptance Criteria:**
- [ ] Migration runs successfully
- [ ] Schema matches EPIC 06 spec
- [ ] Existing data unaffected

---

### Phase 2: TypeScript Types & Validation
**Effort:** 0.5 hours  
**Files:**
- `apps/web/lib/types/distribution.ts` (new)
- `apps/web/lib/validations/distribution.ts` (new)

**Tasks:**
1. Define `DistributionJob` payload type
2. Define `DistributionResult` type
3. Define `AssignmentOutcome` type
4. Create Zod validation schemas for admin APIs
5. Define `DistributionStatus` enum

**Types to Create:**
```typescript
interface DistributionJob {
  leadId: string
  triggeredBy: { actorId: string; actorRole: 'admin' | 'system' }
  requestedAt: string // ISO 8601
}

interface DistributionResult {
  leadId: string
  startLevelOrderPosition: number
  traversalOrder: string[]
  assignmentsCreated: number
  assignmentDetails: AssignmentDetail[]
  skippedProviders: SkippedProvider[]
  durationMs: number
  status: 'success' | 'partial' | 'no_eligible' | 'failed'
}

interface AssignmentDetail {
  assignmentId: string
  providerId: string
  subscriptionId: string
  competitionLevelId: string
  priceCharged: number
}

interface SkippedProvider {
  providerId: string
  reason: 'insufficient_balance' | 'eligibility_error' | 'duplicate'
}
```

**Acceptance Criteria:**
- [ ] All types defined
- [ ] Zod schemas validate correctly
- [ ] Types match EPIC 06 spec

---

### Phase 3: Starting Level Rotation Service
**Effort:** 1 hour  
**Files:**
- `apps/web/lib/services/distribution/rotation.ts` (new)

**Tasks:**
1. Implement `getAndAdvanceStartLevel(nicheId)` with transaction + row lock
2. Handle wraparound when pointer exceeds max level
3. Implement concurrent-safe rotation

**Function:**
```typescript
/**
 * Get the starting level for distribution and advance pointer atomically
 * 
 * Uses SELECT FOR UPDATE to prevent race conditions
 * Wraps around to 1 when exceeding max order_position
 */
export async function getAndAdvanceStartLevel(nicheId: string): Promise<{
  startOrderPosition: number
  competitionLevelIds: string[] // ordered traversal
}>
```

**Acceptance Criteria:**
- [ ] Atomic read-and-update with row lock
- [ ] Wraparound logic tested
- [ ] Concurrent calls produce sequential rotation

---

### Phase 4: Level Traversal Service
**Effort:** 0.5 hours  
**Files:**
- `apps/web/lib/services/distribution/traversal.ts` (new)

**Tasks:**
1. Implement `getTraversalOrder(nicheId, startOrderPosition)` 
2. Return ordered list of active competition level IDs
3. Circular traversal (e.g., start at 2 → 2, 3, 1)

**Function:**
```typescript
/**
 * Get the traversal order of competition levels starting from a position
 * 
 * Returns level IDs in circular order starting from startOrderPosition
 * Only includes active levels with is_active = true
 */
export async function getTraversalOrder(
  nicheId: string,
  startOrderPosition: number
): Promise<{ levelId: string; orderPosition: number; maxRecipients: number; pricePerLeadCents: number }[]>
```

**Acceptance Criteria:**
- [ ] Circular traversal correct (3 levels; start 2 → 2, 3, 1)
- [ ] Only active levels included
- [ ] Returns price and max_recipients for each level

---

### Phase 5: Within-Level Fairness Selection
**Effort:** 1 hour  
**Files:**
- `apps/web/lib/services/distribution/fairness.ts` (new)

**Tasks:**
1. Implement LRU selection by `last_received_at ASC NULLS FIRST`
2. Deterministic tie-breaker by `provider_id ASC`
3. Limit to `max_recipients` per level
4. Exclude already-assigned providers (cross-level dedupe)

**Function:**
```typescript
/**
 * Select providers within a level using LRU fairness
 * 
 * Orders by last_received_at ASC (NULLS FIRST) with provider_id tie-breaker
 * Excludes providers already assigned to this lead
 */
export async function selectProvidersForLevel(
  competitionLevelId: string,
  maxRecipients: number,
  excludeProviderIds: string[],
  eligibleSubscriptionIds: string[]
): Promise<{ providerId: string; subscriptionId: string }[]>
```

**Acceptance Criteria:**
- [ ] NULL `last_received_at` gets priority
- [ ] Deterministic ordering with tie-breaker
- [ ] Respects max_recipients limit
- [ ] Excludes already-assigned providers

---

### Phase 6: Atomic Assignment + Billing Service
**Effort:** 1.5 hours  
**Files:**
- `apps/web/lib/services/distribution/assignment.ts` (new)

**Tasks:**
1. Integrate with EPIC 07 `chargeForLeadAssignment()`
2. Create `lead_assignments` row in same transaction
3. Update `last_received_at` for chosen subscription
4. Handle insufficient balance (skip provider, continue)
5. Handle duplicate constraint (log warning, continue)
6. Implement retry wrapper with jittered backoff

**Function:**
```typescript
/**
 * Create assignment and charge provider atomically
 * 
 * Uses chargeForLeadAssignment() from EPIC 07 within transaction
 * Updates last_received_at for fairness
 * Throws InsufficientBalanceError if balance too low
 */
export async function createAssignmentWithCharge(
  leadId: string,
  providerId: string,
  subscriptionId: string,
  competitionLevelId: string,
  priceCents: number
): Promise<{ assignmentId: string; newBalance: number }>
```

**Acceptance Criteria:**
- [ ] Atomic: assignment + charge in same transaction
- [ ] Balance check with row lock
- [ ] `last_received_at` updated
- [ ] Insufficient balance throws InsufficientBalanceError
- [ ] Duplicate constraint handled gracefully

---

### Phase 7: Distribution Engine Core
**Effort:** 2 hours  
**Files:**
- `apps/web/lib/services/distribution/engine.ts` (new)

**Tasks:**
1. Orchestrate full distribution flow
2. Get starting level and traversal order (Phase 3-4)
3. For each level: get eligible subs (EPIC 05), select providers (Phase 5)
4. For each provider: attempt assignment (Phase 6)
5. Track skip reasons and metrics
6. Record distribution outcome
7. Call subscription status check (EPIC 07)

**Main Function:**
```typescript
/**
 * Distribute a lead to eligible providers
 * 
 * Main entry point for distribution. Orchestrates:
 * - Starting level rotation
 * - Level traversal
 * - Eligibility filtering (EPIC 05)
 * - Fairness selection
 * - Atomic assignment + billing
 * - Subscription status updates
 */
export async function distributeLead(
  leadId: string,
  triggeredBy: { actorId: string; actorRole: 'admin' | 'system' }
): Promise<DistributionResult>
```

**Acceptance Criteria:**
- [ ] Full distribution flow works
- [ ] Integrates with EPIC 05 eligibility
- [ ] Integrates with EPIC 07 billing
- [ ] Skip reasons tracked
- [ ] Subscription status updated after low balance
- [ ] Distribution result returned with all details

---

### Phase 8: BullMQ Job Processor
**Effort:** 1 hour  
**Files:**
- `apps/worker/src/jobs/distribute-lead.ts` (new)
- `apps/worker/src/processors/distribution.ts` (new)
- `apps/worker/src/index.ts` (update)

**Tasks:**
1. Create `distribute_lead` queue
2. Implement job processor with retry strategy
3. Configure exponential backoff (5s, 15s, 45s, 2m, 5m)
4. Configure dead-letter queue
5. Emit metrics for success/failure/duration
6. Add to worker startup

**Job Processor:**
```typescript
/**
 * BullMQ processor for distribute_lead queue
 * 
 * Retry: 5 attempts with exponential backoff
 * DLQ: Permanently failed jobs moved to dead-letter queue
 */
export const distributionProcessor: Processor<DistributionJob>
```

**Acceptance Criteria:**
- [ ] Queue created with correct configuration
- [ ] Processor handles jobs
- [ ] Retries with backoff
- [ ] DLQ for permanent failures
- [ ] Metrics emitted

---

### Phase 9: Provider Email Notifications
**Effort:** 0.5 hours  
**Files:**
- `packages/email/templates/defaults.ts` (update)
- `packages/email/types.ts` (update)

**Tasks:**
1. Create `lead_assigned` email template
2. Include: lead summary, competition level, amount charged
3. Queue email after successful assignment

**Template:**
```
Subject: New Lead Assigned - {{niche_name}}

Hi {{provider_name}},

You have been assigned a new lead!

Competition Level: {{level_name}}
Amount Charged: ${{price_charged}}

View the lead details in your dashboard.

Best,
The Team
```

**Acceptance Criteria:**
- [ ] Template created
- [ ] Variables documented
- [ ] Email queued after assignment

---

### Phase 10: Audit Actions
**Effort:** 0.5 hours  
**Files:**
- `apps/web/lib/services/audit-logger.ts` (update)

**Tasks:**
1. Add `distribution.started` audit action
2. Add `distribution.completed` audit action
3. Add `distribution.failed` audit action
4. Add `distribution.skipped_provider` audit action
5. Add `assignment.created` audit action

**Audit Actions:**
```typescript
DISTRIBUTION_STARTED = 'distribution.started',
DISTRIBUTION_COMPLETED = 'distribution.completed',
DISTRIBUTION_FAILED = 'distribution.failed',
DISTRIBUTION_SKIPPED_PROVIDER = 'distribution.skipped_provider',
ASSIGNMENT_CREATED = 'assignment.created',
```

**Acceptance Criteria:**
- [ ] All audit actions defined
- [ ] Logged with appropriate metadata
- [ ] Queryable for admin visibility

---

### Phase 11: Admin API - Manual Distribution Trigger
**Effort:** 0.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/leads/[id]/distribute/route.ts` (new)

**Endpoint:** `POST /api/v1/admin/leads/:id/distribute`

**Tasks:**
1. Verify admin auth + MFA
2. Verify lead exists and is `approved`
3. Queue distribution job
4. Return 202 Accepted with job status

**Response:**
```json
{
  "lead_id": "<uuid>",
  "status": "queued",
  "message": "Distribution job queued successfully"
}
```

**Acceptance Criteria:**
- [ ] Admin auth required
- [ ] 400 if lead not approved
- [ ] 404 if lead not found
- [ ] 202 on success with job queued

---

### Phase 12: Admin API - Distribution Status
**Effort:** 0.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/leads/[id]/distribution-status/route.ts` (new)

**Endpoint:** `GET /api/v1/admin/leads/:id/distribution-status`

**Tasks:**
1. Verify admin auth
2. Get lead distribution status
3. Check job queue status (pending/processing/completed/failed)
4. Return status with assignment count

**Response:**
```json
{
  "lead_id": "<uuid>",
  "lead_status": "approved|distributed",
  "last_attempt_at": "<iso8601>",
  "last_attempt_status": "success|failed|queued|none",
  "assignments_created": 3,
  "start_level_order_position": 2,
  "notes": "Distribution completed with 3 assignments"
}
```

**Acceptance Criteria:**
- [ ] Admin auth required
- [ ] Returns correct status
- [ ] Reflects job queue state
- [ ] Shows assignment count

---

### Phase 13: Admin API - Lead Assignments List
**Effort:** 0.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/leads/[id]/assignments/route.ts` (new)

**Endpoint:** `GET /api/v1/admin/leads/:id/assignments?page=1&limit=50`

**Tasks:**
1. Verify admin auth
2. Get paginated assignments for lead
3. Include provider name, level name, price charged
4. Sort by assigned_at DESC

**Response:**
```json
{
  "lead_id": "<uuid>",
  "page": 1,
  "limit": 50,
  "total": 3,
  "items": [
    {
      "assignment_id": "<uuid>",
      "provider_id": "<uuid>",
      "provider_name": "ABC Movers",
      "subscription_id": "<uuid>",
      "competition_level_id": "<uuid>",
      "level_name": "Gold",
      "price_charged": 49.00,
      "assigned_at": "<iso8601>",
      "status": "active"
    }
  ]
}
```

**Acceptance Criteria:**
- [ ] Admin auth required
- [ ] Paginated results
- [ ] Includes provider and level names
- [ ] Sorted by assigned_at DESC

---

### Phase 14: Auto-Distribution After Approval (Optional)
**Effort:** 0.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/leads/[id]/approve/route.ts` (update)

**Tasks:**
1. After lead approval, queue distribution job
2. Add config flag to enable/disable auto-distribution
3. Log distribution job ID in approval response

**Enhancement:**
```typescript
// After approval
await queueDistributionJob(leadId, { actorId: adminId, actorRole: 'admin' })
```

**Acceptance Criteria:**
- [ ] Distribution queued after approval (if enabled)
- [ ] Config flag for auto-distribution
- [ ] Audit log includes job ID

---

### Phase 15: Integration Testing
**Effort:** 2 hours  
**Files:**
- `test-epic06.sh` (new)

**Test Scenarios:**
1. Approved lead → assignments created → billing charged
2. Multi-level distribution (3 levels)
3. Starting level rotation (wrap-around)
4. Skip due to insufficient funds and continue
5. Cross-level dedupe (same provider in multiple levels)
6. Manual admin trigger endpoint
7. Status endpoint reflects outcomes
8. Zero eligible providers → no assignments
9. All providers insufficient balance → no assignments
10. Idempotency (same lead distributed twice)

**Test Script Structure:**
```bash
#!/bin/bash
echo "=== EPIC 06 Integration Tests ==="

# Test 1: Manual distribution trigger
# Test 2: Distribution status check
# Test 3: Assignments list
# Test 4: Billing integration
# Test 5: Eligibility integration
# ...
```

**Acceptance Criteria:**
- [ ] All test scenarios pass
- [ ] Tests run in CI
- [ ] Database state verified after tests

---

### Phase 16: Documentation & Review
**Effort:** 0.5 hours  
**Files:**
- `README.md` (update)
- `.cursor/docs/DEVELOPMENT_GUIDE.md` (update)
- `.cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md` (update)
- `.cursor/docs/Delivery/EPIC_06_REVIEW.md` (new)

**Tasks:**
1. Add distribution endpoints to README
2. Update DEVELOPMENT_GUIDE with EPIC 06 status
3. Update EPIC_EXECUTION_PLAN status tracker
4. Create comprehensive review document
5. Document any deferred items

**Acceptance Criteria:**
- [ ] Documentation complete
- [ ] Status trackers updated
- [ ] Review document created

---

## Summary

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|--------------|
| 1 | Database Schema Updates | 0.5h | None |
| 2 | TypeScript Types & Validation | 0.5h | Phase 1 |
| 3 | Starting Level Rotation Service | 1h | Phase 1 |
| 4 | Level Traversal Service | 0.5h | Phase 1 |
| 5 | Within-Level Fairness Selection | 1h | Phase 4 |
| 6 | Atomic Assignment + Billing | 1.5h | Phase 5, EPIC 07 |
| 7 | Distribution Engine Core | 2h | Phases 3-6, EPIC 05 |
| 8 | BullMQ Job Processor | 1h | Phase 7 |
| 9 | Provider Email Notifications | 0.5h | Phase 6, EPIC 10 |
| 10 | Audit Actions | 0.5h | Phase 6 |
| 11 | Admin API - Distribute | 0.5h | Phase 8 |
| 12 | Admin API - Status | 0.5h | Phase 7 |
| 13 | Admin API - Assignments | 0.5h | Phase 6 |
| 14 | Auto-Distribution (Optional) | 0.5h | Phase 8, EPIC 03 |
| 15 | Integration Testing | 2h | All phases |
| 16 | Documentation & Review | 0.5h | All phases |

**Total Estimated Effort:** 13 hours (~1.5 days)

---

## Key Components Created

### Services
- `apps/web/lib/services/distribution/rotation.ts` - Starting level rotation
- `apps/web/lib/services/distribution/traversal.ts` - Level traversal order
- `apps/web/lib/services/distribution/fairness.ts` - LRU provider selection
- `apps/web/lib/services/distribution/assignment.ts` - Atomic assignment + billing
- `apps/web/lib/services/distribution/engine.ts` - Main distribution orchestrator

### Worker Jobs
- `apps/worker/src/jobs/distribute-lead.ts` - Queue configuration
- `apps/worker/src/processors/distribution.ts` - Job processor

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/admin/leads/:id/distribute` | Trigger distribution |
| GET | `/api/v1/admin/leads/:id/distribution-status` | Check status |
| GET | `/api/v1/admin/leads/:id/assignments` | List assignments |

---

## Integration Points

### EPIC 05 - Eligibility
```typescript
import { getEligibleSubscriptionsByLevel } from '@/lib/services/eligibility'

// Get eligible subscriptions grouped by level
const eligibleByLevel = await getEligibleSubscriptionsByLevel(leadId)
```

### EPIC 07 - Billing
```typescript
import { chargeForLeadAssignment } from '@/lib/services/billing'
import { checkAndUpdateSubscriptionStatus } from '@/lib/services/subscription-status'

// Atomic charge within transaction
const { newBalance } = await chargeForLeadAssignment(providerId, leadId, subscriptionId, amount)

// Update subscription status after charge
await checkAndUpdateSubscriptionStatus(providerId)
```

### EPIC 10 - Email
```typescript
import { queueEmail } from '@/lib/email'

// Notify provider of assignment
await queueEmail({
  to: provider.email,
  templateKey: 'lead_assigned',
  variables: { provider_name, level_name, price_charged }
})
```

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Race condition on level rotation | SELECT FOR UPDATE with transaction |
| Race condition on balance | Row-level locking in chargeForLeadAssignment |
| Duplicate assignments | UNIQUE constraint + in-memory tracking |
| Job failure | BullMQ retries + DLQ |
| Eligibility service failure | Fail-safe: treat as ineligible, continue |
| Billing service failure | Rollback transaction, skip provider |

---

## Metrics to Track (EPIC 12 Integration)

```typescript
// Distribution metrics
distribution_total{status="success|partial|no_eligible|failed"}
distribution_assignments_total{level_id, niche_id}
distribution_skipped_total{reason="insufficient_balance|eligibility_error|duplicate"}
distribution_duration_ms{quantile="0.5|0.9|0.99"}

// Assignment metrics
assignment_price_usd{level_id}
assignment_total{level_id, niche_id}

// Fairness metrics
fairness_new_provider_priority_total
fairness_rotation_position{niche_id}
```

---

## Definition of Done

- [ ] All schema changes match locked architecture
- [ ] Two-dimensional fairness implemented (within-level LRU + across-level rotation)
- [ ] Distribution only runs for `approved` leads
- [ ] Eligibility integration with EPIC 05 verified
- [ ] Billing integration with EPIC 07 verified (atomic charge + ledger)
- [ ] Subscription status update integration verified
- [ ] Provider notifications queued via EPIC 10
- [ ] BullMQ queue configured with retries + DLQ
- [ ] Admin endpoints functional (trigger/status/assignments)
- [ ] All tests passing (integration, race condition scenarios)
- [ ] Audit logging for all distribution events
- [ ] Documentation complete

---

## Notes

- Distribution is async via BullMQ - lead intake/approval remain fast
- Zero assignments is a valid outcome (recorded, not an error)
- Partial success allowed (some levels create assignments, others don't)
- Subscription status updates happen after balance-affecting operations
- Metrics are defined but actual Prometheus integration is EPIC 12 scope

---

**Created By:** Development Team  
**Last Updated:** Jan 4, 2026  
**Version:** 1.0

