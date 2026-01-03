
# Epic 10 — Notifications & Email Infrastructure (LOCKED)

## Overview
This epic defines the **email and notification infrastructure** for Find Me a Hot Lead.
It provides a **generic, provider-agnostic email abstraction**, supports **environment‑specific delivery**, manages **versioned templates**, records **email events**, and integrates with **BullMQ** for reliable delivery.

Epic 10 is **infrastructure**, not business logic:
- Emails **do not** drive workflow decisions
- Emails **never** change system state
- All email operations are **observable, auditable, and retry-safe**

---

## Goals
- Single email abstraction used by all features
- Environment‑specific delivery (MailHog, SES)
- Versioned, database‑driven templates
- Reliable async delivery with retries + DLQ
- Secure webhook handling for delivery events
- Clear audit trail for admin-triggered emails

---

## Non‑Goals (MVP)
- SMS / Push notifications
- In‑app notifications
- Email-based business logic
- Template localization / i18n (future)
- Marketing campaigns or bulk newsletters

---

## Architecture Alignment
- **Queues:** BullMQ (Epic 12)
- **Metrics / Alerts:** Prometheus + Alertmanager (Epic 12)
- **Audit Logs:** Epic 01
- **Billing / Balance Alerts:** Epic 07
- **Lead Confirmation & Provider Alerts:** Epics 02, 06, 08, 09

---

## Story 1 — Email Provider Abstraction
**As a** system  
**I want** a generic email provider abstraction  
**So that** email delivery can change without affecting business logic

### Acceptance Criteria
- Email sending uses a single interface
- Provider selected by environment
- Providers are swappable without code changes
- Health checks available per provider

### Tasks
- Define `EmailProvider` interface (`sendEmail`, `sendBulk`)
- Implement MailHog adapter (dev + staging)
- Implement Amazon SES adapter (production)
- Implement console logger adapter (tests)
- Environment-based provider resolution
- Provider health check support

---

## Story 2 — Environment‑Specific Delivery
**As a** developer  
**I want** predictable email behavior per environment  
**So that** testing never sends real emails unintentionally

### Acceptance Criteria
- Dev & Staging: MailHog SMTP (port 1025)
- MailHog UI available on `localhost:8025`
- Production: Amazon SES with verified domains
- Staging can optionally restrict domains
- Environment routing enforced server-side

### Tasks
- Configure MailHog for local + staging
- Configure SES sandbox vs production
- Domain whitelist support (staging)
- Document setup in README

---

## Story 3 — Email Template Management
**As an** admin  
**I want** to manage email templates without deployments  
**So that** content can evolve safely

### Database Schema
```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(100) UNIQUE NOT NULL,
  version INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tasks
- CRUD APIs for templates
- Template preview endpoint
- Versioning on update
- Variable validation before send
- Auto-generate variable documentation from schema

---

## Story 4 — Core Email Types
### Required Templates
- `lead_confirmation`
- `lead_confirmation_expired`
- `provider_new_lead`
- `provider_low_balance`
- `bad_lead_approved`
- `bad_lead_rejected`
- `password_reset`
- `email_verification`
- `admin_lead_pending_approval`

### Tasks
- Seed default templates
- Define required variables per template
- HTML + text versions
- Validation utilities

---

## Story 5 — Email Event Tracking
### Schema
```sql
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(50),
  recipient_email VARCHAR(255),
  event_type VARCHAR(20) CHECK (event_type IN ('sent','delivered','opened','bounced','complained')),
  provider VARCHAR(50),
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tasks
- Persist `sent` on enqueue
- Persist provider events via webhooks
- Read‑only admin UI

---

## Story 6 — Provider Webhooks
### Acceptance Criteria
- SES SNS signature verification
- Idempotent processing
- Invalid signatures rejected (401)

### Tasks
- `/api/v1/webhooks/ses`
- Normalize events
- Rate limit endpoints
- Idempotency checks

---

## Story 7 — Email Send Auditing
### Acceptance Criteria
- Admin‑triggered emails audited
- System emails logged only
- Failed sends audited

### Tasks
- Integrate with audit_log
- Capture provider + template metadata

---

