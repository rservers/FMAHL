# EPIC 02 Implementation Plan — Lead Intake & Confirmation

**Epic:** 02 - Lead Intake & Confirmation  
**Status:** 🟡 Planning  
**Started:** Jan 4, 2026  
**Depends On:** EPIC 01 ✅ (Platform Foundation), EPIC 10 ✅ (Email Infrastructure)  
**Unlocks:** EPIC 03 (Admin Lead Review)

---

## Overview

This epic builds the lead intake system for Find Me A Hot Lead:
- Public lead submission API with niche-specific form validation
- Email confirmation flow with secure tokens
- Rate limiting and duplicate detection
- Attribution capture (UTM, referrer)
- Confirmation UI pages

**Key Rule:** No lead may be approved or distributed until confirmed via email.

---

## Current State Analysis

### ✅ Already Exists

| Component | Location | Status |
|-----------|----------|--------|
| `leads` table | `packages/database/schema.sql` | ✅ Basic structure |
| `niches` table | `packages/database/schema.sql` | ✅ With form_schema |
| `niche_form_schemas` table | `packages/database/schema.sql` | ✅ Version tracking |
| Email service | `packages/email/` | ✅ EPIC 10 complete |
| `lead_confirmation` template | email_templates | ✅ Seeded |
| Rate limiting | `apps/web/lib/middleware/rate-limit.ts` | ✅ Redis-backed |
| Audit logging | `apps/web/lib/services/audit-logger.ts` | ✅ Working |

### 🔨 Needs Building

| Component | Priority |
|-----------|----------|
| Schema: Add confirmation fields to `leads` | P0 |
| Schema: Update `lead_status` enum | P0 |
| Schema: Add attribution fields | P0 |
| Form schema validator | P0 |
| Lead submission API | P0 |
| Confirmation token generator | P0 |
| Confirmation endpoint | P0 |
| Resend confirmation endpoint | P1 |
| Confirmation UI pages | P1 |
| Niche form schema API | P1 |
| Duplicate detection | P2 |

---

## Implementation Phases

### Phase 1: Database Schema Updates (Day 1)

**Files to Modify:**
- `packages/database/schema.sql`

**Schema Changes:**

```sql
-- 1. Update lead_status enum (need to add new values)
-- Note: PostgreSQL doesn't support removing enum values easily
-- We'll add the new values needed

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'pending_confirmation' BEFORE 'pending';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'pending_approval' AFTER 'pending';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'pending_approval';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'rejected' AFTER 'approved';

-- Rename 'pending' to be unused (we'll use pending_confirmation and pending_approval)

-- 2. Add confirmation fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmation_token_hash VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmation_token_used BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_resend_at TIMESTAMPTZ;

-- 3. Add attribution fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS partner_id UUID;

-- 4. Add contact fields (rename submitter_ to contact_)
-- Actually existing: submitter_name, submitter_email, submitter_phone
-- We can keep these or add aliases

-- 5. New indexes
CREATE INDEX IF NOT EXISTS idx_leads_confirmation_token_hash
  ON leads(confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_submitter_email ON leads(submitter_email);
```

**Tasks:**
- [ ] Add new lead_status values
- [ ] Add confirmation fields
- [ ] Add attribution fields
- [ ] Add indexes
- [ ] Run migration
- [ ] Verify schema

---

### Phase 2: Form Schema Validation (Day 1-2)

Build form schema validator for niche-specific form data.

**Files to Create:**
- `apps/web/lib/lead/form-validator.ts` - Schema validation
- `apps/web/lib/lead/types.ts` - Lead types

**Files to Modify:**
- `apps/web/lib/validations/lead.ts` - Zod schemas

**Form Schema Structure (from niches.form_schema):**
```typescript
interface FormField {
  field_key: string
  label: string
  type: 'text' | 'number' | 'email' | 'phone' | 'select' | 'checkbox' | 'radio' | 'textarea'
  required: boolean
  validation_rules?: {
    min_length?: number
    max_length?: number
    min?: number
    max?: number
    pattern?: string
    options?: string[] // for select/radio/checkbox
  }
  placeholder?: string
  help_text?: string
}

type FormSchema = FormField[]
```

