# EPIC 09 — Bad Lead & Refunds (LOCKED)

## Epic Goal
Provide a controlled, auditable workflow for service providers to report bad leads and for admins to review, approve, or reject refunds—while preventing abuse, ensuring billing correctness, and maintaining fairness and platform integrity.

---

## Architecture Alignment (v11_4 LOCKED)
This epic aligns with the locked architecture and the EPIC 06/07 schemas and contracts:

- **Lead assignments are the system of record** for bad lead reporting and refund outcomes (stored on `lead_assignments`).
- **Refunds are credited via the Provider Ledger** (`provider_ledger`) using entry_type = `refund` and must include:
  - `related_lead_id`, `related_subscription_id`, `related_payment_id` (nullable for refunds), `actor_id`, `actor_role`, `memo`, and **`balance_after`**.
- **Subscription status updates** after refund/deposit follow EPIC 07:
  - `checkAndUpdateSubscriptionStatus(provider_id)` (or subscription-scoped variant if implemented)
- **Notifications** use EPIC 10 email infrastructure and preferences.

---

## In Scope (MVP)
- Provider reports a bad lead for a specific assignment (once per assignment)
- Admin queue for pending bad lead requests with filtering/pagination
- Admin approve/refund or reject with required memo
- Ledger credit + assignment refund markers (atomic)
- Provider refund history view (paginated)
- Abuse controls (daily report limit, analytics flags)
- Audit logging for provider/admin/system actions
- Metrics and alerts integration (EPIC 12)

---

## Out of Scope (MVP)
- Automatic refunds (no auto-approve)
- Provider “lead preview” before assignment
- Chargebacks/disputes with Stripe/PayPal processors
- Multi-step appeals workflow
- Provider-to-end-user communications
- Automatic provider penalties (flags only, admin review)

---

## Key Principles
- **Financial Safety**: refunds must mirror the original charge and never exceed it.
- **Determinism & Idempotency**: repeated requests must not duplicate refunds or create inconsistent state.
- **Auditability**: every decision is traceable with memo + actor identity.
- **Abuse Resistance**: enforce daily limits, track patterns, surface flags to admins.
- **Separation of Concerns**: email events are informational; billing logic remains within EPIC 07.

---

## Dependencies
- **EPIC 01** — Platform Foundation & Access Control (RBAC/MFA, audit_log)
- **EPIC 06** — Distribution Engine (lead_assignments creation, status fields)
- **EPIC 07** — Billing & Payments (provider_ledger, refunds, balance maintenance, subscription status checks)
- **EPIC 08** — Provider Lead Management (provider actions on assignments)
- **EPIC 10** — Email Infrastructure (notifications + templates)
- **EPIC 12** — Observability & Ops (BullMQ, metrics, alerts)

---

## Database Schema Updates

> Note: EPIC 06 locked schema already includes:
- `bad_lead_reported_at TIMESTAMPTZ`
- `bad_lead_reason TEXT` (we will **split into category + notes** below for analytics)
- `bad_lead_status VARCHAR(20) CHECK (IN ('pending','approved','rejected'))`
- `refunded_at TIMESTAMPTZ`
- `refund_amount DECIMAL(10,2)`
- `refund_reason TEXT` (used as **admin memo**)

### 1) Lead Assignments: Reason Category + Notes (Recommended)
```sql
ALTER TABLE lead_assignments
  ADD COLUMN IF NOT EXISTS bad_lead_reason_category VARCHAR(50)
    CHECK (bad_lead_reason_category IN ('spam','duplicate','invalid_contact','out_of_scope','other')),
  ADD COLUMN IF NOT EXISTS bad_lead_reason_notes TEXT;

-- Optional: keep existing bad_lead_reason for backwards compatibility
-- and map it to bad_lead_reason_notes in the app layer.
```

### 2) Required Indexes
```sql
-- Admin list (Story 2)
CREATE INDEX IF NOT EXISTS idx_lead_assignments_bad_lead_status
  ON lead_assignments(bad_lead_status, bad_lead_reported_at DESC)
  WHERE bad_lead_status IS NOT NULL;

-- Admin filtering by provider
CREATE INDEX IF NOT EXISTS idx_lead_assignments_bad_lead_provider
  ON lead_assignments(provider_id, bad_lead_status, bad_lead_reported_at DESC)
  WHERE bad_lead_status IS NOT NULL;

-- Admin filtering by niche
CREATE INDEX IF NOT EXISTS idx_lead_assignments_bad_lead_niche
  ON lead_assignments(niche_id, bad_lead_status, bad_lead_reported_at DESC)
  WHERE bad_lead_status IS NOT NULL;

-- Provider history (Story 6)
CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_bad_leads
  ON lead_assignments(provider_id, bad_lead_reported_at DESC)
  WHERE bad_lead_reported_at IS NOT NULL;
```

