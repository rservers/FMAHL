# EPIC 09 - Bad Lead & Refunds Implementation Plan

**Epic:** Bad Lead & Refunds  
**Created:** Jan 4, 2026  
**Target:** MVP Core - Provider Experience & Financial Integrity  
**Dependencies:** EPIC 01 ✅, EPIC 06 ✅, EPIC 07 ✅, EPIC 08 ✅, EPIC 10 ✅  
**Status:** Planning  
**Estimated Effort:** 10-12 hours (~1.5-2 days)

---

## Pre-Implementation Checklist

### ✅ Deferred Items Review
- [x] Checked `DEFERRED_ITEMS_SUMMARY.md` - No deferred items assigned to EPIC 09
- [x] Checked epic specification - No deferred items from other epics

### ✅ Dependencies Verified
| Epic | Dependency | Status | Component |
|------|------------|--------|-----------|
| 01 | Auth/RBAC | ✅ | Admin MFA, provider auth, audit logging |
| 06 | Distribution | ✅ | `lead_assignments` table with bad_lead fields stub |
| 07 | Billing | ✅ | `createRefundLedgerEntry()`, `checkAndUpdateSubscriptionStatus()` |
| 08 | Provider Lead Mgmt | ✅ | Provider assignment access patterns |
| 10 | Email | ✅ | `emailService.sendTemplated()`, notification preferences |

### ✅ Existing Infrastructure Verified
- `lead_assignments` table - ✅ Exists with basic fields from EPIC 06
- `provider_ledger` table - ✅ Exists with refund support from EPIC 07
- `providers.balance` - ✅ Cached balance from EPIC 07
- `emailService.sendTemplated()` - ✅ Available from EPIC 10
- `checkAndUpdateSubscriptionStatus()` - ✅ Available from EPIC 07

---

## Implementation Phases

### Phase 1: Database Schema Updates
**Effort:** 0.5 hours  
**Files:**
- `packages/database/schema.sql`
- `packages/database/migrate.ts`

**Tasks:**
1. Add `bad_lead_reason_category` and `bad_lead_reason_notes` columns
2. Add `refund_amount` column if not present
3. Add performance indexes for admin queue and provider history

**Schema Changes:**
```sql
-- Add reason category with enum constraint
ALTER TABLE lead_assignments
  ADD COLUMN IF NOT EXISTS bad_lead_reason_category VARCHAR(50)
    CHECK (bad_lead_reason_category IN ('spam','duplicate','invalid_contact','out_of_scope','other')),
  ADD COLUMN IF NOT EXISTS bad_lead_reason_notes TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2);

-- Admin queue index
CREATE INDEX IF NOT EXISTS idx_lead_assignments_bad_lead_status
  ON lead_assignments(bad_lead_status, bad_lead_reported_at DESC)
  WHERE bad_lead_status IS NOT NULL;

-- Admin filtering by provider
CREATE INDEX IF NOT EXISTS idx_lead_assignments_bad_lead_provider
  ON lead_assignments(provider_id, bad_lead_status, bad_lead_reported_at DESC)
  WHERE bad_lead_status IS NOT NULL;

-- Provider history index
CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_bad_leads
  ON lead_assignments(provider_id, bad_lead_reported_at DESC)
  WHERE bad_lead_reported_at IS NOT NULL;
```

**Acceptance Criteria:**
- [ ] Migration runs successfully
- [ ] Indexes created
- [ ] Existing data not affected

---

### Phase 2: TypeScript Types & Validation
**Effort:** 0.5 hours  
**Files:**
- `apps/web/lib/types/bad-leads.ts` (new)
- `apps/web/lib/validations/bad-leads.ts` (new)