**Tasks:**
- [ ] Define FormField and FormSchema types
- [ ] Create form data validator function
- [ ] Handle required field validation
- [ ] Handle type-specific validation (email, phone, number ranges)
- [ ] Handle select/radio options validation
- [ ] Create Zod schemas for lead submission
- [ ] Add validation error formatting

---

### Phase 3: Confirmation Token System (Day 2)

**Files to Create:**
- `apps/web/lib/lead/confirmation-token.ts` - Token generation/validation

**Token Specification:**
- 32-byte random string
- URL-safe base64 encoded
- Stored as SHA-256 hash
- 24-hour expiry
- Single-use

**Tasks:**
- [ ] Generate cryptographically secure token
- [ ] URL-safe base64 encoding
- [ ] SHA-256 hash for storage
- [ ] Token validation helper
- [ ] Expiry check helper

---

### Phase 4: Lead Submission API (Day 2-3)

**Files to Create:**
- `apps/web/app/api/v1/leads/route.ts` - Lead submission

**Endpoint:** `POST /api/v1/leads`

**Request Body:**
```json
{
  "niche_id": "uuid",
  "contact_email": "email@example.com",
  "contact_name": "John Doe",
  "contact_phone": "+1234567890",
  "form_data": { ... },
  "attribution": {
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "summer2026"
  }
}
```

**Response (201):**
```json
{
  "lead_id": "uuid",
  "message": "Please check your email to confirm your request.",
  "confirmation_sent": true
}
```

**Flow:**
1. Validate niche exists and is active
2. Validate contact_email format
3. Validate contact_phone format (if provided)
4. Validate form_data against niche.form_schema
5. Check rate limit (5 per email per hour)
6. Check duplicate (same email+niche in 24h) - warn only
7. Generate confirmation token
8. Create lead with status `pending_confirmation`
9. Queue confirmation email (EPIC 10)
10. Audit log
11. Return lead_id

**Tasks:**
- [ ] Create lead submission route
- [ ] Validate niche exists and is_active
- [ ] Validate input fields
- [ ] Apply rate limiting
- [ ] Implement duplicate detection (warning)
- [ ] Generate and store confirmation token
- [ ] Create lead record
- [ ] Send confirmation email via emailService.sendTemplated()
- [ ] Audit log lead creation
- [ ] Return success response

---

### Phase 5: Confirmation Endpoint (Day 3)

**Files to Create:**
- `apps/web/app/api/v1/leads/confirm/route.ts` - Confirmation handler

**Endpoint:** `GET /api/v1/leads/confirm?token=<token>`

**Flow:**
1. Rate limit (10 per IP per minute)
2. Validate token format
3. Hash token and lookup lead
4. Check token not expired
5. Check token not used
6. Check lead status is `pending_confirmation`
7. Update lead:
   - `confirmed_at = NOW()`
   - `status = 'pending_approval'`
   - `confirmation_token_used = true`
8. Audit log
9. Redirect to confirmation UI page

**Response Codes:**
- 200: Success (or already confirmed)
- 404: Invalid token
- 410: Expired token

**Tasks:**
- [ ] Create confirmation route
- [ ] Validate token format
- [ ] Hash and lookup
- [ ] Check expiry
- [ ] Check used status
- [ ] Transactional update
- [ ] Audit log
- [ ] Redirect to UI page

---

### Phase 6: Resend Confirmation API (Day 3-4)

**Files to Create:**
- `apps/web/app/api/v1/leads/[id]/resend-confirmation/route.ts`

**Endpoint:** `POST /api/v1/leads/:id/resend-confirmation`

**Constraints:**
- Lead must be in `pending_confirmation`
- Max 3 resends per lead
- Cooldown: 1 per 5 minutes

**Flow:**
1. Validate lead exists
2. Check status is `pending_confirmation`
3. Check resend_count < 3
4. Check cooldown (last_resend_at + 5 min)
5. Mark old token as used
6. Generate new token
7. Update lead (token, expiry, resend_count, last_resend_at)
8. Send confirmation email
9. Audit log
10. Return success

