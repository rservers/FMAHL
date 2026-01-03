# EPIC 06 — Distribution Engine (Fair & Atomic)

## Epic Goal
Distribute **approved** leads to eligible provider subscriptions **fairly and safely**, ensuring:
- **Two‑dimensional fairness** (within a competition level *and* across levels lead‑to‑lead)
- **Financial safety** (no unpaid assignments — billing + assignment are atomic)
- **Idempotency** (safe retries; no duplicate assignments)
- **Auditability** (every decision is traceable)
- **Determinism** (given same inputs, produces same outputs)

---

## Key Principles
1. **Fairness First**
   - **Within-level fairness:** least‑recently‑served (LRU) by `provider_subscriptions.last_received_at`
   - **Across-level fairness:** rotate the **starting level** per lead using `niches.next_start_level_order_position`
2. **Financial Safety**
   - Never create an assignment unless the provider is **charged in the same DB transaction**
3. **Idempotency**
   - Re-running distribution for the same lead must not create duplicates (unique constraints + checks)
4. **Determinism**
   - Stable ordering + explicit tie-breakers
5. **Fail-safe Eligibility**
   - If eligibility evaluation fails, treat the subscription as **ineligible** (log & continue)
6. **Observability**
   - Emit metrics and logs for performance and troubleshooting (Epic 12)

---

## Architecture Alignment Checklist (Locked)
This epic explicitly aligns to the locked architecture:
- ✅ `lead_assignments` schema matches the locked architecture (includes viewed/accepted/rejected/bad-lead fields)
- ✅ `niches.next_start_level_order_position` exists and drives lead‑to‑lead rotation
- ✅ `provider_subscriptions.last_received_at` exists and drives within-level fairness
- ✅ Eligibility matching is computed in the **application layer** (Epic 05) and passed as “already eligible” inputs

---

## In Scope (MVP)
- Distribution algorithm (rotation + traversal + fairness)
- Eligibility evaluation contract (app layer via Epic 05)
- Atomic assignment + billing (Epic 07 integration)
- Deduplication and idempotency guarantees
- BullMQ orchestration for async distribution (Epic 12)
- Admin endpoints for manual trigger + status + assignment visibility
- Result recording + failure handling + metrics (NEW)

---

## Out of Scope (MVP)
- Real-time push distribution (distribution is async/job-driven)
- Provider lead preview before assignment
- Provider preference ranking beyond filters/eligibility
- Assignment cancellation (refunds via Epic 09 only)
- Batch distribution of many leads in one request (single-lead distribution only)

---

## Dependencies
- **Epic 02 — Lead Intake & Confirmation** (confirmed leads become `pending_approval`)
- **Epic 03 — Admin Lead Review** (only `approved` leads may be distributed)
- **Epic 04 — Competition Levels & Subscriptions** (levels, max_recipients, subscription activation rules)
- **Epic 05 — Filters & Eligibility** (eligibility evaluation + caching contract)
- **Epic 07 — Billing & Payments** (atomic charging + ledger updates; subscription status updates)
- **Epic 10 — Email Infrastructure** (provider notifications)
- **Epic 12 — Observability & Ops** (BullMQ queues, metrics, alerts, DLQ)

---

## Stories (Recommended Grouping)

### Distribution Algorithm (Stories 1–4)

#### Story 1: Starting Level Rotation (Per Niche)
**As a** system  
**I want** each new lead in a niche to start distribution at a rotating competition level  
**So that** higher levels don’t always get first pass on every lead

**Acceptance Criteria**
- Niche stores `next_start_level_order_position` (INT, default 1)
- For each lead distribution:
  - Determine the starting level = `next_start_level_order_position`
  - After selecting the starting level, increment pointer:
    - If pointer exceeds `MAX(order_position)` for the niche, wrap to `1`
- Rotation update is **atomic** with reading pointer (avoids race conditions)
- Supports concurrent lead distributions within the same niche safely

**Tasks**
- Add `niches.next_start_level_order_position INT NOT NULL DEFAULT 1`
- Implement `getAndAdvanceStartLevel(niche_id)` using a transaction + row lock
  - `SELECT ... FOR UPDATE` on the niche row
  - read pointer, compute next pointer with wraparound, update, commit
- Unit tests:
  - wraparound logic
  - concurrent calls (simulated) produce sequential rotation

---

#### Story 2: Eligibility Set Production (App Layer Contract + Caching)
**As a** system  
**I want** a deterministic set of eligible subscriptions for a lead  
**So that** distribution is clear and testable

**Acceptance Criteria**
- Eligibility is computed via **Epic 05** function:
  - `getEligibleSubscriptionsByLevel(lead_id)` → `{ [levelId]: Subscription[] }`
