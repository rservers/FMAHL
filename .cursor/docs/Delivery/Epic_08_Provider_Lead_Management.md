# Epic 08 — Provider Lead Management (LOCKED v2)

## Purpose
Enable providers to **receive, review, act on, and manage assigned leads** safely, fairly, and observably, while integrating cleanly with Distribution (Epic 06), Billing (Epic 07), Notifications (Epic 10), and Observability (Epic 12).

---

## Architecture Alignment (Confirmed)

- Uses `lead_assignments` as the source of truth (Epic 06)
- Reads billing context from Epic 07 (`price_charged`, ledger linkage)
- Notifications delegated to Epic 10
- Metrics & alerts delegated to Epic 12

---

## Database Schema Updates

### Required Indexes (Inbox, Search, Filtering)

```sql
-- Inbox performance
CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_assigned
  ON lead_assignments(provider_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_status
  ON lead_assignments(provider_id, status);

-- Filtering by niche + date
CREATE INDEX IF NOT EXISTS idx_lead_assignments_provider_niche_assigned
  ON lead_assignments(provider_id, niche_id, assigned_at DESC);

-- Search
CREATE INDEX IF NOT EXISTS idx_leads_contact_email
  ON leads(contact_email);

CREATE INDEX IF NOT EXISTS idx_leads_contact_phone
  ON leads(contact_phone);

CREATE INDEX IF NOT EXISTS idx_leads_contact_email_lower
  ON leads(LOWER(contact_email));
```

---

## Story 1 — Provider Inbox (List, Filter, Search)

**As a** provider  
**I want** an inbox of assigned leads  
**So that** I can triage and act efficiently

### Acceptance Criteria
- Lists only leads assigned to provider
- Supports filters:
  - status
  - niche_id
  - date range (assigned_at)
- Search by:
  - contact_email (partial, case-insensitive)
  - contact_phone (partial)
- Pagination: default 25, max 100
- Sorted by `assigned_at DESC`

### Endpoint
`GET /api/v1/provider/leads`

### Errors
- 403: Access denied
- 400: Invalid filters

---

## Story 2 — Lead Detail View

### Acceptance Criteria
- Provider can view full lead detail
- Includes:
  - lead info
  - form_data (labeled)
  - **billing context**:
    ```json
    {
      "price_charged": 25.00,
      "charged_at": "2026-01-02T15:00:00Z",
      "competition_level": "Standard",
      "subscription_id": "uuid"
    }
    ```
- Attribution fields shown **only if** `SHOW_ATTRIBUTION_TO_PROVIDERS=true`
  - utm_source
  - utm_medium
  - utm_campaign
  - referrer_url
- Lead is automatically marked as viewed when accessed

### Endpoint
`GET /api/v1/provider/leads/:leadId`

### Errors
- 404: Lead not found or not assigned
- 403: Access denied

---

## Story 3 — Automatic Viewed Tracking

- `viewed_at` is set automatically on first successful GET lead detail
- No separate POST endpoint required

---

## Story 4 — Accept Lead

### Acceptance Criteria
- Provider can accept only once
- Uses row-level locking
- Status transitions to `accepted`
- (Optional) Admin notified if `notify_admin_on_provider_accept=true` (default false)

### Endpoint
`POST /api/v1/provider/leads/:leadId/accept`

### Errors
- 409: Already accepted/rejected
- 403: Access denied

---

## Story 5 — Reject Lead

### Acceptance Criteria
- Provider must provide rejection_reason
- Status transitions to `rejected`
- Admin notified if `notify_admin_on_provider_reject=true` (default true)
- Template: `admin_provider_rejected_lead`

### Endpoint
`POST /api/v1/provider/leads/:leadId/reject`

### Errors
- 409: Already accepted/rejected
- 400: Missing reason

---

## Story 6 — Provider Notification Preferences

**Dependency**: Epic 10

### Endpoint
`PATCH /api/v1/provider/notification-preferences`

```json
{
  "notify_on_new_lead": false,
  "notify_on_lead_status_change": false
}
```

**Response**
```json
{
  "ok": true,
  "preferences": {
    "notify_on_new_lead": false,
    "notify_on_lead_status_change": false
  }
}
```

---

## Story 7 — Lead Export

### Acceptance Criteria
- Max 5 exports/day/provider
- Max 5000 rows/export
- Async CSV generation
- Email download link

### Errors
- 429:
```json
{
  "error": "Export limit exceeded",
  "limit": 5,
  "reset_at": "2026-01-03T00:00:00Z"
}
```
- 400: Export too large

---

## Observability & Alerts (Epic 12)

### Metrics
- provider_inbox_query_ms
- leads_accepted_total
- leads_rejected_total
- export_requests_total

### Alerts
- Rejection rate > 30% in 24h
- Inbox p95 latency > 1s
- Accept/reject errors > 5/min
- Export abuse > 10 attempts/day

---

## Testing

### Unit Tests
- Inbox filtering
- Automatic viewed tracking
- Accept/reject validation
- Notification preference logic

### Race Condition Tests
- Concurrent accept attempts
- Concurrent reject attempts
- Accept vs reject collision
- View + accept concurrency

### Integration Tests
- Epic 06 assignment visibility
- Epic 07 billing context accuracy
- Epic 10 notifications delivered
- Epic 12 metrics emitted

---

## Definition of Done
- Schema & indexes applied
- Inbox performant < 300ms p95
- Accept/reject atomic & safe
- Attribution gated by config
- Notifications verified (Epic 10)
- Metrics & alerts live (Epic 12)
- Docs complete
