# EPIC 03 — Admin Lead Review & Approval

## Epic Goal
Enable human quality control before lead monetization. Admins review confirmed leads and approve or reject them before distribution to providers.

This epic ensures:
> **No lead may be distributed to providers until an admin has approved it.**

---

## In Scope
- Admin lead queue UI (list `pending_approval` leads)
- Lead detail view (form data, attribution, confirmation info)
- Approve/reject actions with optional notes
- Optional end-user notification on approval/rejection
- Audit logging of all admin actions
- Bulk actions for efficiency

---

## Out of Scope (MVP)
- Automatic approval rules
- AI-assisted quality scoring
- Lead editing by admins
- End-user appeal process

---

## Dependencies
- **EPIC 01** — Platform Foundation (admin auth, RBAC, audit logging)
- **EPIC 02** — Lead Intake & Confirmation (leads in `pending_approval` status)
- **EPIC 10** — Email Infrastructure (optional rejection/approval emails)

---

## Lead Status Flow

```
EPIC 02                    EPIC 03                    EPIC 06
─────────────────────────────────────────────────────────────────
                                                      
pending_confirmation       pending_approval           approved
        │                        │                       │
        │ [Confirm]              │ [Admin]               │ [Distribute]
        ▼                        ▼                       ▼
  pending_approval ─────► approved ────────────► assigned
                    │
                    │ [Admin]
                    ▼
                 rejected
```

---

## Stories & Tasks

### Story 1: Admin Lead Queue
**As an** admin  
**I want** to see all leads awaiting approval  
**So that** I can review and process them efficiently

**Acceptance Criteria**
- List all leads with `status = pending_approval`
- Sort by created_at (oldest first) by default
- Filter by niche
- Show: lead ID, submitter email, niche, created_at, confirmed_at
- Pagination (20 per page)
- Total count displayed

**Tasks**
- [ ] Implement `GET /api/v1/admin/leads` (query: status, niche_id, page, limit)
- [ ] Return lead list with pagination metadata
- [ ] Apply admin authentication + MFA middleware
- [ ] Create admin lead queue UI component

---

### Story 2: Lead Detail View
**As an** admin  
**I want** to see full lead details  
**So that** I can make an informed approval decision

**Acceptance Criteria**
- Display all form_data fields (per niche schema)
- Show submitter info (email, phone, name)
- Show confirmation details (confirmed_at, IP, user agent)
- Show attribution (UTM, referrer)
- Show creation timestamp
- Show niche name and ID

**Tasks**
- [ ] Implement `GET /api/v1/admin/leads/:id`
- [ ] Include niche details (name, form_schema for labels)
- [ ] Format form_data based on schema
- [ ] Create lead detail UI component

---

### Story 3: Lead Approval
**As an** admin  
**I want** to approve a lead  
**So that** it can be distributed to providers

**Acceptance Criteria**
- Approve action changes status: `pending_approval` → `approved`
- Sets `approved_at` timestamp
- Sets `approved_by` (admin user ID)
- Optional admin notes stored
- Audit logged (action: `lead.approved`)
- Returns updated lead

**Tasks**
- [ ] Implement `POST /api/v1/admin/leads/:id/approve`
- [ ] Add `approved_at`, `approved_by`, `admin_notes` columns to leads
- [ ] Validate lead is in `pending_approval`
- [ ] Audit log approval
- [ ] Optional: Send approval notification email to submitter

---

### Story 4: Lead Rejection
**As an** admin  
**I want** to reject a lead  
**So that** it is not distributed

**Acceptance Criteria**
- Reject action changes status: `pending_approval` → `rejected`
- Sets `rejected_at` timestamp
- Sets `rejected_by` (admin user ID)
- Requires rejection reason
- Audit logged (action: `lead.rejected`)
- Returns updated lead

**Tasks**
- [ ] Implement `POST /api/v1/admin/leads/:id/reject`
- [ ] Add `rejected_at`, `rejected_by`, `rejection_reason` columns to leads
- [ ] Require rejection_reason in request
- [ ] Validate lead is in `pending_approval`
- [ ] Audit log rejection
- [ ] Optional: Send rejection notification email to submitter

