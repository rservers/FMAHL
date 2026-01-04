# EPIC 07 - Billing & Payments: Implementation Plan

**Epic:** EPIC 07 - Billing & Payments  
**Status:** 🔄 Planning  
**Created:** Jan 4, 2026  
**Estimated Effort:** 4-5 days

---

## Pre-Implementation Checklist

### ✅ Dependencies Verified
- [x] **EPIC 01** - Platform Foundation (RBAC, Admin MFA, audit_log, JWT) ✅
- [x] **EPIC 04** - Competition Levels & Subscriptions ✅
- [x] **EPIC 05** - Filters & Eligibility ✅
- [x] **EPIC 10** - Email Infrastructure ✅
- [ ] **EPIC 06** - Distribution Engine (consumes billing, not blocks)
- [ ] **EPIC 12** - Observability (optional - can proceed without)

### ✅ Deferred Items Reviewed
- [x] Checked `DEFERRED_ITEMS_SUMMARY.md`
  - P2: Rate limiting for admin lead routes (can do during EPIC 07)
  - P2: Email queue monitoring (EPIC 12)
  - P3: Various caching items (EPIC 11)
- [x] Checked EPIC 07 specification - No ⚠️ Deferred Items section

### ✅ Pre-requisites Confirmed
- [x] `providers` table exists
- [x] `provider_ledger` table exists (needs schema updates)
- [x] `lead_assignments` table exists (has refund fields)
- [x] `competition_level_subscriptions` table exists (EPIC 04)
- [x] Email infrastructure available (EPIC 10)
- [x] Admin MFA middleware available (EPIC 01)
- [x] Audit logging available (EPIC 01)

---

## Overview

This epic implements the **billing backbone** for lead distribution:
1. Provider deposits via Stripe + PayPal
2. Immutable ledger with balance tracking
3. Atomic charging for lead assignments
4. Refunds as ledger credits
5. Low-balance alerts and subscription auto-deactivation/reactivation

### Key Components
- **Provider Ledger & Balance Model** - Immutable ledger, cached balance
- **Payment Processing** - Stripe + PayPal checkout, webhook handling
- **Charging Service** - Atomic lead purchase with row locking
- **Balance Management** - Low-balance alerts, subscription deactivation
- **Refunds** - Assignment-tied credits (admin-driven)
- **Admin APIs** - Balance adjustments, billing oversight

---

## Architecture Notes

### Existing Schema Analysis

The current schema has partial billing support that needs enhancement:

**Current `providers` table:**
- ❌ Missing: `balance`, `low_balance_threshold`, `low_balance_alert_sent`
- ❌ Missing: Auto-topup fields (schema-only for future)

**Current `provider_ledger` table:**
- ❌ Uses `amount_cents` instead of `DECIMAL(10,2)`
- ❌ Missing: `related_payment_id`, `actor_id`, `actor_role`
- ❌ `subscription_id` is NOT NULL (should be nullable)
- ❌ Transaction types need expansion: `manual_credit`, `manual_debit`

**Missing tables:**
- ❌ `payments` table for payment gateway records

### Schema Changes Required

1. **Add balance columns to `providers`**
2. **Update `provider_ledger` schema** (or create new compatible version)
3. **Create `payments` table**
4. **Add missing indexes**

---

## Implementation Phases

### Phase 1: Database Schema Updates ⬜
**Effort:** 1 hour  
**Stories:** Story 1

**Tasks:**
1. Add balance columns to `providers`:
   ```sql
   ALTER TABLE providers
     ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
     ADD COLUMN IF NOT EXISTS low_balance_threshold DECIMAL(10,2),
     ADD COLUMN IF NOT EXISTS low_balance_alert_sent BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS auto_topup_enabled BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS auto_topup_threshold DECIMAL(10,2),
     ADD COLUMN IF NOT EXISTS auto_topup_amount DECIMAL(10,2);
   ```

