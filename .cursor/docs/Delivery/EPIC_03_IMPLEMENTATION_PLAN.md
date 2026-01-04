# EPIC 03 Implementation Plan — Admin Lead Review & Approval

**Epic:** 03 - Admin Lead Review & Approval  
**Status:** 🟡 Planning  
**Started:** Jan 4, 2026  
**Depends On:** EPIC 01 ✅ (Platform Foundation), EPIC 02 ✅ (Lead Intake), EPIC 10 ✅ (Email Infrastructure)  
**Unlocks:** EPIC 06 (Distribution Engine)

---

## Overview

This epic enables admins to review confirmed leads and approve or reject them before distribution. It provides:
- Admin lead queue with filtering and pagination
- Lead detail view with full context
- Approve/reject actions with notes
- Bulk operations for efficiency
- Queue statistics dashboard
- Optional email notifications

**Key Rule:** No lead may be distributed to providers until an admin has approved it.

---

## Current State Analysis

### ✅ Already Exists

| Component | Location | Status |
|-----------|----------|--------|
| `leads` table | `packages/database/schema.sql` | ✅ With `pending_approval` status |
| Admin auth | `apps/web/lib/middleware/auth.ts` | ✅ Admin + MFA middleware |
| RBAC | `apps/web/lib/middleware/rbac.ts` | ✅ Role-based access control |
| Audit logging | `apps/web/lib/services/audit-logger.ts` | ✅ Working |
| Email service | `packages/email/` | ✅ EPIC 10 complete |
| Admin user APIs | `apps/web/app/api/v1/admin/users/` | ✅ Pattern established |

### 🔨 Needs Building

| Component | Priority |
|-----------|----------|
| Schema: Add approval/rejection fields to `leads` | P0 |
| Schema: Add admin notes field | P0 |
| Schema: Add indexes for admin queries | P0 |
| Admin lead list API | P0 |
| Admin lead detail API | P0 |
| Approve lead API | P0 |
| Reject lead API | P0 |
| Bulk approve API | P1 |
| Bulk reject API | P1 |
| Stats API | P1 |
| Admin lead queue UI | P1 |
| Lead detail UI | P1 |

---

## Implementation Phases

### Phase 1: Database Schema Updates (0.5 day)

**Files to Modify:**
- `packages/database/schema.sql`
- `packages/database/migrate.ts`

**Schema Changes:**

```sql
-- Admin approval/rejection fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_leads_status_created 
  ON leads(status, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_approved_at 
  ON leads(approved_at) WHERE approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_rejected_at 
  ON leads(rejected_at) WHERE rejected_at IS NOT NULL;
```

**Tasks:**
- [ ] Add approval/rejection columns to schema.sql
- [ ] Add admin_notes column
- [ ] Add composite index for status + created_at queries
- [ ] Add partial indexes for approved/rejected queries
- [ ] Update migrate.ts with idempotent migration function
- [ ] Run migration and verify

---

### Phase 2: Validation Schemas (0.5 day)

**Files to Create:**
- `apps/web/lib/validations/admin-leads.ts`

**Schemas:**

```typescript
// Approve request
z.object({
  notes: z.string().max(1000).optional(),
  notify_user: z.boolean().default(false),
})

// Reject request
z.object({
  reason: z.string().min(1).max(500),
  notes: z.string().max(1000).optional(),
  notify_user: z.boolean().default(false),
})

// Bulk approve request
z.object({
  lead_ids: z.array(z.string().uuid()).min(1).max(50),
  notes: z.string().max(1000).optional(),
})

// Bulk reject request
z.object({
  lead_ids: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().min(1).max(500),
  notes: z.string().max(1000).optional(),
})

// Lead list query
z.object({
  status: z.enum(['pending_approval', 'approved', 'rejected']).optional(),
  niche_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
```

**Tasks:**
- [ ] Create validation schemas file
- [ ] Define approve schema
- [ ] Define reject schema
- [ ] Define bulk action schemas
- [ ] Define list query schema

---

### Phase 3: Admin Lead List API (1 day)

**Files to Create:**
- `apps/web/app/api/v1/admin/leads/route.ts`

**Endpoint:** `GET /api/v1/admin/leads`

**Query Parameters:**
- `status` (optional): Filter by status
- `niche_id` (optional): Filter by niche
- `page` (default: 1): Page number
- `limit` (default: 20): Items per page