- Cache key format:
  - `eligible_subs:{leadId}`
- Cache TTL: 5 minutes
- Cache invalidation triggers:
  - lead status change
  - subscription filter update
  - subscription status change
- If **no eligible subscriptions** exist at any level:
  - distribution completes with **0 assignments**
  - lead outcome is recorded (Story 9)
  - metric emitted: `distribution_zero_assignments_total++`

**Tasks**
- Consume Epic 05 helper (do not re-implement filter logic here)
- Define cache adapter + TTL
- Implement invalidation hooks (pub/sub if available; otherwise TTL + explicit invalidation calls)
- Integration test: lead → eligibility set → cache hit/miss behavior

---

#### Story 3: Within-Level Fairness Selection (LRU)
**As a** system  
**I want** providers within a level selected least‑recently‑served  
**So that** distribution is fair among subscribers

**Acceptance Criteria**
- `provider_subscriptions.last_received_at` is used for fairness ordering
- Ordering rule for a given competition level:
  1) `last_received_at` ASC with `NULLS FIRST` (first-time providers get priority)
  2) Tie-breaker: `provider_id` ASC (deterministic)
- Select up to `competition_levels.max_recipients` providers for that level
- After assignment creation, set `last_received_at = NOW()` for the chosen subscriptions (atomic with assignment creation)