**Tasks:**
- [ ] Create resend route
- [ ] Validate lead status
- [ ] Enforce resend limit
- [ ] Enforce cooldown
- [ ] Invalidate old token
- [ ] Generate new token
- [ ] Update lead
- [ ] Send email
- [ ] Audit log

---

### Phase 7: Niche Form Schema API (Day 4)

**Files to Create:**
- `apps/web/app/api/v1/niches/[id]/form-schema/route.ts`

**Endpoint:** `GET /api/v1/niches/:id/form-schema`

**Response:**
```json
{
  "niche_id": "uuid",
  "niche_name": "VPS Hosting",
  "form_schema": [
    {
      "field_key": "server_type",
      "label": "Server Type",
      "type": "select",
      "required": true,
      "validation_rules": {
        "options": ["dedicated", "vps", "cloud"]
      }
    },
    ...
  ]
}
```

**Tasks:**
- [ ] Create form schema route
- [ ] Validate niche exists and is_active
- [ ] Return form_schema from niches table

---

### Phase 8: Confirmation UI Pages (Day 4-5)

**Files to Create:**
- `apps/web/app/confirm/page.tsx` - Confirmation landing
- `apps/web/app/confirm/success/page.tsx` - Success page
- `apps/web/app/confirm/expired/page.tsx` - Expired token page
- `apps/web/app/confirm/invalid/page.tsx` - Invalid token page
- `apps/web/app/confirm/already-confirmed/page.tsx` - Already confirmed

**Pages:**

1. **Success Page**
   - "Thank you for confirming your request!"
   - "We're reviewing your submission and will connect you with qualified providers soon."
   - Expected timeline

2. **Expired Page**
   - "This confirmation link has expired."
   - Resend confirmation CTA

3. **Invalid Page**
   - "This confirmation link is invalid."
   - Contact support link

4. **Already Confirmed**
   - "This request has already been confirmed."

**Tasks:**
- [ ] Create confirmation success page
- [ ] Create expired token page with resend
- [ ] Create invalid token page
- [ ] Create already confirmed page
- [ ] Style pages consistently
- [ ] Handle confirmation API redirect

---

### Phase 9: Seed Test Niche (Day 5)

**Files to Create:**
- `packages/database/seeds/niches.ts` - Niche seeder

**Seed Data:**
```typescript
const vpsNiche = {
  slug: 'vps-hosting',
  name: 'VPS & Dedicated Servers',
  description: 'Get quotes from VPS and dedicated server providers',
  is_active: true,
  is_location_based: false,
  lead_price_cents: 2500, // $25.00
  form_schema: [
    {
      field_key: 'server_type',
      label: 'Server Type',
      type: 'select',
      required: true,
      validation_rules: { options: ['vps', 'dedicated', 'cloud'] }
    },
    {
      field_key: 'cpu_cores',
      label: 'CPU Cores Needed',
      type: 'number',
      required: true,
      validation_rules: { min: 1, max: 128 }
    },
    {
      field_key: 'ram_gb',
      label: 'RAM (GB)',
      type: 'number',
      required: true,
      validation_rules: { min: 1, max: 1024 }
    },
    {
      field_key: 'storage_gb',
      label: 'Storage (GB)',
      type: 'number',
      required: true,
      validation_rules: { min: 10, max: 10000 }
    },
    {
      field_key: 'os_preference',
      label: 'Operating System',
      type: 'select',
      required: false,
      validation_rules: { options: ['linux', 'windows', 'no_preference'] }
    },
    {
      field_key: 'additional_requirements',
      label: 'Additional Requirements',
      type: 'textarea',
      required: false,
      validation_rules: { max_length: 1000 }
    }
  ]
}
```

**Tasks:**
- [ ] Create niche seeder
- [ ] Add VPS niche with form schema
- [ ] Run seeder in migration
- [ ] Verify niche created

---

### Phase 10: Integration & Testing (Day 5)

