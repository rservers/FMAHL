# EPIC 10 Implementation Plan — Notifications & Email Infrastructure

**Epic:** 10 - Notifications & Email  
**Status:** 🟡 Planning  
**Started:** Jan 3, 2026  
**Depends On:** EPIC 01 ✅ (Platform Foundation)  
**Unlocks:** EPIC 02 (Lead Intake)

---

## Overview

This epic builds the email infrastructure for Find Me A Hot Lead:
- Database-driven email templates with versioning
- Async email queue with retries and dead letter handling
- Environment-specific delivery (MailHog dev, SES prod)
- Email event tracking and audit logging
- Admin APIs for template management

---

## Current State Analysis

### ✅ Already Exists

| Component | Location | Status |
|-----------|----------|--------|
| Email Provider Interface | `packages/email/types.ts` | ✅ Basic interface |
| MailHog Provider | `packages/email/providers/mailhog.ts` | ✅ Working |
| SES Provider | `packages/email/providers/ses.ts` | ✅ Implemented |
| Console Provider | `packages/email/providers/console.ts` | ✅ For tests |
| BullMQ Worker | `apps/worker/src/index.ts` | ✅ Skeleton |
| Redis Connection | Docker + apps | ✅ Working |

### 🔨 Needs Building

| Component | Priority |
|-----------|----------|
| Database: `email_templates` table | P0 |
| Database: `email_events` table | P0 |
| Template rendering (Handlebars) | P0 |
| Email queue with BullMQ | P0 |
| Worker: email job processor | P0 |
| Admin API: Template CRUD | P1 |
| Default template seeds | P1 |
| Email event tracking | P1 |
| SES webhook handler | P2 |
| Rate limiting (SES-aware) | P2 |
| Health check endpoint | P2 |

---

## Implementation Phases

### Phase 1: Database Schema (Day 1)
Add email tables to database schema.

**Files to Modify:**
- `packages/database/schema.sql`

**Tables to Create:**

```sql
-- Email templates with versioning
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(100) UNIQUE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email events for tracking
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type VARCHAR(100) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('queued', 'sent', 'delivered', 'opened', 'bounced', 'complained', 'failed')),
  provider VARCHAR(50),
  message_id VARCHAR(255),
  template_id UUID REFERENCES email_templates(id),
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_templates_key_active ON email_templates(template_key, is_active);
CREATE INDEX idx_email_events_entity ON email_events(related_entity_type, related_entity_id);
CREATE INDEX idx_email_events_created ON email_events(created_at DESC);
CREATE INDEX idx_email_events_recipient ON email_events(recipient_email);
```

**Tasks:**
- [ ] Add tables to `schema.sql`
- [ ] Run migration
- [ ] Verify tables created

---

### Phase 2: Template System (Day 1-2)
Build template rendering with Handlebars.

**Files to Create:**
- `packages/email/templates/renderer.ts` - Template engine
- `packages/email/templates/types.ts` - Template types
- `packages/email/templates/defaults.ts` - Default template content

**Files to Modify:**
- `packages/email/package.json` - Add handlebars dependency
- `packages/email/types.ts` - Extend types

**Template Keys (MVP):**
```typescript
const TEMPLATE_KEYS = [
  'email_verification',      // EPIC 01 auth
  'password_reset',          // EPIC 01 auth
  'lead_confirmation',       // EPIC 02 lead intake
  'lead_confirmation_expired',
  'provider_new_lead',       // EPIC 06 distribution
  'provider_low_balance',    // EPIC 07 billing
  'bad_lead_approved',       // EPIC 09 refunds
  'bad_lead_rejected',
  'admin_lead_pending',      // EPIC 03 admin review
] as const
```

**Tasks:**
- [ ] Install `handlebars` dependency
- [ ] Create template renderer with variable substitution
- [ ] Create template types
- [ ] Create default template content (HTML + text)
- [ ] Add variable validation

---

### Phase 3: Email Queue Service (Day 2)
Build async email sending with BullMQ.

**Files to Create:**
- `packages/email/queue/email-queue.ts` - Queue service
- `packages/email/queue/types.ts` - Job types
- `apps/worker/src/processors/email.ts` - Email job processor

**Files to Modify:**
- `apps/worker/src/index.ts` - Register email processor
- `apps/worker/package.json` - Add email package dependency

**Queue Configuration:**
```typescript
const EMAIL_QUEUE_CONFIG = {
  name: 'email_send',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,  // 1s → 5s → 25s
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
  limiter: {
    max: 10,       // SES sandbox: 14/sec, production: higher
    duration: 1000,
  },
}
```

**Tasks:**
- [ ] Create email queue service
- [ ] Create job types (send, bulk)
- [ ] Implement email job processor
- [ ] Add retry logic with exponential backoff
- [ ] Add dead letter queue handling
- [ ] Integrate with worker