---

## Stories & Tasks

### Story 1: Provider Reports a Bad Lead (Categorized + Idempotent)
**As a** service provider  
**I want** to report a bad lead for an assigned lead  
**So that** I can request a refund review when the lead is invalid

#### Acceptance Criteria
- Provider can report a bad lead **only for assignments belonging to them**
- Provider can report **only once per assignment**
- Provider must select a **reason category**:
  - `spam` – Spam/bot submission
  - `duplicate` – Already received
  - `invalid_contact` – Wrong/unreachable contact info
  - `out_of_scope` – Does not match service area/filters
  - `other` – Requires notes
- Notes rules:
  - If category = `other`: notes **required** (min 10 chars, max 500)
  - Otherwise: notes optional (max 500)
- On report:
  - `lead_assignments.bad_lead_reported_at = NOW()`
  - `bad_lead_status = 'pending'`
  - Store `bad_lead_reason_category` and `bad_lead_reason_notes`
- **Idempotency behavior**:
  - If already reported and status is `pending`: return **200 OK** with existing report
  - If already resolved (`approved`/`rejected`): return **409 Conflict**
- Abuse prevention hook (Story 5): enforce daily report limit (default 5/day/provider)
- Audit event recorded: `bad_lead_reported` (actor_role = provider)

#### Tasks
- POST `/api/v1/provider/assignments/:assignmentId/bad-lead`
  - Validate assignment belongs to provider
  - Validate assignment is eligible for report (not refunded, not already resolved)
  - Validate `reason_category` enum and notes constraints
  - Apply idempotency behavior described above
- Persist fields (transaction):
  - `bad_lead_reported_at`, `bad_lead_status='pending'`, `bad_lead_reason_category`, `bad_lead_reason_notes`
- Enforce daily report limit (Story 5)
- Write audit_log entry (`bad_lead_reported`)
- (Optional) Queue provider confirmation email: `bad_lead_reported_confirmation` (Epic 10)

---

### Story 2: Admin Review Queue for Bad Lead Requests (Filters + Pagination)
**As an** admin  
**I want** to review pending bad lead requests in a queue  
**So that** I can approve legitimate refunds and reject invalid disputes

#### Acceptance Criteria
- Admin can list bad lead requests with filters:
  - `status` (pending/approved/rejected, default: pending)
  - `niche_id` (optional)
  - `provider_id` (optional)
  - `reason_category` (optional)
  - `reported_from`, `reported_to` (optional date range)
- Pagination:
  - default `limit=50`, max `limit=100`
- Sorted by `bad_lead_reported_at DESC` (newest first)
- Response includes:
  - assignment_id, lead_id, provider_id, provider_name
  - niche_id, niche_name
  - bad_lead_reported_at
  - bad_lead_reason_category, bad_lead_reason_notes
  - bad_lead_status
  - price_charged (refund_amount target)

#### Tasks
- GET `/api/v1/admin/bad-leads?status=pending&page=1&limit=50&niche_id=&provider_id=&reason_category=&reported_from=&reported_to=`
  - Add pagination + total_count/total_pages
  - Add filters + sorting
  - Enforce RBAC + MFA (Epic 01)
- Add indexes (see schema section)
- Admin detail endpoint (optional but recommended):
  - GET `/api/v1/admin/bad-leads/:assignmentId` (includes lead form_data + assignment billing context + history)

---

### Story 3: Admin Approves a Bad Lead Refund (Atomic Refund + Reactivation)
**As an** admin  
**I want** to approve a bad lead request and refund the provider  
**So that** providers are not charged for invalid leads

#### Acceptance Criteria
- Admin can approve only if:
  - `bad_lead_status = 'pending'`
  - `bad_lead_reported_at IS NOT NULL`
  - assignment has not already been refunded (`refunded_at IS NULL`)
- Admin memo is **required** and stored in `lead_assignments.refund_reason`
  - min 10 chars, max 1000 chars
- Refund amount rules:
  - Refund amount equals **original charge** from `lead_assignments.price_charged`
  - Refund cannot exceed original charge
  - Each assignment can be refunded **only once**
- On approval (atomic transaction):
  - Update assignment:
    - `bad_lead_status='approved'`
    - `refunded_at=NOW()`
    - `refund_amount=price_charged`
    - `refund_reason=admin_memo`
  - Create provider_ledger entry: `entry_type='refund'`
    - references: related_lead_id, related_subscription_id, actor_id, actor_role='admin'
    - memo includes admin memo
    - balance_after populated (Epic 07)
  - Update cached provider balance (Epic 07)
  - Trigger subscription recheck (Epic 07): `checkAndUpdateSubscriptionStatus(provider_id)`
