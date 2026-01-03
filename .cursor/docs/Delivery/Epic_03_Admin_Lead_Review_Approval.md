# EPIC 02 — Lead Intake & Confirmation

## Epic Goal
Enable end users to submit qualified leads through niche-specific forms, enforce email confirmation before approval or distribution, and safely persist lead data for downstream review and distribution.

This epic establishes the **front door** of the platform and strictly enforces the rule:
> **No lead may be approved or distributed until the end user confirms their submission via email.**

---

## In Scope
- Public lead submission API
- Niche-specific form schemas (stored on `niches.form_schema`)
- Lead persistence with confirmation gating
- Email confirmation flow (via Epic 10)
- Resend confirmation support
- Attribution capture (UTM/referrer + partner_id placeholder)
- Basic spam protections (rate limits + duplicate detection)

---

## Non-Goals (MVP)
- End-user accounts or login
- In-platform messaging
- Automatic lead approval
- CAPTCHA / bot mitigation beyond basic validation (future)

---

## Dependencies
- **EPIC 01 — Platform Foundation & Access Control** (rate limiting primitives, audit logging)
- **EPIC 10 — Email Infrastructure & Notifications** (confirmation emails, retries, email_events)

---

## Stories & Tasks

### Story 1: Niche-Specific Lead Form Schemas (Architecture-Aligned)
**As a** system  
**I want** lead forms to be defined per niche  
**So that** different services can collect appropriate data

**Acceptance Criteria**
- Each niche uses `niches.form_schema` (JSONB)
- `form_schema` supports:
  - `field_key` (string)
  - `label` (string)
  - `type` (`text`, `number`, `email`, `phone`, `select`, `checkbox`, `radio`, `textarea`)
  - `required` (boolean)
  - `validation_rules` (object; e.g., min/max length, regex)
  - `placeholder` (string, optional)
  - `help_text` (string, optional)
- Select/dropdown fields reference `niches.dropdown_values` (JSONB)
- Schema changes are versioned via **audit_log** (no separate schema version table in MVP)

**Tasks**
- Use `form_schema` JSONB column on `niches` table (per architecture)
- Define schema validation approach (Zod or JSON Schema)
- Implement GET `/api/v1/niches/:id/form-schema`
- Implement validator to validate `form_data` against `form_schema` (+ dropdown_values)
- Audit log schema changes (actor: admin)
- Seed example schemas for initial niches (MVP: VPS and Servers)

---

### Story 2: Public Lead Submission API (Validation + Spam Controls)
**As an** end user  
**I want** to submit my request once  
**So that** multiple providers can quote me

**Acceptance Criteria**
- Public endpoint accepts:
  - `niche_id` (UUID, required)
  - `contact_email` (required, valid email)
  - `contact_phone` (optional, validated format)
  - `form_data` (JSONB, required)
  - `attribution` (optional object): `utm_source`, `utm_medium`, `utm_campaign`, `referrer_url`, `partner_id` (future)
- Input validated against the active niche `form_schema`
- Lead created with status `pending_confirmation`
- **Rate limit:** 5 submissions per email per hour
- **Duplicate detection:** detect if same `contact_email + niche_id` submitted within 24h (warn/flag; does not block by default)

**Tasks**
- Implement POST `/api/v1/leads`
- Validate `niche_id` exists and `niches.is_active = true`
- Validate `contact_email` format
- Validate `contact_phone` format if present (E.164 or configured national format)
- Validate `form_data` against `niches.form_schema`
- Implement Redis rate limit: 5 submissions per email per hour
- Implement duplicate detection (same email+niche within 24h)
- Persist lead record with status `pending_confirmation`
- Audit log lead creation (actor: system, entity: lead)
- Return `lead_id` and confirmation message

---

### Story 3: Lead Confirmation Token Generation (Hashed, Single-Use)
**As a** system  
**I want** secure confirmation tokens  
**So that** lead ownership is verified

**Acceptance Criteria**
- Confirmation token generated on lead creation
- Token format: **32-byte random string**, URL-safe base64 encoded
- Token stored as **SHA-256 hash** (never plaintext)
- Token expires after 24 hours
- Token is **single-use** (invalidated after confirmation)

**Tasks**
- Generate cryptographically secure token (e.g., `crypto.randomBytes(32)`)
- URL-safe base64 encode token
- Hash token with SHA-256 before storage
- Store in `leads`:
  - `confirmation_token_hash`
  - `confirmation_expires_at`
  - `confirmation_token_used` (default false)
- Build token validation helper

---

### Story 4: Lead Confirmation Email (Non-Blocking)
**As an** end user  
**I want** to confirm my request via email  
**So that** providers know I am real

**Acceptance Criteria**
- Confirmation email sent after submission
- Email contains confirmation link with token
- Uses Epic 10 template: `lead_confirmation`
- Email failures **do not block** lead creation
- Failed sends are retried per Epic 10

**Tasks**
- Trigger email send (template_key: `lead_confirmation`)
- Pass required variables:
  - `contact_name` (from form_data or fallback "there")
  - `confirmation_link` (contains token)
  - `niche_name`
  - `expires_at`
- Queue email via BullMQ (async)
- Write `email_events` record for `sent`

---

### Story 5: Lead Confirmation Endpoint (Security + Edge Cases)
**As an** end user  
**I want** to confirm my lead  
**So that** it can be reviewed and distributed

**Acceptance Criteria**
- Endpoint validates token format, hash match, and expiry
- Token must not be already used
- Lead must be in `pending_confirmation`
- On success:
  - `confirmed_at` set to NOW()
  - `status` → `pending_approval`
  - `confirmation_token_used` → true
- Edge cases:
  - expired token → **410 Gone** (with resend option)
  - invalid token → **404 Not Found**
  - already confirmed → **200 OK** (idempotent)