---

### Phase 4: Email Event Tracking (Day 2-3)
Track email lifecycle events.

**Files to Create:**
- `packages/email/events/tracker.ts` - Event tracking service
- `packages/email/events/types.ts` - Event types

**Files to Modify:**
- `packages/email/queue/email-queue.ts` - Add event tracking
- `apps/worker/src/processors/email.ts` - Log events

**Event Flow:**
```
enqueue() → 'queued' event
processor() → 'sent' event (on success) / 'failed' event (on error)
webhook()  → 'delivered' / 'bounced' / 'complained' (from SES)
```

**Tasks:**
- [ ] Create event tracking service
- [ ] Track 'queued' on enqueue
- [ ] Track 'sent' / 'failed' in processor
- [ ] Integrate with database

---

### Phase 5: Email Service Refactor (Day 3)
Refactor email service to use templates and queue.

**Files to Modify:**
- `packages/email/index.ts` - Main service
- `packages/email/types.ts` - Extended types

**New Email Service API:**
```typescript
interface EmailService {
  // Queue a templated email
  send(options: {
    template: TemplateKey
    to: string | string[]
    variables: Record<string, any>
    relatedEntity?: { type: string; id: string }
    priority?: 'high' | 'normal' | 'low'
  }): Promise<{ jobId: string }>

  // Send immediately (for testing/urgent)
  sendNow(options: EmailOptions): Promise<EmailResult>

  // Preview a template
  preview(template: TemplateKey, variables: Record<string, any>): Promise<RenderedEmail>

  // Health check
  healthCheck(): Promise<{ status: string; provider: string }>
}
```

**Tasks:**
- [ ] Refactor EmailService to use queue by default
- [ ] Add template loading from database
- [ ] Add `send()` method for queued delivery
- [ ] Add `sendNow()` method for immediate delivery
- [ ] Add `preview()` method for template preview
- [ ] Add health check

---

### Phase 6: Admin API Routes (Day 3-4)
Build admin template management APIs.

**Files to Create:**
- `apps/web/app/api/v1/admin/email-templates/route.ts` - List, Create
- `apps/web/app/api/v1/admin/email-templates/[id]/route.ts` - Get, Update, Delete
- `apps/web/app/api/v1/admin/email-templates/[id]/preview/route.ts` - Preview
- `apps/web/app/api/v1/admin/email-events/route.ts` - List events
- `apps/web/lib/validations/email.ts` - Zod schemas

**Endpoints:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/admin/email-templates` | List templates |
| POST | `/api/v1/admin/email-templates` | Create template |
| GET | `/api/v1/admin/email-templates/:id` | Get template |
| PUT | `/api/v1/admin/email-templates/:id` | Update template |
| DELETE | `/api/v1/admin/email-templates/:id` | Deactivate template |
| POST | `/api/v1/admin/email-templates/:id/preview` | Preview with variables |
| GET | `/api/v1/admin/email-events` | List email events |

**Tasks:**
- [ ] Create Zod validation schemas
- [ ] Implement template CRUD routes
- [ ] Implement template preview route
- [ ] Implement email events list route
- [ ] Add RBAC (admin only, MFA required)
- [ ] Add pagination

---

### Phase 7: Default Template Seeds (Day 4)
Seed default templates for MVP.

**Files to Create:**
- `packages/database/seeds/email-templates.ts` - Template seeder

**Templates to Seed:**
1. `email_verification` - Account verification
2. `password_reset` - Password reset
3. `lead_confirmation` - Lead confirmation (for EPIC 02)
4. `lead_confirmation_expired` - Expired confirmation
5. `provider_new_lead` - New lead notification
6. `provider_low_balance` - Low balance alert
7. `bad_lead_approved` - Refund approved
8. `bad_lead_rejected` - Refund rejected
9. `admin_lead_pending` - Admin notification

**Tasks:**
- [ ] Create template seeder script
- [ ] Design HTML templates (consistent branding)
- [ ] Create text versions
- [ ] Add seed to migration script
- [ ] Verify all templates render correctly

---

### Phase 8: SES Webhook Handler (Day 4-5)
Handle SES delivery notifications.

**Files to Create:**
- `apps/web/app/api/v1/webhooks/ses/route.ts` - SES webhook
- `packages/email/webhooks/ses-handler.ts` - SNS verification
- `packages/email/webhooks/types.ts` - SES event types

**Webhook Flow:**
```
SES → SNS → HTTPS → /api/v1/webhooks/ses
  ↓
Verify SNS signature
  ↓
Parse notification type (Delivery, Bounce, Complaint)
  ↓
Create email_event record
  ↓