**Types to Create:**
```typescript
// Reason categories
type BadLeadReasonCategory = 'spam' | 'duplicate' | 'invalid_contact' | 'out_of_scope' | 'other'

// Bad lead status
type BadLeadStatus = 'pending' | 'approved' | 'rejected'

// Provider report request
interface ReportBadLeadRequest {
  reason_category: BadLeadReasonCategory
  reason_notes?: string  // required if category='other'
}

// Admin list response
interface BadLeadListItem {
  assignment_id: string
  lead_id: string
  provider_id: string
  provider_name: string
  niche_id: string
  niche_name: string
  bad_lead_reported_at: string
  bad_lead_reason_category: BadLeadReasonCategory
  bad_lead_reason_notes: string | null
  bad_lead_status: BadLeadStatus
  price_charged: number
}

// Admin action request
interface AdminBadLeadActionRequest {
  admin_memo: string  // 10-1000 chars
}

// Provider history item
interface ProviderBadLeadHistoryItem {
  assignment_id: string
  lead_id: string
  niche_name: string
  bad_lead_reported_at: string
  bad_lead_reason_category: BadLeadReasonCategory
  bad_lead_reason_notes: string | null
  bad_lead_status: BadLeadStatus
  refund_amount: number | null
  refunded_at: string | null
  admin_memo: string | null
}

// Admin metrics
interface BadLeadMetrics {
  period: { from: string; to: string }
  summary: {
    total_reports: number
    total_approved: number
    total_rejected: number
    approval_rate: number
    total_refund_amount: number
    avg_resolution_time_hours: number
  }
  by_reason: Array<{
    reason_category: string
    count: number
    approval_rate: number
  }>
  by_provider: Array<{
    provider_id: string
    provider_name: string
    total_reports: number
    approval_rate: number
    total_refund_amount: number
    flagged: boolean
  }>
}
```

**Validation Schemas:**
- `reportBadLeadSchema` - category enum, conditional notes validation
- `adminBadLeadListQuerySchema` - filters, pagination
- `adminBadLeadActionSchema` - memo validation (10-1000 chars)
- `providerBadLeadHistoryQuerySchema` - filters, pagination
- `adminMetricsQuerySchema` - date range, optional filters

---

### Phase 3: Audit Actions
**Effort:** 0.25 hours  
**Files:**
- `apps/web/lib/services/audit-logger.ts`

**Actions to Add:**
```typescript
// Provider actions
BAD_LEAD_REPORTED: 'bad_lead.reported',

// Admin actions
BAD_LEAD_APPROVED: 'bad_lead.approved',
BAD_LEAD_REJECTED: 'bad_lead.rejected',

// System actions
BAD_LEAD_REFUND_PROCESSED: 'bad_lead.refund_processed',
```

---

### Phase 4: Rate Limiting Configuration
**Effort:** 0.25 hours  
**Files:**
- `apps/web/lib/middleware/rate-limit.ts`

**Configuration:**
```typescript
/** Bad lead report: 5 per provider per day (EPIC 09) */
BAD_LEAD_REPORT: {
  limit: 5,
  windowSeconds: 24 * 60 * 60, // 24 hours
  keyPrefix: 'ratelimit:bad_lead_report',
} as RateLimitConfig,
```

---

### Phase 5: Provider Report Bad Lead API
**Effort:** 1.5 hours  
**Files:**
- `apps/web/app/api/v1/provider/assignments/[assignmentId]/bad-lead/route.ts` (new)

**Endpoint:** `POST /api/v1/provider/assignments/:assignmentId/bad-lead`

**Logic:**
1. Validate assignment belongs to provider
2. Validate assignment is eligible (not refunded, not already resolved)
3. Validate reason_category enum
4. Validate notes (required if category='other', max 500 chars)
5. Check daily report limit (5/day/provider)
6. Idempotency:
   - If pending: return 200 with existing state
   - If resolved: return 409
7. Transaction:
   - Set `bad_lead_reported_at = NOW()`
   - Set `bad_lead_status = 'pending'`
   - Set `bad_lead_reason_category` and `bad_lead_reason_notes`
8. Audit log: `bad_lead.reported`
9. (Optional) Queue confirmation email

**Errors:**
- 400: Invalid category, invalid notes
- 403: Access denied
- 404: Assignment not found
- 409: Already resolved
- 429: Rate limit exceeded

---

### Phase 6: Admin List Bad Leads API
**Effort:** 1 hour  
**Files:**
- `apps/web/app/api/v1/admin/bad-leads/route.ts` (new)

**Endpoint:** `GET /api/v1/admin/bad-leads`

**Query Parameters:**
- `status` (pending/approved/rejected, default: pending)
- `niche_id` (optional)
- `provider_id` (optional)
- `reason_category` (optional)
- `reported_from`, `reported_to` (optional date range)
- `page` (default: 1)
- `limit` (default: 50, max: 100)