**Tasks**
- Add `provider_subscriptions.last_received_at TIMESTAMPTZ`
- Add fairness index:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_last_received
    ON provider_subscriptions(competition_level_id, last_received_at ASC NULLS FIRST);
  ```
- Implement selection query with deterministic ordering
- Unit tests:
  - NULL first behavior
  - tie-breaker determinism

---

#### Story 4: Level Traversal & Cascading Allocation
**As a** system  
**I want** distribution to traverse levels starting at the rotating pointer and cascading forward  
**So that** assignments are allocated across levels fairly and predictably

**Acceptance Criteria**
- Levels are traversed by `order_position` starting from `next_start_level_order_position`
- Traversal wraps circularly until all levels are visited once
- For each level:
  - select up to `max_recipients` for that level (Story 3)
  - create assignments if eligible + financially valid (Stories 5–7)
- Partial success is allowed:
  - some levels can create assignments while others create none
- Lead-level “max recipients” is the **sum of assignments actually created** across levels (no additional hard cap in MVP unless added later)

**Tasks**
- Implement `getTraversalOrder(niche_id, start_order_position)` returning ordered level IDs
- Ensure traversal visits each active level exactly once
- Integration test:
  - 3 levels; start at 2; traversal order 2→3→1

---

### Safety & Constraints (Stories 5–7)

#### Story 5: Atomic Assignment + Billing (Epic 07 Integration)
**As a** system  
**I want** assignment creation and billing to occur atomically  
**So that** we never create unpaid assignments

**Acceptance Criteria**
- Uses DB transaction isolation level: **READ COMMITTED** (default)
- For each assignment attempt:
  - lock provider balance row with `SELECT ... FOR UPDATE`
  - verify sufficient balance for `price_per_lead`
  - call `chargeForLeadAssignment()` (Epic 07) inside the same transaction
  - create lead_assignment row
  - update `last_received_at`
- On failure:
  - transaction rolls back (no partial assignment, no partial charge)
- Retry behavior:
  - if serialization/lock contention occurs, retry up to 3 times with jittered backoff

**Tasks**
- Implement `chargeForLeadAssignment(provider_id, subscription_id, lead_id, amount)` (call into Epic 07 service)
- Use row-level locks to prevent race conditions on balance
- Implement retry wrapper for transient DB failures
- Integration tests:
  - concurrent assignment attempts with insufficient balance (only one succeeds)

---

#### Story 6: Deduplication & Idempotency
**As a** system  
**I want** distribution retries to be safe  
**So that** a lead is never assigned twice to the same provider

**Acceptance Criteria**
- A provider cannot receive the same lead more than once, even if eligible in multiple levels
- Unique constraint:
  - `uq_lead_assignments_lead_provider` on `(lead_id, provider_id)`
- If a duplicate would occur:
  - log warning + continue distribution (do not fail entire run)

**Tasks**
- Add constraint:
  ```sql
  ALTER TABLE lead_assignments
    ADD CONSTRAINT IF NOT EXISTS uq_lead_assignments_lead_provider UNIQUE (lead_id, provider_id);
  ```
- During selection, keep an in-memory set of providers already assigned for the lead (cross-level dedupe)
- Handle unique constraint conflicts gracefully (catch, log, continue)
- Unit tests:
  - cross-level dedupe scenario

---

#### Story 7: Insufficient Balance Handling + Subscription Status Updates
**As a** system  
**I want** providers with insufficient funds skipped safely  
**So that** distribution continues without unpaid leads

**Acceptance Criteria**
- If provider balance < price_per_lead:
  - skip assignment for that provider
  - record skip reason in logs/metrics
  - call Epic 07 `checkAndUpdateSubscriptionStatus(provider_id)` after balance-affecting operations
- Provider notifications:
  - low balance / subscription deactivation notifications are handled via Epics 07 + 10
- Skip events are:
  - logged (application logs)
  - optionally audit-logged as `distribution_skipped_provider` (admin visibility) **(recommended)**

**Tasks**
- Integrate `checkAndUpdateSubscriptionStatus(provider_id)` (Epic 07)
- Emit metric: `distribution_skipped_insufficient_balance_total`
- Add optional audit log entry with metadata: { lead_id, provider_id, reason }
- Integration test: provider skipped due to low balance; distribution continues

---

### Orchestration (Story 8)

#### Story 8: Distribution Job Orchestration (BullMQ + DLQ)
**As a** system  
**I want** distribution to run asynchronously in a job queue  
**So that** lead intake and admin approvals remain fast

**Acceptance Criteria**
- BullMQ job name: `distribute_lead`
- Job payload:
  ```json
  {
    "lead_id": "<uuid>",
    "triggered_by": { "actor_id": "<uuid>", "actor_role": "admin|system" },
    "requested_at": "<iso8601>"
  }
  ```
- Retry strategy: up to 5 attempts with exponential backoff (e.g., 5s, 15s, 45s, 2m, 5m)
- Dead-letter queue (DLQ) stores permanently failed jobs
- Metrics emitted:
  - `distribution_success_total`
  - `distribution_failure_total`
  - `distribution_duration_ms`
  - `distribution_assignments_created_total`
  - `distribution_skipped_*` counters
- DLQ handling:
  - admin can view failed jobs (read-only in MVP)
  - manual requeue possible in ops tooling (future)

**Tasks**
- Implement BullMQ processor for `distribute_lead`
- Configure retries + backoff + DLQ
- Emit metrics + structured logs (Epic 12)
- Add alerting hooks:
  - DLQ size > threshold
  - high failure rate
  - frequent zero assignments

---

### Outcome Recording & Failure Handling (Stories 9–11) — NEW

#### Story 9: Distribution Result Recording (Lead Outcome)
**As a** system  
**I want** distribution outcomes recorded on the lead  
**So that** admins can understand what happened without digging through logs

**Acceptance Criteria**
- After distribution attempt completes:
  - `leads.distributed_at` set when assignments_created > 0
  - record `assignments_created_count`
  - record a `distribution_status` (if present) or use audit_log event as source of truth
- Audit log distribution summary with:
  - lead_id, niche_id, start_level, traversal_order
  - assignments_created, skipped_counts, duration_ms

**Tasks**
- If the lead table includes outcome fields, update them; otherwise:
  - store outcome in `audit_log` metadata (MVP-acceptable)
- Implement summary audit event: `lead_distributed`
- Add admin endpoint: GET distribution status (Story 3 endpoints section)

---

#### Story 10: Distribution Failure Handling (All-or-Nothing Failure)
**As a** system  
**I want** clear failure behavior and admin visibility  
**So that** failures are actionable

**Acceptance Criteria**
- If distribution fails entirely (e.g., DB down, billing service failing consistently):
  - job retries per Story 8
  - after final failure, job goes to DLQ
  - audit log `lead_distribution_failed` with error summary
  - admin can see status as “failed” via distribution-status endpoint
- Manual intervention workflow:
  - admin can re-trigger distribution after fixing issue

**Tasks**
- Normalize error types: transient vs permanent
- On permanent failure: write audit log, emit metric, enqueue admin alert (Epic 12)
- Implement admin re-trigger endpoint (Story 3 endpoints section)

---

#### Story 11: Distribution Metrics & Monitoring (Epic 12 Integration)
**As an** operator  
**I want** distribution metrics and alerts  
**So that** we detect issues quickly

**Acceptance Criteria**
- Emit metrics:
  - assignments created per level
  - skipped providers count by reason
  - insufficient balance count
  - eligibility evaluation failure count
  - duration percentiles
- Alerts:
  - zero assignments for N leads in a row (configurable)
  - failure rate > X% in 15 minutes
  - p95 duration > threshold

**Tasks**
- Define Prometheus metric names + labels (niche_id, level_id)
- Add structured logs for each run with correlation id
- Wire alerts in Grafana (Epic 12)

---

## Admin API Endpoints (MVP)
All admin endpoints require **RBAC + MFA** (Epic 01).

### 1) Manual Distribution Trigger
`POST /api/v1/admin/leads/:id/distribute`

**Request**
```json
{
  "reason": "manual_trigger" 
}
```

**Response (202 Accepted)**
```json
{
  "lead_id": "<uuid>",
  "status": "queued"
}
```

**Errors**
- 400 if lead not `approved`
- 404 if lead not found

---

### 2) Distribution Status Check
`GET /api/v1/admin/leads/:id/distribution-status`

**Response (200 OK)**
```json
{
  "lead_id": "<uuid>",
  "lead_status": "approved|distributed|...",
  "last_attempt_at": "<iso8601>",
  "last_attempt_status": "success|failed|queued|none",
  "assignments_created": 3,
  "start_level_order_position": 2,
  "notes": "informational"
}
```

---

### 3) Assignment List for Lead
`GET /api/v1/admin/leads/:id/assignments?page=1&limit=50`

**Response (200 OK)**
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
      "subscription_id": "<uuid>",
      "competition_level_id": "<uuid>",
      "price_charged": 49.00,
      "assigned_at": "<iso8601>",
      "status": "assigned"
    }
  ]
}
```