Return 200
```

**Tasks:**
- [ ] Implement SNS signature verification
- [ ] Handle subscription confirmation
- [ ] Parse delivery/bounce/complaint notifications
- [ ] Create email events
- [ ] Add idempotency check (by message_id)
- [ ] Rate limit endpoint

---

### Phase 9: Integration & Testing (Day 5)
Wire everything together and test.

**Files to Modify:**
- `apps/web/lib/email.ts` - Update to use new service
- `apps/web/app/api/v1/auth/verify-email/route.ts` - Use queued email
- `apps/web/app/api/v1/auth/forgot-password/route.ts` - Use queued email
- `apps/web/app/api/v1/auth/resend-verification/route.ts` - Use queued email

**Integration Tests:**
- [ ] Test template rendering
- [ ] Test email queue processing
- [ ] Test event tracking
- [ ] Test admin APIs
- [ ] Test webhook handling
- [ ] Verify EPIC 01 auth emails work

---

## File Summary

### New Files (21)

```
packages/email/
├── queue/
│   ├── email-queue.ts      # BullMQ queue service
│   └── types.ts            # Job types
├── templates/
│   ├── renderer.ts         # Handlebars renderer
│   ├── types.ts            # Template types
│   └── defaults.ts         # Default template content
├── events/
│   ├── tracker.ts          # Event tracking
│   └── types.ts            # Event types
├── webhooks/
│   ├── ses-handler.ts      # SNS verification
│   └── types.ts            # SES event types
└── health.ts               # Health check

packages/database/
└── seeds/
    └── email-templates.ts  # Template seeder

apps/worker/src/
└── processors/
    └── email.ts            # Email job processor

apps/web/app/api/v1/
├── admin/
│   ├── email-templates/
│   │   ├── route.ts        # List, Create
│   │   └── [id]/
│   │       ├── route.ts    # Get, Update, Delete
│   │       └── preview/
│   │           └── route.ts # Preview
│   └── email-events/
│       └── route.ts        # List events
└── webhooks/
    └── ses/
        └── route.ts        # SES webhook

apps/web/lib/
└── validations/
    └── email.ts            # Zod schemas
```

### Modified Files (8)

```
packages/database/schema.sql          # Add email tables
packages/email/package.json           # Add handlebars
packages/email/types.ts               # Extend types
packages/email/index.ts               # Refactor service
apps/worker/src/index.ts              # Add email processor
apps/worker/package.json              # Add dependencies
apps/web/app/api/v1/auth/*.ts         # Use queued emails
packages/database/migrate.ts          # Add template seeds
```

---

## Dependencies to Install

```bash
# packages/email
npm install handlebars

# apps/worker
npm install email  # workspace dependency

# apps/web (for webhook)
# No new deps - using existing crypto
```

---

## Environment Variables

**Already configured:**
```bash
EMAIL_PROVIDER=mailhog     # mailhog | ses | console
MAILHOG_HOST=localhost
MAILHOG_PORT=1025
```

**New for production:**
```bash
# SES Configuration
AWS_SES_ACCESS_KEY_ID=
AWS_SES_SECRET_ACCESS_KEY=
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@findmeahotlead.com

# SES Webhook
SES_WEBHOOK_SECRET=  # For validating SNS signatures
```

---

## Success Criteria

### MVP Complete When:
- [ ] All 9 templates seeded and rendering
- [ ] Email queue processing with 3 retries
- [ ] Events tracked for all emails
- [ ] Admin can CRUD templates
- [ ] Auth emails (EPIC 01) use new system
- [ ] MailHog receiving test emails

### Nice to Have:
- [ ] SES webhook handling
- [ ] Rate limiting per provider
- [ ] Email health check endpoint
- [ ] Bounce/complaint handling

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SES sandbox limits | Use MailHog for all dev/staging |
| Template rendering errors | Validate variables before send |
| Queue backup | Monitor queue depth, add alerts |
| Webhook security | Verify SNS signatures |

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1. Database Schema | 0.5 day | 0.5 day |
| 2. Template System | 1 day | 1.5 days |
| 3. Email Queue | 1 day | 2.5 days |
| 4. Event Tracking | 0.5 day | 3 days |
| 5. Service Refactor | 0.5 day | 3.5 days |
| 6. Admin APIs | 1 day | 4.5 days |
| 7. Template Seeds | 0.5 day | 5 days |
| 8. SES Webhooks | 0.5 day | 5.5 days |
| 9. Integration | 0.5 day | 6 days |

**Total Estimate:** 5-6 days

---

## Next Steps

1. **Start Phase 1**: Add database tables
2. **Run migration**: Verify schema
3. **Continue sequentially** through phases

---

*Created: Jan 3, 2026*  
*Last Updated: Jan 3, 2026*

