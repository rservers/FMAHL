# EPIC 08 - Provider Lead Management Implementation Plan

**Epic:** Provider Lead Management  
**Created:** Jan 4, 2026  
**Target:** MVP Core - Provider Experience  
**Dependencies:** EPIC 01 ✅, EPIC 06 ✅, EPIC 07 ✅, EPIC 10 ✅  
**Status:** Planning

---

## Pre-Implementation Checklist

### ✅ Deferred Items Review
- [x] Checked `DEFERRED_ITEMS_SUMMARY.md` - No deferred items assigned to EPIC 08
- [x] Checked epic specification - No deferred items from other epics

### ✅ Dependencies Verified
| Epic | Dependency | Status | Component |
|------|------------|--------|-----------|
| 01 | Auth/RBAC | ✅ | Provider endpoint protection |
| 06 | Distribution | ✅ | `lead_assignments` table, assignment creation |
| 07 | Billing | ✅ | `price_charged`, `competition_level_id`, ledger linkage |
| 10 | Email | ✅ | Provider/admin notifications |

### ✅ Existing Infrastructure Verified
- `lead_assignments` table - ✅ Exists with all fields from EPIC 06
- `leads` table - ✅ Exists with `form_data`, `contact_*` fields
- `competition_levels` table - ✅ Exists
- `emailService.sendTemplated()` - ✅ Available from EPIC 10
- Provider authentication - ✅ Available from EPIC 01

---

## Implementation Phases

### Phase 1: Database Schema Updates
**Effort:** 0.5 hours  
**Files:**
- `packages/database/schema.sql`
- `packages/database/migrate.ts`