2. Create `payments` table:
   ```sql
   CREATE TABLE IF NOT EXISTS payments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     provider_id UUID NOT NULL REFERENCES providers(id),
     provider_name VARCHAR(50) NOT NULL CHECK (provider_name IN ('stripe', 'paypal')),
     external_payment_id VARCHAR(255) NOT NULL,
     amount DECIMAL(10,2) NOT NULL,
     currency VARCHAR(3) NOT NULL DEFAULT 'USD',
     status VARCHAR(20) NOT NULL CHECK (status IN ('pending','completed','failed','refunded')),
     metadata JSONB,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT uq_payments_provider_external UNIQUE(provider_name, external_payment_id)
   );
   ```

3. Update `provider_ledger` schema to match spec:
   - Add `entry_type` enum with `manual_credit`, `manual_debit`
   - Add `related_payment_id` FK
   - Add `actor_id`, `actor_role`
   - Make `subscription_id` nullable
   - Update amount to DECIMAL(10,2)

4. Create migration function `ensureEpic07Schema()`

5. Add indexes for performance

**Files:**
- `packages/database/schema.sql` (update)
- `packages/database/migrate.ts` (update)

**Verification:**
- Run `npm run db:migrate` and confirm tables/columns exist

---

### Phase 2: TypeScript Types & Validation ⬜
**Effort:** 45 minutes  
**Stories:** All

**Tasks:**
1. Create billing types:
   - `LedgerEntryType` - deposit, lead_purchase, refund, manual_credit, manual_debit
   - `PaymentProvider` - stripe, paypal
   - `PaymentStatus` - pending, completed, failed, refunded
   - `LedgerEntry` interface
   - `Payment` interface

2. Create Zod validation schemas:
   - `createDepositSchema` - amount, currency, provider_name
   - `refundAssignmentSchema` - refund_reason, memo
   - `balanceAdjustSchema` - entry_type, amount, memo (10-500 chars)
   - `billingHistoryQuerySchema` - pagination, filters

3. Create billing constants:
   - `MIN_DEPOSIT_USD = 10.00`
   - `MEMO_MIN_LENGTH = 10`
   - `MEMO_MAX_LENGTH = 500`

**Files:**
- `apps/web/lib/types/billing.ts` (new)
- `apps/web/lib/validations/billing.ts` (new)
- `apps/web/lib/constants/billing.ts` (new)

---

### Phase 3: Ledger & Balance Service ⬜
**Effort:** 2 hours  
**Stories:** Story 1, Story 4

**Tasks:**
1. Create ledger service `apps/web/lib/services/ledger.ts`:
   - `createLedgerEntry()` - Insert entry with balance_after calculation
   - `calculateBalance(provider_id)` - SUM ledger entries for reconciliation
   - `updateProviderBalance(provider_id, balance_after)` - Update cached balance
   - `getProviderBalance(provider_id)` - Get cached balance (fast read)
   - `getLedgerHistory(provider_id, filters, pagination)` - Paginated history

2. Implement balance_after calculation:
   - Fetch current balance
   - Calculate new balance based on entry type
   - Validate no negative balance for debits
   - Insert ledger entry with balance_after
   - Update cached providers.balance

3. Implement row-level locking for debits:
   - `SELECT ... FOR UPDATE` on provider row
   - Transaction isolation: READ COMMITTED

**Files:**
- `apps/web/lib/services/ledger.ts` (new)

**Tests:**
- Balance calculation correctness
- No negative balance enforcement
- Concurrent debit race conditions

---

### Phase 4: Atomic Charge Service ⬜
**Effort:** 1.5 hours  
**Stories:** Story 4

**Tasks:**
1. Create charge service `apps/web/lib/services/billing.ts`:
   - `chargeForLeadAssignment(provider_id, lead_id, subscription_id, amount_cents)`

2. Transaction steps:
   ```typescript
   async function chargeForLeadAssignment(...) {
     return sql.begin(async sql => {
       // 1. Lock provider row
       const [provider] = await sql`
         SELECT balance FROM providers WHERE id = ${provider_id} FOR UPDATE
       `
       
       // 2. Check balance
       const amount = amount_cents / 100
       if (provider.balance < amount) {
         throw new InsufficientBalanceError()
       }
       
       // 3. Insert ledger entry
       const new_balance = provider.balance - amount
       await sql`INSERT INTO provider_ledger ...`
       
       // 4. Update cached balance
       await sql`UPDATE providers SET balance = ${new_balance} ...`
       
       // 5. Create lead_assignment (called from EPIC 06)
       return { success: true, new_balance }
     })
   }
   ```