**Response:**
```json
{
  "leads": [
    {
      "id": "uuid",
      "submitter_email": "email@example.com",
      "submitter_name": "John Doe",
      "niche_id": "uuid",
      "niche_name": "VPS Hosting",
      "status": "pending_approval",
      "created_at": "2026-01-04T10:00:00Z",
      "confirmed_at": "2026-01-04T10:05:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

**Tasks:**
- [ ] Create GET route handler
- [ ] Apply adminWithMFA middleware
- [ ] Validate query parameters
- [ ] Build SQL query with filters
- [ ] Implement pagination
- [ ] Join with niches table for niche_name
- [ ] Return formatted response
- [ ] Add error handling

---

### Phase 4: Admin Lead Detail API (0.5 day)

**Files to Create:**
- `apps/web/app/api/v1/admin/leads/[id]/route.ts`

**Endpoint:** `GET /api/v1/admin/leads/:id`

**Response:**
```json
{
  "id": "uuid",
  "niche_id": "uuid",
  "niche_name": "VPS Hosting",
  "niche_form_schema": [...],
  "status": "pending_approval",
  "submitter_name": "John Doe",
  "submitter_email": "email@example.com",
  "submitter_phone": "+1234567890",
  "form_data": {
    "server_type": "vps",
    "cpu_cores": 4,
    ...
  },
  "attribution": {
    "utm_source": "google",
    "utm_medium": "cpc",
    "referrer_url": "https://..."
  },
  "confirmation": {
    "confirmed_at": "2026-01-04T10:05:00Z",
    "ip_address": "192.168.1.1",
    "user_agent": "..."
  },
  "created_at": "2026-01-04T10:00:00Z",
  "admin_notes": null
}
```

**Tasks:**
- [ ] Create GET route handler
- [ ] Apply adminWithMFA middleware
- [ ] Validate lead ID
- [ ] Fetch lead with all details
- [ ] Join with niches for form_schema
- [ ] Format form_data with schema labels
- [ ] Include attribution data
- [ ] Include confirmation details
- [ ] Return formatted response

---

### Phase 5: Approve Lead API (0.5 day)

**Files to Create:**
- `apps/web/app/api/v1/admin/leads/[id]/approve/route.ts`

**Endpoint:** `POST /api/v1/admin/leads/:id/approve`

**Request Body:**
```json
{
  "notes": "Looks good, approved",
  "notify_user": false
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "approved",
  "approved_at": "2026-01-04T11:00:00Z",
  "approved_by": "admin-uuid",
  "admin_notes": "Looks good, approved"
}
```

**Flow:**
1. Validate lead exists
2. Check lead is in `pending_approval`
3. Update lead: status → `approved`, set approved_at, approved_by, admin_notes
4. Audit log approval
5. Optional: Send approval email if notify_user=true
6. Return updated lead

**Tasks:**
- [ ] Create POST route handler
- [ ] Apply adminWithMFA middleware
- [ ] Validate request body
- [ ] Validate lead status
- [ ] Transactionally update lead
- [ ] Audit log approval
- [ ] Optional email notification
- [ ] Return updated lead

---

### Phase 6: Reject Lead API (0.5 day)

**Files to Create:**
- `apps/web/app/api/v1/admin/leads/[id]/reject/route.ts`

**Endpoint:** `POST /api/v1/admin/leads/:id/reject`

**Request Body:**
```json
{
  "reason": "Invalid contact information",
  "notes": "Phone number format incorrect",
  "notify_user": false
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "rejected",
  "rejected_at": "2026-01-04T11:00:00Z",
  "rejected_by": "admin-uuid",
  "rejection_reason": "Invalid contact information",
  "admin_notes": "Phone number format incorrect"
}
```

**Flow:**
1. Validate lead exists
2. Check lead is in `pending_approval`
3. Validate rejection_reason is provided
4. Update lead: status → `rejected`, set rejected_at, rejected_by, rejection_reason, admin_notes
5. Audit log rejection
6. Optional: Send rejection email if notify_user=true
7. Return updated lead

**Tasks:**
- [ ] Create POST route handler
- [ ] Apply adminWithMFA middleware
- [ ] Validate request body (require reason)
- [ ] Validate lead status
- [ ] Transactionally update lead
- [ ] Audit log rejection
- [ ] Optional email notification
- [ ] Return updated lead

---

### Phase 7: Bulk Actions APIs (1 day)

**Files to Create:**
- `apps/web/app/api/v1/admin/leads/bulk-approve/route.ts`
- `apps/web/app/api/v1/admin/leads/bulk-reject/route.ts`

**Endpoint:** `POST /api/v1/admin/leads/bulk-approve`

**Request Body:**
```json
{
  "lead_ids": ["uuid1", "uuid2", "uuid3"],
  "notes": "Bulk approval batch"
}
```

**Response:**
```json
{
  "success": [
    { "lead_id": "uuid1", "status": "approved" },
    { "lead_id": "uuid2", "status": "approved" }
  ],
  "failed": [
    {
      "lead_id": "uuid3",
      "error": "Lead not in pending_approval status"
    }
  ],
  "total": 3,
  "succeeded": 2,
  "failed_count": 1
}
```

**Flow:**
1. Validate lead_ids array (max 50)
2. For each lead:
   - Validate exists
   - Check status is `pending_approval`
   - Update lead
   - Audit log
3. Return success/failure for each
4. No transaction across leads (partial success OK)

**Tasks:**
- [ ] Create bulk-approve route
- [ ] Create bulk-reject route
- [ ] Validate lead_ids array
- [ ] Process each lead individually
- [ ] Handle partial failures
- [ ] Audit log each action
- [ ] Return detailed results

---

### Phase 8: Stats API (0.5 day)

**Files to Create:**
- `apps/web/app/api/v1/admin/leads/stats/route.ts`

**Endpoint:** `GET /api/v1/admin/leads/stats`

**Response:**
```json
{
  "pending_approval_count": 15,
  "approved_today": 42,
  "rejected_today": 8,
  "average_queue_time_hours": 2.5,
  "oldest_pending_age_hours": 12.3
}
```

**Tasks:**
- [ ] Create GET route handler
- [ ] Apply adminWithMFA middleware
- [ ] Count pending_approval leads
- [ ] Count approved today
- [ ] Count rejected today
- [ ] Calculate average queue time
- [ ] Find oldest pending lead age
- [ ] Return formatted stats

---

### Phase 9: Email Templates (Optional) (0.5 day)

**Files to Modify:**
- `packages/database/seeds/email-templates.ts`

**Templates:**

1. **lead_approved**
   - Subject: "Your request has been approved!"
   - Variables: contact_name, niche_name

2. **lead_rejected**
   - Subject: "Update on your request"
   - Variables: contact_name, niche_name, rejection_reason

**Tasks:**
- [ ] Add lead_approved template to seeds
- [ ] Add lead_rejected template to seeds
- [ ] Run seed migration
- [ ] Verify templates in database

---

### Phase 10: Admin UI Components (1.5 days)

**Files to Create:**
- `apps/web/app/dashboard/leads/page.tsx` - Lead queue page
- `apps/web/app/dashboard/leads/[id]/page.tsx` - Lead detail page
- `apps/web/components/admin/LeadQueue.tsx` - Queue table component
- `apps/web/components/admin/LeadDetail.tsx` - Detail view component
- `apps/web/components/admin/BulkActions.tsx` - Bulk action controls

**Lead Queue Page:**
- Table with columns: ID, Email, Niche, Submitted, Confirmed, Actions
- Checkbox column for bulk selection
- Filter dropdowns (status, niche)
- Pagination controls
- Bulk approve/reject buttons
- Link to detail view

**Lead Detail Page:**
- Form data display (formatted per schema)
- Attribution section
- Confirmation details
- Admin notes input
- Approve/Reject buttons
- Back to queue link

**Tasks:**
- [ ] Create lead queue page
- [ ] Create lead detail page
- [ ] Build LeadQueue component
- [ ] Build LeadDetail component
- [ ] Build BulkActions component
- [ ] Add filtering UI
- [ ] Add pagination UI
- [ ] Style consistently with dashboard

---

### Phase 11: Integration & Testing (0.5 day)

**Test Scenarios:**
- [ ] List pending_approval leads
- [ ] Filter by niche
- [ ] Pagination works
- [ ] View lead details
- [ ] Approve lead (status changes)
- [ ] Reject lead (requires reason)
- [ ] Bulk approve (partial success)
- [ ] Bulk reject (partial success)
- [ ] Stats API returns correct counts
- [ ] Email notifications (if enabled)
- [ ] Audit logs created
- [ ] MFA required for all actions

**Tasks:**
- [ ] Test all API endpoints
- [ ] Test error cases (wrong status, missing reason, etc.)
- [ ] Test bulk operations
- [ ] Verify audit logging
- [ ] Test email notifications
- [ ] Integration test script

---

## File Summary

### New Files (15+)

```
apps/web/
├── app/
│   ├── api/v1/admin/leads/
│   │   ├── route.ts                    # GET list
│   │   ├── stats/
│   │   │   └── route.ts                # GET stats
│   │   ├── [id]/
│   │   │   ├── route.ts                # GET detail
│   │   │   ├── approve/
│   │   │   │   └── route.ts           # POST approve
│   │   │   └── reject/
│   │   │       └── route.ts           # POST reject
│   │   ├── bulk-approve/
│   │   │   └── route.ts               # POST bulk approve
│   │   └── bulk-reject/
│   │       └── route.ts                # POST bulk reject
│   └── dashboard/
│       └── leads/
│           ├── page.tsx                # Lead queue page
│           └── [id]/
│               └── page.tsx            # Lead detail page
├── components/
│   └── admin/
│       ├── LeadQueue.tsx               # Queue table component
│       ├── LeadDetail.tsx              # Detail view component
│       └── BulkActions.tsx             # Bulk action controls
└── lib/
    └── validations/
        └── admin-leads.ts              # Zod schemas