**Response:**
- Paginated list with total_count, total_pages
- Sorted by `bad_lead_reported_at DESC`
- Includes provider_name, niche_name, price_charged

---

### Phase 7: Admin Bad Lead Detail API
**Effort:** 0.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/bad-leads/[assignmentId]/route.ts` (new)

**Endpoint:** `GET /api/v1/admin/bad-leads/:assignmentId`

**Response:**
- Full assignment details
- Lead form_data
- Provider information
- Billing context (price_charged, subscription)
- Bad lead report details
- Assignment history

---

### Phase 8: Admin Approve Bad Lead API (Atomic Refund)
**Effort:** 1.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/bad-leads/[assignmentId]/approve/route.ts` (new)

**Endpoint:** `POST /api/v1/admin/bad-leads/:assignmentId/approve`

**Request:** `{ "admin_memo": "..." }`

**Logic:**
1. Validate pending status
2. Validate not already refunded
3. Validate admin_memo (10-1000 chars)
4. Get original price_charged
5. **Atomic Transaction:**
   - Update assignment:
     - `bad_lead_status = 'approved'`
     - `refunded_at = NOW()`
     - `refund_amount = price_charged`
     - `refund_reason = admin_memo`
   - Create ledger entry via EPIC 07 `createRefundLedgerEntry()`
   - Update provider balance
   - Call `checkAndUpdateSubscriptionStatus(provider_id)`
6. Audit log: `bad_lead.approved`
7. Queue email: `bad_lead_approved`

**Idempotency:**
- If already approved: return 200 with current state
- If already rejected: return 409

---

### Phase 9: Admin Reject Bad Lead API
**Effort:** 0.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/bad-leads/[assignmentId]/reject/route.ts` (new)

**Endpoint:** `POST /api/v1/admin/bad-leads/:assignmentId/reject`

**Request:** `{ "admin_memo": "..." }`

**Logic:**
1. Validate pending status
2. Validate admin_memo (10-1000 chars)
3. Update assignment:
   - `bad_lead_status = 'rejected'`
   - `refund_reason = admin_memo`
4. Audit log: `bad_lead.rejected`
5. Queue email: `bad_lead_rejected`

**Idempotency:**
- If already rejected: return 200 with current state
- If already approved: return 409

---

### Phase 10: Provider Bad Lead History API
**Effort:** 0.5 hours  
**Files:**
- `apps/web/app/api/v1/provider/bad-leads/route.ts` (new)

**Endpoint:** `GET /api/v1/provider/bad-leads`

**Query Parameters:**
- `status` (pending/approved/rejected, optional)
- `reported_from`, `reported_to` (optional date range)
- `page` (default: 1)
- `limit` (default: 50, max: 100)

**Response:**
- Paginated list with total_count, total_pages
- Sorted by `bad_lead_reported_at DESC`
- Includes refund_amount, refunded_at, admin_memo when resolved

---

### Phase 11: Admin Metrics API
**Effort:** 1 hour  
**Files:**
- `apps/web/app/api/v1/admin/bad-leads/metrics/route.ts` (new)

**Endpoint:** `GET /api/v1/admin/bad-leads/metrics`

**Query Parameters:**
- `date_from`, `date_to` (default: last 30 days)
- `niche_id` (optional)
- `provider_id` (optional)

**Response:**
```json
{
  "period": { "from": "...", "to": "..." },
  "summary": {
    "total_reports": 150,
    "total_approved": 90,
    "total_rejected": 60,
    "approval_rate": 0.60,
    "total_refund_amount": 2250.00,
    "avg_resolution_time_hours": 18.5
  },
  "by_reason": [...],
  "by_provider": [...]
}
```

**Features:**
- Redis caching (5-min TTL)
- Abuse flags per provider (>50% approval rate over 30 days)

---

### Phase 12: Email Templates
**Effort:** 0.5 hours  
**Files:**
- `packages/email/types.ts`
- `packages/email/templates/defaults.ts`

**Templates to Add:**

1. **bad_lead_reported_confirmation** (Provider)
   - When: After provider submits report
   - Vars: provider_name, lead_id, niche_name, reported_at

2. **bad_lead_approved** (Provider)
   - When: Admin approves
   - Vars: provider_name, lead_id, niche_name, refund_amount, admin_memo, refunded_at

3. **bad_lead_rejected** (Provider)
   - When: Admin rejects
   - Vars: provider_name, lead_id, niche_name, admin_memo, reviewed_at

---

### Phase 13: Integration Testing
**Effort:** 1 hour  
**Files:**
- `test-epic09.sh` (new)

**Test Scenarios:**
1. ✅ Database schema verification
2. ✅ TypeScript types exist
3. ✅ API endpoints exist
4. ✅ Audit actions exist
5. ✅ Email templates exist
6. ✅ Rate limiting configured
7. ✅ Provider report flow
8. ✅ Admin list/approve/reject flow
9. ✅ Idempotency behavior
10. ✅ Refund ledger integration
11. ✅ TypeScript compilation

---

### Phase 14: Documentation & Review
**Effort:** 0.5 hours  
**Files:**
- `README.md`
- `.cursor/docs/DEVELOPMENT_GUIDE.md`
- `.cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md`

**Tasks:**
1. Update README with EPIC 09 endpoints
2. Update DEVELOPMENT_GUIDE with completion status
3. Update EPIC_EXECUTION_PLAN status tracker
4. Create EPIC_09_REVIEW.md

---

## Summary

### New Endpoints (7)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/provider/assignments/:id/bad-lead` | Provider reports bad lead |
| GET | `/api/v1/provider/bad-leads` | Provider bad lead history |
| GET | `/api/v1/admin/bad-leads` | Admin queue (filtered, paginated) |
| GET | `/api/v1/admin/bad-leads/:id` | Admin bad lead detail |
| POST | `/api/v1/admin/bad-leads/:id/approve` | Admin approve (atomic refund) |
| POST | `/api/v1/admin/bad-leads/:id/reject` | Admin reject |
| GET | `/api/v1/admin/bad-leads/metrics` | Admin refund metrics |