## Story 8 — Email Retry & Failure Handling
**As a** system  
**I want** retries and DLQ handling  
**So that** transient failures don’t lose emails

### Acceptance Criteria
- BullMQ queue
- 3 retries with exponential backoff
- Dead letter queue
- Admin visibility

---

## Story 9 — Email Rate Limiting
### Acceptance Criteria
- SES sandbox limits respected
- Provider‑specific throttling
- Alerts when nearing limits

---

## Queue Configuration (Reference)
- Queue: `email_send`
- Concurrency: 10
- Retries: 3
- Backoff: 1s → 5s → 25s
- Timeout: 30s
- Rate Limit: SES‑aware

---

## Metrics (Optional)
- `fmhl_emails_sent_total`
- `fmhl_emails_failed_total`
- `fmhl_email_send_duration_ms`
- `fmhl_email_queue_depth`

---

## API Endpoints (Admin)
- POST /api/v1/admin/email-templates
- GET /api/v1/admin/email-templates
- GET /api/v1/admin/email-templates/:id
- PUT /api/v1/admin/email-templates/:id
- DELETE /api/v1/admin/email-templates/:id
- POST /api/v1/admin/email-templates/:id/preview
- GET /api/v1/admin/email-events

---


## Optional Enhancements

### A. API Request/Response Schemas (Admin)

> These schemas are optional for the epic (developers can infer), but included here to remove ambiguity and speed up implementation.

#### POST /api/v1/admin/email-templates
**RBAC:** Admin (MFA required)

**Request**
```json
{
  "template_key": "lead_confirmation",
  "subject": "Confirm your lead",
  "body_html": "<html>...</html>",
  "body_text": "Hi {{contact_name}} ...",
  "variables": ["contact_name", "confirmation_link", "niche_name", "expires_at"]
}
```

**Response 201**
```json
{
  "id": "uuid",
  "version": 1,
  "template_key": "lead_confirmation",
  "is_active": true
}
```

**Errors**
- 400
```json
{ "error": "Invalid template variables", "details": ["expires_at must be datetime"] }
```
- 409
```json
{ "error": "Template key already exists" }
```

#### GET /api/v1/admin/email-templates
**RBAC:** Admin (MFA required)

**Response 200**
```json
{
  "templates": [
    {
      "id": "uuid",
      "template_key": "lead_confirmation",
      "version": 3,
      "is_active": true,
      "updated_at": "2026-01-02T14:30:00Z"
    }
  ]
}
```

#### GET /api/v1/admin/email-templates/:id
**RBAC:** Admin (MFA required)

**Response 200**
```json
{
  "id": "uuid",
  "template_key": "lead_confirmation",
  "version": 3,
  "subject": "Confirm your lead",
  "body_html": "<html>...</html>",
  "body_text": "...",
  "variables": ["contact_name", "confirmation_link", "niche_name", "expires_at"],
  "is_active": true,
  "created_at": "2026-01-01T10:00:00Z",
  "updated_at": "2026-01-02T14:30:00Z"
}
```

#### PUT /api/v1/admin/email-templates/:id
**RBAC:** Admin (MFA required)

**Request**
```json
{
  "subject": "Confirm your lead (updated)",
  "body_html": "<html>...</html>",
  "body_text": "...",
  "variables": ["contact_name", "confirmation_link", "niche_name", "expires_at"],
  "is_active": true
}
```

**Response 200**
```json
{ "id": "uuid", "version": 4, "template_key": "lead_confirmation" }
```

#### DELETE /api/v1/admin/email-templates/:id
**RBAC:** Admin (MFA required)

**Response 200**
```json
{ "ok": true, "message": "Template deactivated" }
```

#### POST /api/v1/admin/email-templates/:id/preview
**RBAC:** Admin (MFA required)

**Request**
```json
{
  "variables": {
    "contact_name": "John",
    "confirmation_link": "https://example.com/confirm?token=...",
    "niche_name": "Roofing",
    "expires_at": "2026-01-03T00:00:00Z"
  }
}
```

**Response 200**
```json
{
  "subject": "Confirm your lead",
  "body_html": "<html>...</html>",
  "body_text": "Hi John ..."
}
```

#### GET /api/v1/admin/email-events?lead_id=uuid&page=1&limit=50
**RBAC:** Admin (MFA required)