- Notification:
  - Template: `bad_lead_approved`
  - Preference: `notify_on_bad_lead_decision` (default true)
  - Includes: lead_id, niche_name, refund_amount, admin memo, refunded_at, (optional) new_balance
- Idempotency:
  - If already approved: return 200 with current state
  - If already rejected: return 409

#### Tasks
- POST `/api/v1/admin/bad-leads/:assignmentId/approve`
  - Request: `{ "admin_memo": "..." }`
  - Validate memo length
  - Validate pending state + refund eligibility
  - Load original `price_charged`
  - Transaction:
    - update assignment fields
    - call EPIC 07: `createRefundLedgerEntry(...)` (writes provider_ledger, updates provider balance, populates balance_after)
    - call EPIC 07: `checkAndUpdateSubscriptionStatus(provider_id)`
  - Audit log:
    - `bad_lead_approved` (actor_role=admin)
    - `bad_lead_refund_processed` (actor_role=system) if you separate processing
- Queue email (Epic 10): `bad_lead_approved`

---

### Story 4: Admin Rejects a Bad Lead Request (Memo + Notification)
**As an** admin  
**I want** to reject invalid bad lead requests  
**So that** refunds are granted only when warranted

#### Acceptance Criteria
- Admin can reject only if `bad_lead_status='pending'`
- Admin memo required (min 10, max 1000) stored in `lead_assignments.refund_reason`
- On reject:
  - `bad_lead_status='rejected'`
  - `refund_reason=admin_memo`
  - No ledger credit is created
- Notification:
  - Template: `bad_lead_rejected`
  - Preference: `notify_on_bad_lead_decision` (default true)
  - Includes: lead_id, niche_name, admin memo, reviewed_at
- Idempotency:
  - If already rejected: return 200 with current state
  - If already approved: return 409

#### Tasks
- POST `/api/v1/admin/bad-leads/:assignmentId/reject`
  - Request: `{ "admin_memo": "..." }`
  - Validate pending state
  - Update assignment (transaction)
  - Write audit_log entry `bad_lead_rejected`
- Queue email (Epic 10): `bad_lead_rejected`

---

### Story 5: Abuse Prevention & Rate Limiting (Reports)
**As a** system  
**I want** to prevent excessive bad lead reporting  
**So that** the workflow cannot be abused to avoid payment

#### Acceptance Criteria
- Daily report limit enforced at report time (Story 1):
  - Max reports per provider per day: configurable (default 5)
  - Enforced via Redis counter:
    - key: `bad_lead_reports:{provider_id}:{YYYY-MM-DD}`
    - TTL: 24 hours
  - If exceeded: **429 Too Many Requests**
    - Response includes limit and reset_at
- Abuse analytics flags (admin visibility only):
  - Flag provider if refund approval rate > 50% over 30 days
  - Flag provider if total refunds > 20% of assignments over 30 days
  - No automatic penalties in MVP

#### Tasks
- Implement Redis counter increment/check in Story 1
- Add config values:
  - `BAD_LEAD_REPORTS_DAILY_LIMIT=5`
- Implement flag computation as part of Story 7 metrics (or scheduled job)
- Emit metrics (Epic 12):
  - `bad_lead_reports_total`, `bad_lead_reports_rate_limited_total`

---

### Story 6: Provider Views Bad Lead / Refund History (Paginated)
**As a** service provider  
**I want** to see my bad lead reports and outcomes  
**So that** I can track pending reviews and completed refunds

#### Acceptance Criteria
- Provider can list their bad lead history
- Filters:
  - `status` (pending/approved/rejected) optional
  - date range optional (`reported_from`, `reported_to`)
- Pagination: default 50, max 100
- Response includes:
  - assignment_id, lead_id, niche_name
  - bad_lead_reported_at
  - reason_category, reason_notes
  - bad_lead_status
  - refund_amount, refunded_at (if approved)
  - admin_memo (refund_reason) when resolved

#### Tasks
- GET `/api/v1/provider/bad-leads?page=1&limit=50&status=&reported_from=&reported_to=`
  - Query lead_assignments by provider_id
  - Enforce RBAC provider-only
  - Return pagination metadata

---

### Story 7: Admin Metrics & Monitoring Dashboard (Refund Health)
**As an** admin  
**I want** metrics and breakdowns for bad lead reporting/refunds  
**So that** I can monitor lead quality and detect abuse patterns