### New Audit Actions (4)
- `bad_lead.reported`
- `bad_lead.approved`
- `bad_lead.rejected`
- `bad_lead.refund_processed`

### New Email Templates (3)
- `bad_lead_reported_confirmation`
- `bad_lead_approved`
- `bad_lead_rejected`

### New Rate Limits (1)
- `BAD_LEAD_REPORT`: 5/day/provider

### Key Business Rules
1. Provider can report bad lead once per assignment
2. Must select reason category (spam, duplicate, invalid_contact, out_of_scope, other)
3. Notes required if category='other'
4. Daily report limit: 5/day/provider
5. Admin memo required for approve/reject (10-1000 chars)
6. Refund amount = original price_charged (immutable)
7. Refund creates ledger entry and updates balance
8. Subscription status rechecked after refund

---

## Effort Summary

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Database Schema | 0.5 hours |
| 2 | TypeScript Types & Validation | 0.5 hours |
| 3 | Audit Actions | 0.25 hours |
| 4 | Rate Limiting | 0.25 hours |
| 5 | Provider Report API | 1.5 hours |
| 6 | Admin List API | 1 hour |
| 7 | Admin Detail API | 0.5 hours |
| 8 | Admin Approve API | 1.5 hours |
| 9 | Admin Reject API | 0.5 hours |
| 10 | Provider History API | 0.5 hours |
| 11 | Admin Metrics API | 1 hour |
| 12 | Email Templates | 0.5 hours |
| 13 | Integration Testing | 1 hour |
| 14 | Documentation | 0.5 hours |

**Total:** ~10 hours

---

## Risk Assessment

### Low Risk
- Database schema changes (additive, no data migration)
- Rate limiting (existing pattern)
- Email templates (existing infrastructure)

### Medium Risk
- Atomic refund transaction (must integrate with EPIC 07)
- Idempotency handling (careful state management)

### Mitigation
- Test refund integration thoroughly
- Use row-level locking for concurrent access
- Comprehensive error handling

---

## Definition of Done

- [ ] All 14 phases complete
- [ ] TypeScript compilation successful
- [ ] All integration tests passing
- [ ] Refund flow tested end-to-end
- [ ] Rate limiting verified
- [ ] Idempotency verified
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Committed and pushed

---

**Ready to proceed? Say "yes" to start implementing all phases.**