3. Implement `InsufficientBalanceError` custom error

4. Add retry logic for transient DB errors

**Files:**
- `apps/web/lib/services/billing.ts` (new)
- `apps/web/lib/errors/billing.ts` (new)

**Tests:**
- Successful charge
- Insufficient balance rejection
- Concurrent charge race condition (only one succeeds)

---

### Phase 5: Payment Gateway Integration ⬜
**Effort:** 3 hours  
**Stories:** Story 2, Story 3

**Tasks:**
1. Create payment service `apps/web/lib/services/payment.ts`:
   - `createStripeCheckoutSession(provider_id, amount, currency)`
   - `createPayPalOrder(provider_id, amount, currency)`
   - `handleStripeWebhook(payload, signature)`
   - `handlePayPalWebhook(payload, headers)`

2. Create Stripe integration:
   - Use Stripe SDK
   - Create Checkout Session with success/cancel URLs
   - Store session_id in payments.metadata

3. Create PayPal integration:
   - Use PayPal REST API
   - Create Order with approval URL
   - Store order_id in payments.metadata

4. Implement idempotent webhook processing:
   - Check `payments.external_payment_id` before crediting
   - If already completed, return 200 (no-op)
   - Update payment status
   - Credit ledger
   - Update provider balance
   - Queue notification email

5. Implement signature verification:
   - Stripe: `stripe.webhooks.constructEvent()`
   - PayPal: Verify webhook signature

**Files:**
- `apps/web/lib/services/payment.ts` (new)
- `apps/web/lib/gateways/stripe.ts` (new)
- `apps/web/lib/gateways/paypal.ts` (new)