---

## Database Schema (MVP, Aligned to Locked Architecture)

### lead_assignments (Complete)
```sql
CREATE TABLE IF NOT EXISTS lead_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  subscription_id UUID NOT NULL REFERENCES provider_subscriptions(id) ON DELETE RESTRICT,
  competition_level_id UUID NOT NULL REFERENCES competition_levels(id) ON DELETE RESTRICT,
  price_charged DECIMAL(10,2) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- delivery lifecycle (MVP-compatible; UI may come later)
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- bad lead signals (Epic 09 will govern workflow)
  bad_lead_reported_at TIMESTAMPTZ,
  bad_lead_reason TEXT,
  bad_lead_status VARCHAR(20) CHECK (bad_lead_status IN ('pending','approved','rejected')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency / dedupe
ALTER TABLE lead_assignments
  ADD CONSTRAINT IF NOT EXISTS uq_lead_assignments_lead_provider UNIQUE (lead_id, provider_id);
```

### niches rotation pointer
```sql
ALTER TABLE niches
  ADD COLUMN IF NOT EXISTS next_start_level_order_position INT NOT NULL DEFAULT 1;
```

### provider_subscriptions fairness field
```sql
ALTER TABLE provider_subscriptions
  ADD COLUMN IF NOT EXISTS last_received_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_last_received
  ON provider_subscriptions(competition_level_id, last_received_at ASC NULLS FIRST);
```

---

## Error Handling Rules (MVP)
- **No eligible providers at any level:** record outcome (0 assignments), emit metric, do not error
- **All providers insufficient balance:** record outcome (0 assignments), emit metric, continue normal completion
- **Eligibility engine failure:** treat as ineligible (fail-safe), log error, metric increment
- **Billing failure (per provider):** rollback that provider’s transaction; continue with next provider
- **DB failure:** job retries; DLQ after max attempts; audit failure summary

---

## Testing Requirements

### Unit Tests
- Starting level rotation + wraparound
- Traversal ordering
- Fairness sorting (NULLS FIRST + tie-break)
- Deduplication logic
- Transaction retry wrapper behavior
- Error handling branches (no eligible, insufficient funds)

### Integration Tests
- Approved lead → assignments created → billing charged (Epic 07)
- Multi-level distribution (3 levels)
- Skip due to insufficient funds and continue
- Cross-level dedupe (same provider eligible in multiple levels)
- Manual admin trigger endpoint queues job
- Status endpoint reflects outcomes

### Race Condition Tests
- Concurrent distribution of same lead (idempotency)
- Concurrent start-level updates within same niche
- Concurrent balance locking on same provider

### Performance Tests
- 100 eligible providers < 1s
- 1000 eligible providers < 5s
- Concurrent distribution of 10 leads < 2s (in staging environment)

---

## Definition of Done
- All schema changes match locked architecture
- Two-dimensional fairness implemented (within-level + across-level)
- Distribution only runs for `approved` leads
- Eligibility integration with Epic 05 verified (contract + caching)
- Billing integration with Epic 07 verified (atomic charge + ledger entry)
- Subscription status update integration verified (Epic 07)
- Provider notifications queued via Epic 10
- BullMQ queue configured + retries + DLQ (Epic 12)
- Metrics emitted + alerts defined (Epic 12)
- Admin endpoints functional (trigger/status/assignments)
- All tests passing (unit, integration, race condition, performance)
- Documentation complete (algorithm, fairness rules, failure modes)

---