**Test Scenarios:**
- [ ] Submit lead with valid data → confirmation email sent
- [ ] Submit lead with invalid form_data → 400 error
- [ ] Submit to inactive niche → 404 error
- [ ] Rate limit exceeded → 429 error
- [ ] Confirm with valid token → status changes
- [ ] Confirm with expired token → 410 error
- [ ] Confirm with invalid token → 404 error
- [ ] Confirm already confirmed → 200 idempotent
- [ ] Resend within cooldown → error
- [ ] Resend after max attempts → error

**Tasks:**
- [ ] Test lead submission flow
- [ ] Test confirmation flow
- [ ] Test resend flow
- [ ] Test UI pages
- [ ] Verify emails in MailHog
- [ ] Verify audit logs

---

## File Summary

### New Files (15+)

```
apps/web/
├── app/
│   ├── api/v1/
│   │   ├── leads/
│   │   │   ├── route.ts              # POST /api/v1/leads
│   │   │   ├── confirm/
│   │   │   │   └── route.ts          # GET /api/v1/leads/confirm
│   │   │   └── [id]/
│   │   │       └── resend-confirmation/
│   │   │           └── route.ts      # POST resend
│   │   └── niches/
│   │       └── [id]/
│   │           └── form-schema/
│   │               └── route.ts      # GET form schema
│   └── confirm/
│       ├── page.tsx                  # Confirmation landing
│       ├── success/page.tsx
│       ├── expired/page.tsx
│       ├── invalid/page.tsx
│       └── already-confirmed/page.tsx
├── lib/
│   ├── lead/
│   │   ├── form-validator.ts         # Schema validation
│   │   ├── confirmation-token.ts     # Token generation
│   │   └── types.ts                  # Lead types
│   └── validations/
│       └── lead.ts                   # Zod schemas

packages/database/
└── seeds/
    └── niches.ts                     # Niche seeder
```

### Modified Files (3)

```
packages/database/schema.sql          # Add confirmation + attribution fields
packages/database/migrate.ts          # Add niche seeder
apps/web/lib/middleware/rate-limit.ts # Add lead submission limits
```

---

## API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/niches/:id/form-schema` | Public | Get niche form schema |
| POST | `/api/v1/leads` | Public | Submit lead |
| GET | `/api/v1/leads/confirm` | Public | Confirm lead |
| POST | `/api/v1/leads/:id/resend-confirmation` | Public | Resend confirmation |

---

## Rate Limits

| Endpoint | Limit | Key |
|----------|-------|-----|
| Lead submission | 5/hour | email |
| Confirmation | 10/min | IP |
| Resend | 1/5min per lead | lead_id |
| Resend | 3 total | lead_id |

---

## Lead Status Flow

```
[Submit] → pending_confirmation
              │
    [Confirm] │
              ▼
        pending_approval ─────────────────┐
              │                           │
    [Admin]   │                           │
              ▼                           ▼
           approved                    rejected
              │
  [Distribute]│
              ▼
           assigned
              │
   [Refund]   │
              ▼
           refunded
```

---

## Success Criteria

### MVP Complete When:
- [ ] Lead submission works with form validation
- [ ] Confirmation emails sent via EPIC 10
- [ ] Confirmation tokens are hashed and expire
- [ ] Confirmation endpoint updates status
- [ ] Resend works with limits
- [ ] UI pages display correctly
- [ ] Rate limiting enforced
- [ ] VPS niche seeded with form schema
- [ ] All endpoints tested

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1. Database Schema | 0.5 day | 0.5 day |
| 2. Form Validation | 1 day | 1.5 days |
| 3. Token System | 0.5 day | 2 days |
| 4. Submission API | 1 day | 3 days |
| 5. Confirmation API | 0.5 day | 3.5 days |
| 6. Resend API | 0.5 day | 4 days |
| 7. Niche API | 0.5 day | 4.5 days |
| 8. UI Pages | 1 day | 5.5 days |
| 9. Seed Data | 0.5 day | 6 days |
| 10. Testing | 0.5 day | 6.5 days |

**Total Estimate:** 6-7 days

---

## Next Steps

1. **Start Phase 1**: Update database schema
2. **Run migration**: Apply changes
3. **Continue sequentially** through phases

---

*Created: Jan 4, 2026*  
*Last Updated: Jan 4, 2026*