**Environment Variables:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`

---

### Phase 6: Provider Deposit API ⬜
**Effort:** 1 hour  
**Stories:** Story 2

**Tasks:**
1. Create `POST /api/v1/provider/deposits`:
   - Validate provider is active (not suspended)
   - Validate amount >= MIN_DEPOSIT_USD
   - Create `payments` record with status `pending`
   - Create gateway checkout session
   - Return `{ payment_id, provider_name, checkout_url }`

2. Add rate limiting for deposit requests

3. Add audit logging for deposit initiation

**Files:**
- `apps/web/app/api/v1/provider/deposits/route.ts` (new)

---

### Phase 7: Webhook Handlers ⬜
**Effort:** 2 hours  
**Stories:** Story 3

**Tasks:**
1. Create `POST /api/v1/webhooks/stripe`:
   - Verify Stripe signature
   - Parse event (checkout.session.completed)
   - Extract payment_intent_id
   - Lookup payment by (provider_name, external_payment_id)
   - If already completed: return 200 (idempotent)
   - Credit ledger in transaction
   - Queue notification email

2. Create `POST /api/v1/webhooks/paypal`:
   - Verify PayPal webhook signature
   - Parse event (CHECKOUT.ORDER.APPROVED)
   - Capture payment
   - Same idempotent processing

3. Handle failure events:
   - Update payment status to `failed`
   - No ledger entry

**Files:**
- `apps/web/app/api/v1/webhooks/stripe/route.ts` (new)
- `apps/web/app/api/v1/webhooks/paypal/route.ts` (new)

**Tests:**
- Idempotent duplicate webhook handling
- Signature verification
- Failed payment handling

---

### Phase 8: Low-Balance Alerts & Subscription Management ⬜
**Effort:** 1.5 hours  
**Stories:** Story 5A, Story 5B, Story 10

**Tasks:**
1. Update `apps/web/lib/services/subscription-status.ts`:
   - `checkAndUpdateSubscriptionStatus(provider_id)` - Already exists from EPIC 04
   - Integrate with ledger balance changes

2. Implement `checkLowBalanceAlert(provider_id)`:
   - Check if `balance < low_balance_threshold`
   - If true AND `low_balance_alert_sent = false`:
     - Queue `low_balance_alert` email
     - Set `low_balance_alert_sent = true`
   - If `balance >= low_balance_threshold`:
     - Reset `low_balance_alert_sent = false`

3. Implement `reactivateEligibleSubscriptions(provider_id)`:
   - Find subscriptions where:
     - `is_active = false`
     - `deactivation_reason = 'insufficient_funds'`
     - `balance >= competition_level.price_per_lead`
   - Reactivate matching subscriptions
   - Queue notification email
   - Audit log reactivations

4. Call these functions after:
   - Deposit completion
   - Refund completion
   - Manual credit
   - Lead purchase

**Files:**
- `apps/web/lib/services/subscription-status.ts` (update)
- `apps/web/lib/services/balance-alerts.ts` (new)

---

### Phase 9: Refund API ⬜
**Effort:** 1 hour  
**Stories:** Story 6

**Tasks:**
1. Create `POST /api/v1/admin/lead-assignments/:id/refund`:
   - Validate assignment exists and belongs to provider
   - Validate not already refunded (`refunded_at IS NULL`)
   - Get original charge amount
   - Begin transaction:
     - Insert `refund` ledger entry
     - Set `refunded_at = NOW()`
     - Store `refund_reason`
     - Update cached balance
   - Audit log refund action
   - Return 409 Conflict if already refunded

2. Implement idempotent refund detection

**Files:**
- `apps/web/app/api/v1/admin/lead-assignments/[id]/refund/route.ts` (new)

---

### Phase 10: Admin Balance Adjustment API ⬜
**Effort:** 45 minutes  
**Stories:** Story 7

**Tasks:**
1. Create `POST /api/v1/admin/providers/:id/balance-adjust`:
   - Validate memo length (10-500 chars)
   - Validate entry_type (manual_credit or manual_debit)
   - For debits: row-lock and check balance
   - Insert ledger entry with balance_after
   - Update cached balance
   - Audit log adjustment

2. Add MFA requirement

**Files:**
- `apps/web/app/api/v1/admin/providers/[id]/balance-adjust/route.ts` (new)

---

### Phase 11: Provider Billing History API ⬜
**Effort:** 45 minutes  
**Stories:** Story 8

**Tasks:**
1. Create `GET /api/v1/provider/billing/history`:
   - Paginated (default 50)
   - Sorted by created_at DESC
   - Filters: entry_type, date_from, date_to
   - Return ledger entries with related entity info

2. Include lightweight related context (join for level name)

**Files:**
- `apps/web/app/api/v1/provider/billing/history/route.ts` (new)

---

### Phase 12: Admin Billing APIs ⬜
**Effort:** 1 hour  
**Stories:** Story 9

**Tasks:**
1. Create `GET /api/v1/admin/billing/providers`:
   - List providers with balance, last_deposit_at, subscription counts
   - Paginated with search/filter

2. Create `GET /api/v1/admin/billing/providers/:id/ledger`:
   - Provider's ledger history (paginated)
   - Admin view (includes all fields)

3. Create `GET /api/v1/admin/payments`:
   - Query payments by status, provider, date range
   - Paginated

4. All routes require RBAC + MFA

**Files:**
- `apps/web/app/api/v1/admin/billing/providers/route.ts` (new)
- `apps/web/app/api/v1/admin/billing/providers/[id]/ledger/route.ts` (new)
- `apps/web/app/api/v1/admin/payments/route.ts` (new)

---

### Phase 13: Email Templates ⬜
**Effort:** 30 minutes  
**Stories:** Story 5B, Story 10

**Tasks:**
1. Add email templates:
   - `deposit_completed` - Confirmation of deposit
   - `low_balance_alert` - Warning about low balance
   - `subscription_reactivated` - Already exists from EPIC 04
   - `refund_processed` - Confirmation of refund

2. Update `packages/email/types.ts` with template keys

**Files:**
- `packages/email/templates/defaults.ts` (update)
- `packages/email/types.ts` (update)

---

### Phase 14: Audit Actions ⬜
**Effort:** 30 minutes  
**Stories:** All

**Tasks:**
1. Add audit actions to `apps/web/lib/services/audit-logger.ts`:
   - `DEPOSIT_INITIATED` - Provider started deposit
   - `DEPOSIT_COMPLETED` - Deposit credited via webhook
   - `DEPOSIT_FAILED` - Payment failed
   - `LEAD_CHARGED` - Provider charged for lead
   - `REFUND_PROCESSED` - Admin processed refund
   - `BALANCE_ADJUSTED` - Admin manual adjustment
   - `LOW_BALANCE_ALERT_SENT` - Low balance alert triggered

**Files:**
- `apps/web/lib/services/audit-logger.ts` (update)

---

### Phase 15: Integration & Testing ⬜
**Effort:** 2 hours  
**Stories:** All

**Tasks:**
1. Create test script `test-epic07.sh`:
   - Database schema verification
   - Type and validation verification
   - API route existence
   - Build verification

2. Create mock payment handlers for testing:
   - Mock Stripe checkout session
   - Mock PayPal order
   - Mock webhook events

3. Test scenarios:
   - Deposit flow (initiate → webhook → credit)
   - Charge flow (balance check → lock → debit → assignment)
   - Refund flow (validate → credit → mark refunded)
   - Concurrent charge race condition
   - Idempotent webhook handling
   - Low balance alert trigger/reset

**Files:**
- `test-epic07.sh` (new)
- `apps/web/lib/gateways/__mocks__/stripe.ts` (new)
- `apps/web/lib/gateways/__mocks__/paypal.ts` (new)

---

### Phase 16: Documentation & Review ⬜
**Effort:** 1 hour  
**Stories:** All

**Tasks:**
1. Update `DEVELOPMENT_GUIDE.md` with EPIC 07 completion
2. Update `EPIC_EXECUTION_PLAN.md` with status
3. Create `EPIC_07_REVIEW.md` with comprehensive review
4. Update `README.md` with billing setup instructions:
   - Stripe configuration
   - PayPal configuration
   - Environment variables

**Files:**
- `.cursor/docs/DEVELOPMENT_GUIDE.md` (update)
- `.cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md` (update)
- `.cursor/docs/Delivery/EPIC_07_REVIEW.md` (new)
- `README.md` (update)

---

## API Endpoints Summary

### Provider Endpoints (2)
1. `POST /api/v1/provider/deposits` - Initiate deposit
2. `GET /api/v1/provider/billing/history` - View billing history

### Webhook Endpoints (2)
3. `POST /api/v1/webhooks/stripe` - Stripe payment webhook
4. `POST /api/v1/webhooks/paypal` - PayPal payment webhook

### Admin Endpoints (5)
5. `POST /api/v1/admin/lead-assignments/:id/refund` - Refund assignment
6. `POST /api/v1/admin/providers/:id/balance-adjust` - Manual adjustment
7. `GET /api/v1/admin/billing/providers` - List providers with balances
8. `GET /api/v1/admin/billing/providers/:id/ledger` - Provider ledger history
9. `GET /api/v1/admin/payments` - Query payments

### Internal Functions (for EPIC 06)
- `chargeForLeadAssignment()` - Atomic charge + assignment
- `checkAndUpdateSubscriptionStatus()` - Deactivation check
- `reactivateEligibleSubscriptions()` - Reactivation after deposit

---

## New Files Summary

### Types & Validation (3)
- `apps/web/lib/types/billing.ts`
- `apps/web/lib/validations/billing.ts`
- `apps/web/lib/constants/billing.ts`

### Services (4)
- `apps/web/lib/services/ledger.ts`
- `apps/web/lib/services/billing.ts`
- `apps/web/lib/services/payment.ts`
- `apps/web/lib/services/balance-alerts.ts`

### Gateways (2)
- `apps/web/lib/gateways/stripe.ts`
- `apps/web/lib/gateways/paypal.ts`

### Errors (1)
- `apps/web/lib/errors/billing.ts`

### API Routes (9)
- `apps/web/app/api/v1/provider/deposits/route.ts`
- `apps/web/app/api/v1/provider/billing/history/route.ts`
- `apps/web/app/api/v1/webhooks/stripe/route.ts`
- `apps/web/app/api/v1/webhooks/paypal/route.ts`
- `apps/web/app/api/v1/admin/lead-assignments/[id]/refund/route.ts`
- `apps/web/app/api/v1/admin/providers/[id]/balance-adjust/route.ts`
- `apps/web/app/api/v1/admin/billing/providers/route.ts`
- `apps/web/app/api/v1/admin/billing/providers/[id]/ledger/route.ts`
- `apps/web/app/api/v1/admin/payments/route.ts`

### Test Files (3)
- `test-epic07.sh`
- `apps/web/lib/gateways/__mocks__/stripe.ts`
- `apps/web/lib/gateways/__mocks__/paypal.ts`

### Documentation (1)
- `.cursor/docs/Delivery/EPIC_07_REVIEW.md`

---

## Environment Variables Required

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=http://localhost:3000/billing/success
STRIPE_CANCEL_URL=http://localhost:3000/billing/cancel

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_MODE=sandbox  # or "live"
PAYPAL_SUCCESS_URL=http://localhost:3000/billing/success
PAYPAL_CANCEL_URL=http://localhost:3000/billing/cancel

# Billing Configuration
MIN_DEPOSIT_USD=10.00
```