**Response 200**
```json
{
  "events": [
    {
      "id": "uuid",
      "event_type": "delivered",
      "email_to": "user@example.com",
      "template_key": "lead_confirmation",
      "provider_name": "ses",
      "related_entity_type": "lead",
      "related_entity_id": "uuid",
      "occurred_at": "2026-01-02T14:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 123, "total_pages": 3 }
}
```

---

### B. Template Variable Specifications (Optional)

> These are recommendations for consistent variable naming and type expectations. Actual variables can evolve as templates are authored.

#### lead_confirmation
- `contact_name` *(string, required)*
- `confirmation_link` *(url, required)*
- `niche_name` *(string, required)*
- `expires_at` *(datetime ISO‑8601, required)*

#### lead_received_thank_you
- `contact_name` *(string, optional)*
- `lead_id` *(uuid, required)*
- `niche_name` *(string, required)*

#### provider_new_lead
- `provider_name` *(string, required)*
- `lead_id` *(uuid, required)*
- `niche_name` *(string, required)*
- `contact_name` *(string, optional)*
- `form_data` *(object, required)*
- `price_charged` *(decimal, required)*

#### bad_lead_reported_confirmation
- `provider_name` *(string, required)*
- `lead_id` *(uuid, required)*
- `niche_name` *(string, required)*
- `reported_at` *(datetime, required)*
- `expected_review_time` *(string, optional; e.g., "within 24 hours")*

#### bad_lead_approved
- `provider_name` *(string, required)*
- `lead_id` *(uuid, required)*
- `niche_name` *(string, required)*
- `refund_amount` *(decimal, required)*
- `admin_memo` *(string, optional)*
- `refunded_at` *(datetime, required)*
- `new_balance` *(decimal, optional)*

#### bad_lead_rejected
- `provider_name` *(string, required)*
- `lead_id` *(uuid, required)*
- `niche_name` *(string, required)*
- `admin_memo` *(string, required)*
- `reviewed_at` *(datetime, required)*

#### low_balance_alert
- `provider_name` *(string, required)*
- `current_balance` *(decimal, required)*
- `threshold` *(decimal, required)*
- `deposit_url` *(url, optional)*

#### filter_updated
- `provider_name` *(string, required)*
- `niche_name` *(string, required)*
- `level_name` *(string, required)*
- `filter_summary` *(string, required)*
- `updated_at` *(datetime, required)*
- `edit_url` *(url, required)*

#### filter_invalidated
- `provider_name` *(string, required)*
- `niche_name` *(string, required)*
- `validation_errors` *(array<string>, required)*
- `edit_url` *(url, required)*

---

### C. Standard Error Response Schema (Optional)

All endpoints should return a consistent error shape:

```json
{ "error": "Authentication required" }                    // 401
{ "error": "Insufficient permissions" }                   // 403
{ "error": "Template not found" }                         // 404
{ "error": "Invalid template variables", "details": [] }  // 400
{ "error": "Internal error", "correlation_id": "uuid" }   // 500
```

---

### D. Suggested Indexes (Optional)

```sql
-- email_templates (fast lookup by key + active)
CREATE INDEX IF NOT EXISTS idx_email_templates_key_active
  ON email_templates(template_key, is_active);

-- email_events (entity drilldowns + recent activity)
CREATE INDEX IF NOT EXISTS idx_email_events_entity
  ON email_events(related_entity_type, related_entity_id);

CREATE INDEX IF NOT EXISTS idx_email_events_created
  ON email_events(created_at DESC);
```

---

### E. Email Health Check (Optional; see Epic 12 for canonical health endpoints)

If you want a dedicated email health endpoint (not required for MVP), expose:

#### GET /health/email
**Response 200**
```json
{
  "status": "healthy",
  "provider": "ses",
  "last_send": "2026-01-02T14:30:00Z",
  "queue_depth": 12
}
```


## Definition of Done
- Single abstraction used everywhere
- MailHog + SES verified
- Templates DB‑driven
- Events recorded (no business logic)
- BullMQ retries + DLQ
- Secure webhooks
- Audit logging complete
- Integration with Epics 02, 06, 07, 08, 09, 12 verified