#### Acceptance Criteria
- Admin can fetch metrics for a date range (default last 30 days)
- Breakdown by niche, provider, and reason category
- Includes abuse flags per provider (informational only)

#### API
- GET `/api/v1/admin/bad-leads/metrics?date_from=&date_to=&niche_id=&provider_id=`

#### Tasks
- Implement aggregation queries
- Cache results (Redis, 5-min TTL)
- Include flags:
  - approval_rate, refund_rate
  - flagged boolean
- Enforce RBAC + MFA

---

## API Endpoints (Detailed)

### Provider: Report Bad Lead
**POST** `/api/v1/provider/assignments/:assignmentId/bad-lead`  
**Request**
```json
{
  "reason_category": "invalid_contact",
  "reason_notes": "Phone number disconnected"
}
```
**Response 201**
```json
{
  "ok": true,
  "assignment_id": "uuid",
  "bad_lead_status": "pending",
  "bad_lead_reported_at": "2026-01-02T15:00:00Z"
}
```
**Errors**
- 400 `{ "error": "Invalid reason_category" }`
- 400 `{ "error": "reason_notes required for category=other" }`
- 403 `{ "error": "Access denied" }`
- 404 `{ "error": "Assignment not found" }`
- 409 `{ "error": "Already resolved" }`
- 429 `{ "error": "Report limit exceeded", "limit": 5, "reset_at": "2026-01-03T00:00:00Z" }`

### Admin: List Bad Lead Requests
**GET** `/api/v1/admin/bad-leads?status=pending&page=1&limit=50&niche_id=&provider_id=&reason_category=&reported_from=&reported_to=`  
**Response 200**
```json
{
  "page": 1,
  "limit": 50,
  "total_count": 12,
  "total_pages": 1,
  "items": [
    {
      "assignment_id": "uuid",
      "lead_id": "uuid",
      "provider_id": "uuid",
      "provider_name": "ABC Roofing",
      "niche_id": "uuid",
      "niche_name": "Roofing",
      "bad_lead_reported_at": "2026-01-02T12:00:00Z",
      "bad_lead_reason_category": "invalid_contact",
      "bad_lead_reason_notes": "Phone number disconnected",
      "bad_lead_status": "pending",
      "price_charged": 25.00
    }
  ]
}
```
**Errors**
- 403 `{ "error": "Access denied" }`

### Admin: Approve Bad Lead
**POST** `/api/v1/admin/bad-leads/:assignmentId/approve`  
**Request**
```json
{
  "admin_memo": "Verified - phone number is invalid. Refund approved."
}
```
**Response 200**
```json
{
  "ok": true,
  "assignment_id": "uuid",
  "bad_lead_status": "approved",
  "refund_amount": 25.00,
  "refunded_at": "2026-01-02T14:00:00Z"
}
```
**Errors**
- 400 `{ "error": "Invalid memo" }`
- 404 `{ "error": "Assignment not found" }`
- 409 `{ "error": "Already resolved" }`

### Admin: Reject Bad Lead
**POST** `/api/v1/admin/bad-leads/:assignmentId/reject`  
**Request**
```json
{
  "admin_memo": "Lead appears valid. Contact info works. Rejection denied."
}
```
**Response 200**
```json
{
  "ok": true,
  "assignment_id": "uuid",
  "bad_lead_status": "rejected"
}
```
**Errors**
- 400 `{ "error": "Invalid memo" }`
- 404 `{ "error": "Assignment not found" }`
- 409 `{ "error": "Already resolved" }`

### Provider: View Bad Lead History
**GET** `/api/v1/provider/bad-leads?page=1&limit=50&status=&reported_from=&reported_to=`  
**Response 200**
```json
{
  "page": 1,
  "limit": 50,
  "total_count": 12,
  "total_pages": 1,
  "items": [
    {
      "assignment_id": "uuid",
      "lead_id": "uuid",
      "niche_name": "Roofing",
      "bad_lead_reported_at": "2026-01-01T10:00:00Z",
      "bad_lead_reason_category": "invalid_contact",
      "bad_lead_reason_notes": "Phone number disconnected",
      "bad_lead_status": "approved",
      "refund_amount": 25.00,
      "refunded_at": "2026-01-02T14:00:00Z",
      "admin_memo": "Verified - phone number is invalid"
    }
  ]
}
```
**Errors**
- 403 `{ "error": "Access denied" }`