**Tasks:**
1. Add `niche_id` to `lead_assignments` (derived from lead's niche)
2. Add performance indexes for provider inbox queries
3. Add search indexes for leads table
4. Run migration

**Schema Changes:**
```sql
-- Inbox performance indexes
CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_assigned
  ON lead_assignments(provider_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_status
  ON lead_assignments(provider_id, status);

-- Filtering by niche + date
CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_niche
  ON lead_assignments(provider_id, competition_level_id, assigned_at DESC);

-- Search indexes
CREATE INDEX IF NOT EXISTS idx_leads_contact_email_lower
  ON leads(LOWER(contact_email));

CREATE INDEX IF NOT EXISTS idx_leads_contact_phone
  ON leads(contact_phone);
```

**Acceptance Criteria:**
- [ ] Migration runs successfully
- [ ] Indexes created
- [ ] Query performance improved

---

### Phase 2: TypeScript Types & Validation
**Effort:** 0.5 hours  
**Files:**
- `apps/web/lib/types/provider-leads.ts` (new)
- `apps/web/lib/validations/provider-leads.ts` (new)

**Tasks:**
1. Define `ProviderLeadAssignment` type
2. Define `LeadDetailView` type
3. Define `ProviderInboxFilters` type
4. Create Zod validation schemas for all endpoints
5. Define status transitions

**Types to Create:**
```typescript
interface ProviderLeadAssignment {
  assignment_id: string
  lead_id: string
  niche_id: string
  niche_name: string
  status: AssignmentStatus
  price_charged: number
  assigned_at: string
  viewed_at: string | null
  accepted_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  contact_email: string
  contact_phone: string | null
  contact_name: string | null
}

type AssignmentStatus = 'active' | 'accepted' | 'rejected' | 'refunded'

interface LeadDetailView extends ProviderLeadAssignment {
  form_data: Record<string, unknown>
  billing_context: {
    price_charged: number
    charged_at: string
    competition_level: string
    subscription_id: string
  }
  attribution?: {
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    referrer_url: string | null
  }
}
```

**Acceptance Criteria:**
- [ ] All types defined
- [ ] Zod schemas created
- [ ] TypeScript compilation passes

---

### Phase 3: Provider Inbox API
**Effort:** 1 hour  
**Files:**
- `apps/web/app/api/v1/provider/leads/route.ts` (new)

**Tasks:**
1. Create `GET /api/v1/provider/leads` endpoint
2. Implement filtering (status, niche_id, date range)
3. Implement search (contact_email, contact_phone)
4. Implement pagination (default 25, max 100)
5. Sort by `assigned_at DESC`
6. Add provider authentication middleware

**Filters:**
- `status` - Optional, enum: active, accepted, rejected, refunded
- `niche_id` - Optional, UUID
- `date_from`, `date_to` - Optional, ISO 8601 dates
- `search` - Optional, searches email and phone
- `page`, `limit` - Pagination

**Response:**
```json
{
  "page": 1,
  "limit": 25,
  "total_count": 150,
  "total_pages": 6,
  "items": [...]
}
```

**Acceptance Criteria:**
- [ ] Endpoint returns only provider's assignments
- [ ] All filters working
- [ ] Search working (case-insensitive email, partial phone)
- [ ] Pagination working
- [ ] Response time < 300ms p95

---

### Phase 4: Lead Detail View API
**Effort:** 1 hour  
**Files:**
- `apps/web/app/api/v1/provider/leads/[leadId]/route.ts` (new)

**Tasks:**
1. Create `GET /api/v1/provider/leads/:leadId` endpoint
2. Verify assignment belongs to provider
3. Return full lead details with form_data
4. Include billing context
5. Conditionally include attribution (based on env var)
6. Automatically mark as viewed (Story 3)

**Attribution Control:**
```typescript
const showAttribution = process.env.SHOW_ATTRIBUTION_TO_PROVIDERS === 'true'
```

**Response:**
```json
{
  "assignment_id": "uuid",
  "lead_id": "uuid",
  "niche_name": "Roofing",
  "status": "active",
  "form_data": {...},
  "contact_email": "...",
  "contact_phone": "...",
  "billing_context": {
    "price_charged": 25.00,
    "charged_at": "2026-01-02T15:00:00Z",
    "competition_level": "Standard",
    "subscription_id": "uuid"
  },
  "attribution": {...}  // Only if enabled
}
```

**Acceptance Criteria:**
- [ ] Endpoint verifies ownership
- [ ] Returns complete lead details
- [ ] Attribution gated by env var
- [ ] Marks lead as viewed on first access

---

### Phase 5: Automatic Viewed Tracking
**Effort:** 0.5 hours  
**Files:**
- `apps/web/app/api/v1/provider/leads/[leadId]/route.ts` (update)
- `apps/web/lib/services/audit-logger.ts` (update)

**Tasks:**
1. Update `viewed_at` on first GET request
2. Only update if `viewed_at IS NULL`
3. Add audit action `LEAD_VIEWED`
4. Log viewing action

**Logic:**
```typescript
// In lead detail GET handler
if (!assignment.viewed_at) {
  await sql`
    UPDATE lead_assignments
    SET viewed_at = NOW()
    WHERE id = ${assignmentId}
      AND viewed_at IS NULL
  `
  await logAction({
    actorId: provider.id,
    actorRole: 'provider',
    action: AuditActions.LEAD_VIEWED,
    entity: 'lead_assignment',
    entityId: assignmentId,
  })
}
```

**Acceptance Criteria:**
- [ ] `viewed_at` set on first access only
- [ ] Subsequent accesses don't update
- [ ] Audit log entry created

---

### Phase 6: Accept Lead API
**Effort:** 0.75 hours  
**Files:**
- `apps/web/app/api/v1/provider/leads/[leadId]/accept/route.ts` (new)
- `apps/web/lib/services/audit-logger.ts` (update)

**Tasks:**
1. Create `POST /api/v1/provider/leads/:leadId/accept` endpoint
2. Verify assignment belongs to provider
3. Use row-level locking to prevent race conditions
4. Validate current status is 'active'
5. Update status to 'accepted' and set `accepted_at`
6. Add audit action `LEAD_ACCEPTED`
7. (Optional) Notify admin if configured

**Transaction:**
```typescript
await sql.begin(async (sql) => {
  const [assignment] = await sql`
    SELECT id, status
    FROM lead_assignments
    WHERE id = ${assignmentId}
      AND provider_id = ${providerId}
    FOR UPDATE
  `
  
  if (!assignment) throw new Error('Assignment not found')
  if (assignment.status !== 'active') throw new Error('Already resolved')
  
  await sql`
    UPDATE lead_assignments
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = ${assignmentId}
  `
})
```

**Response:**
```json
{
  "ok": true,
  "assignment_id": "uuid",
  "status": "accepted",
  "accepted_at": "2026-01-02T15:00:00Z"
}
```

**Acceptance Criteria:**
- [ ] Race condition safe (row locking)
- [ ] Only 'active' status can be accepted
- [ ] Returns 409 if already resolved
- [ ] Audit log entry created

---

### Phase 7: Reject Lead API
**Effort:** 0.75 hours  
**Files:**
- `apps/web/app/api/v1/provider/leads/[leadId]/reject/route.ts` (new)
- `apps/web/lib/services/audit-logger.ts` (update)
- `packages/email/templates/defaults.ts` (update)

**Tasks:**
1. Create `POST /api/v1/provider/leads/:leadId/reject` endpoint
2. Verify assignment belongs to provider
3. Validate rejection_reason is provided (min 10, max 500 chars)
4. Use row-level locking
5. Update status to 'rejected', set `rejected_at` and `rejection_reason`
6. Add audit action `LEAD_REJECTED`
7. Notify admin if `NOTIFY_ADMIN_ON_PROVIDER_REJECT=true` (default true)
8. Create `admin_provider_rejected_lead` email template

**Request:**
```json
{
  "rejection_reason": "Contact info is incorrect, phone number invalid"
}
```

**Response:**
```json
{
  "ok": true,
  "assignment_id": "uuid",
  "status": "rejected",
  "rejected_at": "2026-01-02T15:00:00Z"
}
```

**Email Template (`admin_provider_rejected_lead`):**
- To: Admin notification email
- Variables: provider_name, lead_id, niche_name, rejection_reason, rejected_at

**Acceptance Criteria:**
- [ ] Rejection reason required and validated
- [ ] Race condition safe
- [ ] Admin notification sent (if enabled)
- [ ] Audit log entry created

---

### Phase 8: Provider Notification Preferences API
**Effort:** 0.75 hours  
**Files:**
- `apps/web/app/api/v1/provider/notification-preferences/route.ts` (new)
- `packages/database/migrate.ts` (update)

**Tasks:**
1. Add notification preference columns to providers table
2. Create `GET /api/v1/provider/notification-preferences` endpoint
3. Create `PATCH /api/v1/provider/notification-preferences` endpoint
4. Validate preference fields

**Schema Changes:**
```sql
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS notify_on_new_lead BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_lead_status_change BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_bad_lead_decision BOOLEAN NOT NULL DEFAULT true;
```

**PATCH Request:**
```json
{
  "notify_on_new_lead": false,
  "notify_on_lead_status_change": true
}
```

**Response:**
```json
{
  "ok": true,
  "preferences": {
    "notify_on_new_lead": false,
    "notify_on_lead_status_change": true,
    "notify_on_bad_lead_decision": true
  }
}
```

**Acceptance Criteria:**
- [ ] Preferences persisted
- [ ] Partial updates supported
- [ ] Defaults applied for new providers

---

### Phase 9: Lead Export API
**Effort:** 1 hour  
**Files:**
- `apps/web/app/api/v1/provider/leads/export/route.ts` (new)
- `apps/worker/src/jobs/export-leads.ts` (new)
- `apps/worker/src/processors/export.ts` (new)
- `packages/email/templates/defaults.ts` (update)

**Tasks:**
1. Create `POST /api/v1/provider/leads/export` endpoint
2. Implement daily export limit (5/day/provider)
3. Limit rows to 5000 per export
4. Queue async CSV generation job
5. Create BullMQ job processor
6. Generate CSV file
7. Upload to storage (or generate inline)
8. Send email with download link
9. Create `lead_export_ready` email template

**Request:**
```json
{
  "filters": {
    "status": "accepted",
    "date_from": "2025-12-01",
    "date_to": "2025-12-31"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "export_id": "uuid",
  "status": "queued",
  "estimated_rows": 1200,
  "message": "Export queued. You will receive an email when ready."
}
```

**Rate Limiting:**
- Redis key: `lead_export:{provider_id}:{YYYY-MM-DD}`
- Max: 5 exports/day
- TTL: 24 hours
- 429 response if exceeded

**Acceptance Criteria:**
- [ ] Daily limit enforced
- [ ] Max rows enforced
- [ ] Async processing
- [ ] Email sent with download link

---

### Phase 10: Audit Actions
**Effort:** 0.5 hours  
**Files:**
- `apps/web/lib/services/audit-logger.ts` (update)

**Tasks:**
1. Add `LEAD_VIEWED` audit action
2. Add `LEAD_ACCEPTED` audit action
3. Add `LEAD_REJECTED` audit action
4. Add `LEAD_EXPORT_REQUESTED` audit action
5. Add `LEAD_EXPORT_COMPLETED` audit action

**Audit Actions:**
```typescript
export const AuditActions = {
  // ... existing actions
  
  // EPIC 08 - Provider Lead Management
  LEAD_VIEWED: 'lead.viewed',
  LEAD_ACCEPTED: 'lead.accepted',
  LEAD_REJECTED: 'lead.rejected',
  LEAD_EXPORT_REQUESTED: 'lead.export_requested',
  LEAD_EXPORT_COMPLETED: 'lead.export_completed',
} as const
```

**Acceptance Criteria:**
- [ ] All 5 actions defined
- [ ] Actions logged for all operations

---

### Phase 11: Email Templates
**Effort:** 0.5 hours  
**Files:**
- `packages/email/types.ts` (update)
- `packages/email/templates/defaults.ts` (update)

**Tasks:**
1. Add `admin_provider_rejected_lead` template
2. Add `lead_export_ready` template
3. Define template variables

**Templates:**

**`admin_provider_rejected_lead`:**
- Subject: "Provider Rejected Lead - {niche_name}"
- Variables: provider_name, lead_id, niche_name, rejection_reason, rejected_at
- Purpose: Notify admin when provider rejects a lead

**`lead_export_ready`:**
- Subject: "Your Lead Export is Ready"
- Variables: provider_name, export_date, row_count, download_url, expires_at
- Purpose: Notify provider when export is ready

**Acceptance Criteria:**
- [ ] Templates defined
- [ ] Variables documented
- [ ] Templates render correctly

---

### Phase 12: Rate Limiting
**Effort:** 0.5 hours  
**Files:**
- `apps/web/lib/middleware/rate-limit.ts` (update)

**Tasks:**
1. Add rate limiting for provider inbox endpoint (100 req/min)
2. Add rate limiting for lead detail endpoint (200 req/min)
3. Add rate limiting for accept/reject endpoints (50 req/min)
4. Add export rate limiting (5/day)

**Rate Limits:**
| Endpoint | Limit |
|----------|-------|
| GET /provider/leads | 100/min |
| GET /provider/leads/:id | 200/min |
| POST /provider/leads/:id/accept | 50/min |
| POST /provider/leads/:id/reject | 50/min |
| POST /provider/leads/export | 5/day |

**Acceptance Criteria:**
- [ ] All endpoints rate limited
- [ ] Proper 429 responses
- [ ] Export daily limit enforced

---

### Phase 13: Integration Testing
**Effort:** 1 hour  
**Files:**
- `test-epic08.sh` (new)

**Test Cases:**
1. **Inbox Tests:**
   - List only provider's assignments
   - Filter by status, niche, date range
   - Search by email, phone
   - Pagination

2. **Detail View Tests:**
   - View lead details
   - Automatic viewed_at tracking
   - Attribution gating

3. **Accept/Reject Tests:**
   - Accept lead successfully
   - Reject with reason
   - 409 on already resolved
   - Race condition safety

4. **Export Tests:**
   - Queue export job
   - Daily limit enforcement
   - Row limit enforcement

5. **Preferences Tests:**
   - Get current preferences
   - Update preferences

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Race condition tests pass
- [ ] Rate limit tests pass

---

### Phase 14: Documentation & Review
**Effort:** 0.5 hours  
**Files:**
- `README.md` (update)
- `.cursor/docs/DEVELOPMENT_GUIDE.md` (update)
- `.cursor/docs/Delivery/EPIC_08_REVIEW.md` (new)

**Tasks:**
1. Update README with new endpoints
2. Update DEVELOPMENT_GUIDE with status
3. Create review document
4. Update EPIC_EXECUTION_PLAN.md

**Acceptance Criteria:**
- [ ] Documentation complete
- [ ] All endpoints documented
- [ ] Review approved

---

## Summary

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|--------------|
| 1 | Database Schema Updates | 0.5h | - |
| 2 | TypeScript Types & Validation | 0.5h | Phase 1 |
| 3 | Provider Inbox API | 1h | Phase 2 |
| 4 | Lead Detail View API | 1h | Phase 2 |
| 5 | Automatic Viewed Tracking | 0.5h | Phase 4 |
| 6 | Accept Lead API | 0.75h | Phase 2 |
| 7 | Reject Lead API | 0.75h | Phase 2 |
| 8 | Notification Preferences API | 0.75h | - |
| 9 | Lead Export API | 1h | Phase 2 |
| 10 | Audit Actions | 0.5h | - |
| 11 | Email Templates | 0.5h | - |
| 12 | Rate Limiting | 0.5h | - |
| 13 | Integration Testing | 1h | All phases |
| 14 | Documentation & Review | 0.5h | All phases |

**Total Estimated Effort:** 10 hours (~1.5 days)

---

## API Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/provider/leads` | Provider inbox | Provider |
| GET | `/api/v1/provider/leads/:leadId` | Lead detail | Provider |
| POST | `/api/v1/provider/leads/:leadId/accept` | Accept lead | Provider |
| POST | `/api/v1/provider/leads/:leadId/reject` | Reject lead | Provider |
| GET | `/api/v1/provider/notification-preferences` | Get preferences | Provider |
| PATCH | `/api/v1/provider/notification-preferences` | Update preferences | Provider |
| POST | `/api/v1/provider/leads/export` | Request export | Provider |

**Total New Endpoints:** 7

---

## Files to Create/Modify

### New Files (12)
- `apps/web/lib/types/provider-leads.ts`
- `apps/web/lib/validations/provider-leads.ts`
- `apps/web/app/api/v1/provider/leads/route.ts`
- `apps/web/app/api/v1/provider/leads/[leadId]/route.ts`
- `apps/web/app/api/v1/provider/leads/[leadId]/accept/route.ts`
- `apps/web/app/api/v1/provider/leads/[leadId]/reject/route.ts`
- `apps/web/app/api/v1/provider/notification-preferences/route.ts`
- `apps/web/app/api/v1/provider/leads/export/route.ts`
- `apps/worker/src/jobs/export-leads.ts`
- `apps/worker/src/processors/export.ts`
- `test-epic08.sh`
- `.cursor/docs/Delivery/EPIC_08_REVIEW.md`

### Modified Files (6)
- `packages/database/schema.sql`
- `packages/database/migrate.ts`
- `apps/web/lib/services/audit-logger.ts`
- `packages/email/types.ts`
- `packages/email/templates/defaults.ts`
- `apps/worker/src/index.ts`

---

## Risk Assessment

### Low Risk
- Schema changes (additive, backward compatible)
- New API endpoints (isolated)
- Email templates (independent)

### Medium Risk
- Race conditions in accept/reject (mitigated with row locking)
- Export performance (mitigated with async processing)
- Search performance (mitigated with indexes)

### Mitigation Strategies
1. **Race Conditions:** Use `SELECT ... FOR UPDATE` for all state changes
2. **Performance:** Add proper indexes, use pagination, async exports
3. **Security:** Verify provider ownership for all operations

---

## Definition of Done

- [ ] All 14 phases completed
- [ ] All 7 API endpoints implemented
- [ ] All 5 audit actions added
- [ ] All 2 email templates created
- [ ] Rate limiting configured
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] No TypeScript errors
- [ ] No linting errors

---

**Ready to Start:** ✅ All dependencies met, ready for implementation.

**Next Steps:**
1. ✅ Create this implementation plan
2. 🔄 Implement Phase 1 (Database Schema)
3. 🔄 Continue through all phases
4. 🔄 Run integration tests
5. 🔄 Complete review and documentation