---

### Story 5: Bulk Lead Actions
**As an** admin  
**I want** to approve/reject multiple leads at once  
**So that** I can work efficiently

**Acceptance Criteria**
- Bulk approve: approve all selected leads
- Bulk reject: reject all selected leads (same reason)
- Partial success handling (some may fail)
- Returns list of successes and failures
- Audit logged per lead

**Tasks**
- [ ] Implement `POST /api/v1/admin/leads/bulk-approve`
- [ ] Implement `POST /api/v1/admin/leads/bulk-reject`
- [ ] Accept array of lead IDs
- [ ] Return success/failure for each
- [ ] Transactional consistency per lead

---

### Story 6: Lead Review Dashboard Stats
**As an** admin  
**I want** to see queue statistics  
**So that** I understand workload

**Acceptance Criteria**
- Show total pending_approval count
- Show leads approved today
- Show leads rejected today
- Show average time in queue

**Tasks**
- [ ] Implement `GET /api/v1/admin/leads/stats`
- [ ] Calculate approval/rejection counts
- [ ] Calculate queue wait times

---

### Story 7: Admin Notes
**As an** admin  
**I want** to add notes to a lead  
**So that** context is preserved for other admins

**Acceptance Criteria**
- Notes field on lead (admin_notes TEXT)
- Notes visible only to admins
- Notes preserved through status changes
- Optional on approval/rejection

**Tasks**
- [ ] Add admin_notes column to leads
- [ ] Include in approve/reject endpoints
- [ ] Display in lead detail view

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

## Validation Schemas

### Approve Request
```typescript
{
  notes?: string // max 1000 chars
  notify_user?: boolean // default false
}
```

### Reject Request
```typescript
{
  reason: string // required, max 500 chars
  notes?: string // max 1000 chars
  notify_user?: boolean // default false
}
```

### Bulk Approve Request
```typescript
{
  lead_ids: string[] // UUIDs, max 50
  notes?: string
}
```

### Bulk Reject Request
```typescript
{
  lead_ids: string[] // UUIDs, max 50
  reason: string // required
  notes?: string
}
```

---

## UI Components

### Lead Queue Page (`/dashboard/leads`)
- Table with columns: ID, Email, Niche, Submitted, Confirmed, Actions
- Checkbox for bulk selection
- Bulk action buttons
- Pagination controls
- Filter dropdowns (status, niche)

### Lead Detail Modal/Page
- Form data display (formatted per schema)
- Attribution section
- Confirmation details
- Action buttons (Approve/Reject)
- Notes input

---

## Error Handling

| Code | Condition |
|------|-----------|
| 400 | Missing rejection reason |
| 400 | Lead not in pending_approval |
| 404 | Lead not found |
| 409 | Lead already approved/rejected |
| 422 | Bulk action partial failure |

---

## Audit Log Events

| Action | Description |
|--------|-------------|
| `lead.approved` | Lead approved by admin |
| `lead.rejected` | Lead rejected by admin |
| `lead.notes_added` | Admin notes updated |
| `lead.bulk_approved` | Bulk approval executed |
| `lead.bulk_rejected` | Bulk rejection executed |

---

## Email Templates (Optional)

### lead_approved
```
Subject: Your request has been approved!
Variables: contact_name, niche_name
```

### lead_rejected
```
Subject: Update on your request
Variables: contact_name, niche_name, rejection_reason (sanitized)
```

---

## Definition of Done

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

## Notes

- Leads must be in `pending_approval` to be approved/rejected
- Approved leads become eligible for distribution (EPIC 06)
- Rejected leads are terminal (no recovery in MVP)
- Email notifications are optional and off by default
- Admin notes are internal only (never shown to users)

---

## Estimated Effort

| Task | Duration |
|------|----------|
| Database schema | 0.5 day |
| List/detail APIs | 1 day |
| Approve/reject APIs | 0.5 day |
| Bulk actions | 0.5 day |
| Stats API | 0.5 day |
| Admin UI | 1.5 days |
| Testing | 0.5 day |
| **Total** | **5 days** |