### Admin: Metrics
**GET** `/api/v1/admin/bad-leads/metrics?date_from=&date_to=&niche_id=&provider_id=`  
**Response 200**
```json
{
  "period": { "from": "2025-12-03", "to": "2026-01-02" },
  "summary": {
    "total_reports": 150,
    "total_approved": 90,
    "total_rejected": 60,
    "approval_rate": 0.60,
    "total_refund_amount": 2250.00,
    "avg_resolution_time_hours": 18.5
  },
  "by_reason": [
    { "reason_category": "invalid_contact", "count": 60, "approval_rate": 0.75 },
    { "reason_category": "duplicate", "count": 40, "approval_rate": 0.50 }
  ],
  "by_provider": [
    { "provider_id": "uuid", "provider_name": "ABC Roofing", "total_reports": 10, "approval_rate": 0.80, "total_refund_amount": 200.00, "flagged": false }
  ]
}
```

---

## Audit Log Events (EPIC 01 Integration)

### Provider Actions
- `bad_lead_reported`
  - actor_role: `provider`
  - metadata: { assignment_id, lead_id, reason_category, reason_notes }

### Admin Actions
- `bad_lead_approved`
  - actor_role: `admin`
  - metadata: { assignment_id, lead_id, provider_id, refund_amount, admin_memo }

- `bad_lead_rejected`
  - actor_role: `admin`
  - metadata: { assignment_id, lead_id, provider_id, admin_memo }

### System Actions
- `bad_lead_refund_processed`
  - actor_role: `system`
  - metadata: { assignment_id, ledger_entry_id, refund_amount, balance_after }

---

## EPIC 10 Integration (Email Templates)

### Provider Templates
- `bad_lead_reported_confirmation`
  - When: after provider submits report
  - Vars: provider_name, lead_id, niche_name, reported_at, expected_review_time

- `bad_lead_approved`
  - When: admin approves
  - Vars: provider_name, lead_id, niche_name, refund_amount, admin_memo, refunded_at, new_balance (optional)

- `bad_lead_rejected`
  - When: admin rejects
  - Vars: provider_name, lead_id, niche_name, admin_memo, reviewed_at

### Admin Templates (Optional)
- `bad_lead_reported_admin_alert`
  - When: provider reports bad lead
  - Vars: provider_name, lead_id, niche_name, reason_category, reason_notes, reported_at

### Notification Preferences
- Provider: `notify_on_bad_lead_decision` (default: true)
- Admin: `notify_on_bad_lead_report` (default: false for MVP)

---

## Observability & Alerts (EPIC 12 Integration)

### Metrics
- `bad_lead_reports_total`
- `bad_lead_reports_rate_limited_total`
- `bad_lead_approvals_total`
- `bad_lead_rejections_total`
- `bad_lead_resolution_time_hours`
- `bad_lead_refund_amount_total`

### Alerts
- High refund approval rate per provider: > 50% over 30 days
- Spike in reports: > 2× baseline (7-day avg)
- Slow admin queue: p95 > 1s
- Errors approving/rejecting: > 5/min
- Rate-limit hits: > 20/day/provider (abuse signal)

---

## Testing Requirements

### Unit Tests
- Reason category validation + notes constraints
- Memo validation (min/max)
- Idempotency behavior (pending vs resolved)
- Refund eligibility validation
- Daily limit enforcement logic

### Integration Tests
- Provider report → admin approve → ledger credit → subscription status check → notification
- Provider report → admin reject → notification
- Duplicate report while pending returns 200 with existing state
- Duplicate report after resolution returns 409
- Approve already approved returns 200 (idempotent)

### Race Condition Tests
- Concurrent approve attempts on same assignment (only one refund created)
- Concurrent reject attempts on same assignment
- Concurrent approve + reject (mutual exclusivity enforced)
- Concurrent report attempts (only one pending report created)

### Idempotency Tests
- Duplicate approve calls (no double ledger credit)
- Duplicate webhook-like triggers (if refund processing decoupled) do not double credit

### Performance Tests
- Admin queue list p95 < 500ms for 10k assignments (indexed)
- Provider history list p95 < 500ms

---

## Definition of Done
- Reason categories implemented with optional notes and validation
- Provider can report once per assignment with correct idempotent behavior
- Admin can list, filter, and paginate bad lead requests
- Admin approval creates refund atomically (assignment + ledger + balance update)
- Admin memo stored in `lead_assignments.refund_reason` with validation
- Subscription status rechecked after refund (Epic 07 integration)
- Provider history endpoint implemented with pagination/filtering
- Daily abuse limits enforced with correct 429 response
- Audit log events implemented for provider/admin/system actions
- Notifications implemented via Epic 10 with preference keys
- Metrics emitted and alerts configured (Epic 12)
- All unit/integration/race-condition tests pass