- **Rate limit:** 10 attempts per IP per minute

**Tasks**
- Implement GET `/api/v1/leads/confirm?token=<token>`
- Validate token is URL-safe base64
- Hash token and lookup lead by `confirmation_token_hash`
- Verify `confirmation_expires_at > NOW()`
- Verify `confirmation_token_used = false`
- Verify lead `status = pending_confirmation`
- Transactionally update:
  - `confirmed_at = NOW()`
  - `status = 'pending_approval'`
  - `confirmation_token_used = true`
- Audit log confirmation event (actor: system, action: `lead_confirmed`)
- Apply rate limit: 10 attempts per IP per minute

---

### Story 6: Confirmation Result UX (Explicit Pages)
**As an** end user  
**I want** clear feedback after confirmation  
**So that** I know what happens next

**Acceptance Criteria**
- **Success page** shows:
  - “Thank you for confirming your request!”
  - “We’re reviewing your submission and will connect you with qualified providers soon.”
  - Expected timeline (e.g., within 24–48 hours)
- **Expired token page** shows:
  - “This confirmation link has expired.”
  - Resend confirmation CTA (if still pending)
- **Invalid token page** shows:
  - “This confirmation link is invalid.”
  - Contact support link
- **Already confirmed page** shows:
  - “This request has already been confirmed.”
- No sensitive data exposed (no lead_id shown on pages)

**Tasks**
- Implement confirmation success page
- Implement expired token page (with resend CTA)
- Implement invalid token page
- Implement already confirmed page
- Map API status codes → UI states:
  - 200 → success or already confirmed
  - 404 → invalid token
  - 410 → expired token

---

### Story 7: Resend Confirmation Email (Limits + Cooldown)
**As an** end user  
**I want** to resend my confirmation email  
**So that** I can complete my request

**Acceptance Criteria**
- Resend allowed if:
  - lead `status = pending_confirmation`
  - token expired OR user requests resend
- Max **3 resends per lead**
- Cooldown: **1 resend per lead per 5 minutes**
- Old token invalidated
- New token generated with fresh 24-hour expiry
- Audit logged

**Tasks**
- Implement POST `/api/v1/leads/:id/resend-confirmation`
- Validate lead exists and `status = pending_confirmation`
- Enforce resend_count ≤ 3
- Enforce cooldown (1 per 5 minutes)
- Invalidate old token (`confirmation_token_used = true`)
- Generate new token hash + expiry
- Increment `resend_count`
- Trigger confirmation email (Epic 10)
- Audit log resend event (actor: system, action: `confirmation_resent`)

---

### Story 8: Attribution Capture (Architecture-Aligned)
**As a** platform  
**I want** to capture where leads come from  
**So that** ROI can be measured later

**Acceptance Criteria**
- Store optional attribution fields on `leads`:
  - `utm_source` (VARCHAR(255))
  - `utm_medium` (VARCHAR(255))
  - `utm_campaign` (VARCHAR(255))
  - `referrer_url` (TEXT)
  - `partner_id` (UUID, nullable; future partner program)
- Attribution captured from:
  - query parameters (utm_*)
  - HTTP Referer header (referrer_url)
- Attribution does not affect logic (MVP)
- Attribution visible in admin lead view (Epic 03)

**Tasks**
- Ensure leads table includes attribution fields per architecture
- Capture utm_* from query params
- Capture referrer_url from HTTP Referer
- Add `partner_id` column (nullable)
- Document attribution capture contract for future partner integrations

---

### Story 9: Lead Submission Response & Error Handling
**As an** end user  
**I want** clear feedback after submission  
**So that** I know what to do next

**Acceptance Criteria**
- Success (201):
  - `lead_id`
  - message: “Please check your email to confirm your request.”
  - `confirmation_sent: true` (best-effort)
- Error responses:
  - 400: validation errors with field-level details
  - 404: niche not found or disabled
  - 429: rate limit exceeded
  - 500: generic error (no stack traces)

**Tasks**
- Define success response schema
- Define error response schemas
- Implement field-level validation errors
- Standardize 429 and 404 responses
- Ensure user-friendly messaging
- Log errors to application logs

---

### Story 10: Niche Availability Validation
**As a** system  
**I want** to reject submissions for disabled niches  
**So that** leads are only captured for active services

**Acceptance Criteria**
- Lead submission checks `niches.is_active = true`
- Disabled niche returns 404 with message: “This service is not currently accepting requests.”

**Tasks**
- Validate `niche_id` exists and is active before accepting submission
- Return 404 if disabled
- Log disabled-niche submission attempts

---

## Database Schema Changes

### Leads Table Updates
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmation_token_used BOOLEAN DEFAULT false;
```

### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_leads_confirmation_token_hash
  ON leads(confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_contact_email ON leads(contact_email);
CREATE INDEX IF NOT EXISTS idx_leads_niche_id ON leads(niche_id);
```

---

## Definition of Done
- Lead cannot advance without confirmation
- Tokens are hashed (SHA-256), expire (24 hours), and are single-use
- Confirmation emails sent via Epic 10 (queued, retried)
- Schema validation enforced (`form_data` matches `niches.form_schema`)
- Rate limiting enforced (submission, resend, confirm attempts)
- Duplicate detection implemented (warn/flag)
- Disabled niches rejected
- All state transitions audit-logged
- No lead approved or distributed pre-confirmation
- Unit tests for validation logic
- Integration tests for full submission → confirmation flow
- API tests for all endpoints (success + error cases)
- Token generation/validation tests
- Rate limiting tests

---

## Notes
- CAPTCHA and bot detection intentionally deferred
- End-user accounts may replace confirmation flow in future phases