---

## Dependencies to Install

```bash
npm install stripe @paypal/checkout-server-sdk
npm install -D @types/stripe
```

---

## Risk Assessment

### High Risk
1. **Race conditions in charging** - Mitigated by row-level locking
2. **Double-credit from webhooks** - Mitigated by idempotency key
3. **Negative balance** - Mitigated by balance check + lock

### Medium Risk
1. **Payment gateway downtime** - Show user-friendly error
2. **Webhook signature verification** - Use official SDKs
3. **Schema migration complexity** - Careful migration with fallbacks

### Low Risk
1. **Environment variable misconfiguration** - Validation on startup
2. **Email delivery failures** - Non-blocking, retry via queue

---

## Estimated Total Effort

| Phase | Description | Hours |
|-------|-------------|-------|
| 1 | Database Schema | 1.0 |
| 2 | Types & Validation | 0.75 |
| 3 | Ledger & Balance Service | 2.0 |
| 4 | Atomic Charge Service | 1.5 |
| 5 | Payment Gateway Integration | 3.0 |
| 6 | Provider Deposit API | 1.0 |
| 7 | Webhook Handlers | 2.0 |
| 8 | Low-Balance & Subscription Management | 1.5 |
| 9 | Refund API | 1.0 |
| 10 | Admin Balance Adjustment | 0.75 |
| 11 | Provider Billing History | 0.75 |
| 12 | Admin Billing APIs | 1.0 |
| 13 | Email Templates | 0.5 |
| 14 | Audit Actions | 0.5 |
| 15 | Integration & Testing | 2.0 |
| 16 | Documentation & Review | 1.0 |
| **Total** | | **~20 hours (4-5 days)** |

---

## Success Criteria

### Functional
- [ ] Providers can deposit via Stripe and PayPal
- [ ] Webhooks are idempotent (no double-credits)
- [ ] Atomic charging prevents race conditions
- [ ] Balance never goes negative
- [ ] Refunds are one-time per assignment
- [ ] Low-balance alerts work correctly
- [ ] Subscriptions auto-deactivate/reactivate

### Technical
- [ ] TypeScript build passes
- [ ] All routes protected with RBAC/MFA
- [ ] Audit logging for all billing actions
- [ ] Database indexes for performance
- [ ] Signature verification for webhooks

### Documentation
- [ ] README updated with billing setup
- [ ] EPIC_07_REVIEW.md created
- [ ] Status trackers updated

---

## Notes

- This epic is complex with multiple integrations (Stripe, PayPal)
- Consider implementing Stripe first, then PayPal (easier to test)
- Use Stripe test mode and PayPal sandbox for development
- Mock payment gateways for unit testing
- The `chargeForLeadAssignment()` function will be consumed by EPIC 06

---

**Created By:** AI Assistant  
**Last Updated:** Jan 4, 2026  
**Status:** Ready for Implementation