```

### Modified Files (3)

```
packages/database/
├── schema.sql                          # Add approval/rejection fields
└── migrate.ts                          # Add migration function

packages/database/seeds/
└── email-templates.ts                  # Add approval/rejection templates (optional)
```

---

## API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/admin/leads` | Admin+MFA | List leads (with filters) |
| GET | `/api/v1/admin/leads/stats` | Admin+MFA | Queue statistics |
| GET | `/api/v1/admin/leads/:id` | Admin+MFA | Lead details |
| POST | `/api/v1/admin/leads/:id/approve` | Admin+MFA | Approve lead |
| POST | `/api/v1/admin/leads/:id/reject` | Admin+MFA | Reject lead |
| POST | `/api/v1/admin/leads/bulk-approve` | Admin+MFA | Bulk approve |
| POST | `/api/v1/admin/leads/bulk-reject` | Admin+MFA | Bulk reject |

---

## Database Schema Changes

### Leads Table Updates
```sql
-- Admin approval fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_leads_status_created 
  ON leads(status, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_approved_at 
  ON leads(approved_at) WHERE approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_rejected_at 
  ON leads(rejected_at) WHERE rejected_at IS NOT NULL;
```

---

## Audit Log Events

| Action | Description |
|--------|-------------|
| `lead.approved` | Lead approved by admin |
| `lead.rejected` | Lead rejected by admin |
| `lead.bulk_approved` | Bulk approval executed |
| `lead.bulk_rejected` | Bulk rejection executed |

---

## Success Criteria

### MVP Complete When:
- [ ] Admin can list pending_approval leads
- [ ] Admin can view full lead details
- [ ] Admin can approve leads (status → approved)
- [ ] Admin can reject leads with reason (status → rejected)
- [ ] Bulk actions work for up to 50 leads
- [ ] All actions audit logged
- [ ] MFA required for admin actions
- [ ] Optional email notifications work
- [ ] Queue statistics displayed
- [ ] Integration tests for all endpoints
- [ ] UI components complete

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1. Database Schema | 0.5 day | 0.5 day |
| 2. Validation Schemas | 0.5 day | 1 day |
| 3. Lead List API | 1 day | 2 days |
| 4. Lead Detail API | 0.5 day | 2.5 days |
| 5. Approve API | 0.5 day | 3 days |
| 6. Reject API | 0.5 day | 3.5 days |
| 7. Bulk Actions | 1 day | 4.5 days |
| 8. Stats API | 0.5 day | 5 days |
| 9. Email Templates | 0.5 day | 5.5 days |
| 10. Admin UI | 1.5 days | 7 days |
| 11. Testing | 0.5 day | 7.5 days |

**Total Estimate:** 5-7 days

---

## Next Steps

1. **Start Phase 1**: Update database schema
2. **Run migration**: Apply changes
3. **Continue sequentially** through phases
4. **Test thoroughly** before moving to EPIC 06

---

*Created: Jan 4, 2026*  
*Last Updated: Jan 4, 2026*

