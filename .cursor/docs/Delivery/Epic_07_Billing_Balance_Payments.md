# EPIC 07 — Billing & Payments (LOCKED, Architecture-Aligned)

## Epic Goal
Enable secure provider deposits and deterministic, auditable billing for lead distribution via an immutable ledger, supporting **Stripe + PayPal**, webhook idempotency, race-condition safety, and operational guardrails (low-balance alerts, subscription reactivation).

---

## Scope (MVP)
- Provider deposits via Stripe + PayPal (checkout/order creation + webhook completion)
- Immutable **provider_ledger** with **balance_after**
- Cached provider balance and low-balance alert state
- Idempotent webhook processing (no double credits)
- Atomic charge + lead assignment (used by Epic 06)
- Refunds as **ledger credits** tied to lead assignments (admin-driven in MVP)
- Admin balance adjustments (memo required; min/max length)
- Provider + Admin billing history views (paginated)
- Subscription reactivation checks after balance increases

## Out of Scope (MVP)
- Auto-top-up execution (schema supports future)
- Gateway-level refunds/reversals (refunds are credits)
- Multi-currency settlement (USD-only in MVP, but currency column exists)

---

## Dependencies
- **EPIC 01 — Platform Foundation** (RBAC, Admin MFA, audit_log, JWT)
- **EPIC 04 — Competition Levels & Subscriptions** (provider_subscriptions, is_active)
- **EPIC 06 — Distribution Engine** (calls atomic charge logic)
- **EPIC 09 — Bad Lead & Refunds** (refund triggers + policies)
- **EPIC 10 — Email Infrastructure** (emails + email_events)
- **EPIC 12 — Observability & Ops** (queues/alerts, BullMQ, metrics)

---

## Key Principles
1. **Ledger is source of truth**: Balance = latest cached value (fast reads) with periodic reconciliation against ledger SUM.
2. **No negative balance**: Charges require row-locking and transactional checks.
3. **Idempotent webhooks**: Duplicate events must be safe and return 200.
4. **Traceability**: Every balance change is linked to actor + entity + memo when relevant.
5. **Deterministic charging**: Lead assignment + billing happen atomically.

---

## Stories & Tasks

### Story 1: Provider Ledger + Balance Model (Architecture-Aligned)
**As a** system  
**I want** an immutable provider ledger with balance snapshots  
**So that** billing is auditable and balances can be reconciled

**Acceptance Criteria**
- Ledger entries are immutable (no updates/deletes except by admin DB access; app exposes no mutation endpoints)
- Ledger entry types: `deposit`, `lead_purchase`, `refund`, `manual_credit`, `manual_debit`
- Each entry stores **balance_after**
- Each entry links to related entities where applicable:
  - `related_lead_id`, `related_subscription_id`, `related_payment_id`
- Each entry stores `actor_id`, `actor_role`, and optional `memo`
- Providers have cached fields:
  - `balance` (fast reads), `low_balance_threshold`, `low_balance_alert_sent`
- Balance never goes negative

**Tasks**
- Implement **provider_ledger** table (see schema) with required foreign keys
- Implement **providers balance fields** (see schema)
- Implement `calculateBalance(provider_id)` helper (SUM ledger entries; used for reconciliation)
- Implement `updateProviderBalance(provider_id, balance_after)` hook (update cached providers.balance after ledger insert)
- Populate `balance_after` on each ledger insert (application logic)
- Add nightly reconciliation job:
  - Compare cached `providers.balance` vs SUM(ledger) within tolerance (0.01)
  - Log discrepancies + alert

---

### Story 2: Provider Deposit Initiation (Stripe + PayPal) + Minimum Deposit
**As a** provider  
**I want** to deposit funds securely  
**So that** I can receive leads

**Acceptance Criteria**
- Provider can initiate deposit via `/api/v1/provider/deposits`
- Supported providers: `stripe`, `paypal`
- **Minimum deposit enforced** (global config): `MIN_DEPOSIT_USD = 10.00` (can be env var)
- Request validated server-side (frontend validation is additive, not primary)
- Creates `payments` record with status `pending` before redirecting provider
- Returns checkout URL / approval URL

**Tasks**
- Define `MIN_DEPOSIT_USD` (env-configurable)
- Implement POST `/api/v1/provider/deposits`
  - Validate amount >= MIN_DEPOSIT_USD
  - Validate provider is active (not suspended)
  - Create `payments` row status `pending`
  - Create Stripe Checkout Session OR PayPal Order
  - Store gateway identifiers in `payments.metadata`
  - Return `{ payment_id, provider_name, checkout_url }`

---

### Story 3: Webhook Processing (Stripe + PayPal) — Idempotent Credits
**As a** system  
**I want** webhook processing to be idempotent and secure  
**So that** deposits are credited exactly once

**Acceptance Criteria**
- Webhook endpoints:
  - `POST /api/v1/webhooks/stripe`
  - `POST /api/v1/webhooks/paypal`
- Signatures verified (Stripe signature header; PayPal webhook verification)
- Idempotency key:
  - `payments.external_payment_id` (gateway ID) + `provider_name`
- **Unique constraint** prevents double-credit: `UNIQUE(provider_name, external_payment_id)`
- Duplicate webhook events return **200 OK** and do not double-credit
- On successful payment:
  - Update `payments.status → completed`
  - Insert `provider_ledger` entry type `deposit` with balance_after
  - Update cached `providers.balance`
  - Queue notification email (Epic 10) if enabled
- On failed payment:
  - Update `payments.status → failed`

**Tasks**
- Add unique constraint: `UNIQUE(provider_name, external_payment_id)`
- Implement Stripe webhook handler:
  - Verify signature
  - Extract external_payment_id
  - Lookup payment by (provider_name, external_payment_id)
  - If already completed: return 200 (idempotent)
  - Else: mark completed, credit ledger in transaction
- Implement PayPal webhook handler similarly
- Add indexes for fast lookups (see schema)
- Emit metrics: webhook latency, idempotent-hit count

---

### Story 4: Atomic Charge for Lead Assignment (Used by Epic 06)
**As a** system  
**I want** to charge providers atomically when assigning leads  
**So that** assignments never occur without payment

**Acceptance Criteria**
- Charge + lead_assignment creation occur within **one DB transaction**
- Prevent race conditions with row-level lock:
  - `SELECT ... FOR UPDATE` on provider row (or balance row)
- Isolation level: **READ COMMITTED** (default) with safe locking
- If insufficient balance, transaction fails and assignment is not created
- Ledger entry type `lead_purchase` created with:
  - related_lead_id, related_subscription_id
  - actor_role = `system`
- `balance_after` correctly reflects post-debit balance
- Concurrency safe: two assignments racing cannot both spend the same balance

**Tasks**
- Implement `chargeForLeadAssignment(provider_id, lead_id, subscription_id, amount)`
- Transaction steps:
  1) `SELECT providers.balance FROM providers WHERE id=? FOR UPDATE`
  2) Check `balance >= amount`
  3) Insert `provider_ledger` debit entry `lead_purchase` with balance_after
  4) Update cached `providers.balance`
  5) Insert lead_assignment (Epic 06)
- Add retry logic for transient DB errors (serialization/lock timeouts)
- Add concurrency tests: multiple parallel charges with limited balance

---

### Story 5A: Auto-Deactivation on Insufficient Balance
**As a** system  
**I want** subscriptions deactivated when funds are insufficient  
**So that** unpaid lead delivery cannot occur

**Acceptance Criteria**
- When `providers.balance < competition_levels.price_per_lead` for a subscription:
  - subscription `is_active = false`
  - `deactivation_reason = 'insufficient_funds'`
- Distribution excludes inactive subscriptions
- Deactivation is audit-logged and provider is notified (Epic 10) if enabled

**Tasks**
- Implement `checkAndUpdateSubscriptionStatus(provider_id)` (Epic 04 hook)
- Call after:
  - lead_purchase
  - deposit
  - refund
  - admin manual adjustments

---

### Story 5B: Low-Balance Alerts (Threshold-based)
**As a** provider  
**I want** to be alerted when my balance is low  
**So that** I can top up before deactivation

**Acceptance Criteria**
- Provider can set `low_balance_threshold` (nullable)
- Alert sent once when:
  - `balance < low_balance_threshold` AND `low_balance_alert_sent = false`
- Alert resets when:
  - `balance >= low_balance_threshold` → `low_balance_alert_sent = false`
- Email uses template `low_balance_alert` (Epic 10)
- Preference key: `notify_on_low_balance` default true

**Tasks**
- Add provider fields: `low_balance_threshold`, `low_balance_alert_sent`
- Implement `checkLowBalanceAlert(provider_id)` invoked after balance changes
- Queue `low_balance_alert` email when threshold crossed

---

### Story 6: Refunds as Credits (Admin-Driven; Assignment-Tied)
**As an** admin  
**I want** to refund a lead assignment as a credit  
**So that** disputes can be resolved fairly without gateway reversals

**Acceptance Criteria**
- Refund request references a **lead_assignment_id**
- Refund eligibility rules:
  - assignment exists and belongs to provider
  - assignment has not been refunded (`refunded_at IS NULL`)
  - refund amount equals original charge (`lead_assignments.price_charged`)
  - refund cannot exceed original charge (enforced by using price_charged)
- On refund:
  - Insert `provider_ledger` entry type `refund`
  - Set `lead_assignments.refunded_at = NOW()`
  - Store `refund_reason` (admin-provided)
  - Update cached balance
- Refund is idempotent:
  - second request returns 409 Conflict (already refunded)

**Tasks**
- Implement POST `/api/v1/admin/lead-assignments/:id/refund`
  - Validate refund eligibility
  - Begin transaction
  - Insert ledger `refund` entry with balance_after and related entities
  - Update assignment refunded_at + refund_reason
  - Update cached providers.balance
- Audit log refund action (actor_role=admin) with memo + reason

---

### Story 7: Admin Manual Balance Adjustments (Memo Required)
**As an** admin  
**I want** to adjust balances with strict memo requirements  
**So that** every manual change is explainable

**Acceptance Criteria**
- Admin can create ledger entries:
  - `manual_credit` or `manual_debit`
- **Memo required**:
  - min length 10 chars, max 500 chars
- `actor_id` and `actor_role` recorded
- Manual debits cannot make balance negative

**Tasks**
- Implement POST `/api/v1/admin/providers/:id/balance-adjust`
  - payload: `{ entry_type: 'manual_credit'|'manual_debit', amount, memo }`
  - Validate memo length
  - Row-lock provider for debits
  - Insert ledger entry with balance_after
  - Update cached balance
- Audit log adjustment action

---

### Story 8: Provider Billing History (Ledger View)
**As a** provider  
**I want** to view my billing history  
**So that** I can reconcile charges and deposits

**Acceptance Criteria**
- Endpoint returns paginated ledger entries (default page size 50)
- Sorted by `created_at DESC`
- Returns fields:
  - `entry_type`, `amount`, `balance_after`, `created_at`, `memo`, `actor_role`
  - related entity identifiers: `related_lead_id`, `related_subscription_id`, `related_payment_id`
- Supports filters:
  - by `entry_type`
  - date range

**Tasks**
- Implement GET `/api/v1/provider/billing/history?page=1&limit=50&entry_type=&date_from=&date_to=`
- Add DB index: `(provider_id, created_at DESC)`
- Include lightweight related context (optional for MVP): competition level name via join

---

### Story 9: Admin Billing Oversight
**As an** admin  
**I want** to see provider balances and ledgers  
**So that** I can troubleshoot billing issues

**Acceptance Criteria**
- Admin can list providers with:
  - balance, last_deposit_at, low_balance_threshold, subscription counts
- Admin can view provider ledger (paginated, default 50, sorted desc)
- Admin can query payments by status/date/provider
- All routes require RBAC + MFA

**Tasks**
- GET `/api/v1/admin/billing/providers`
- GET `/api/v1/admin/billing/providers/:id/ledger?page=1&limit=50`
- GET `/api/v1/admin/payments?status=&provider_id=&date_from=&date_to=`

---

### Story 10: Subscription Reactivation After Deposit/Refund
**As a** provider  
**I want** my subscriptions reactivated after I add funds  
**So that** I can resume receiving leads

**Acceptance Criteria**
- After any balance increase (deposit/refund/manual_credit):
  - Reactivate subscriptions where `balance >= price_per_lead`
  - Notify provider of reactivated levels (Epic 10) if enabled
  - Audit-log reactivation events
- Runs immediately after balance changes + periodic job safety net

**Tasks**
- Implement `reactivateEligibleSubscriptions(provider_id)`
- Invoke after:
  - deposit completion
  - refund completion
  - manual_credit
- Add periodic job (every 5 minutes) to catch missed updates

---

## API Endpoints (Detailed)

### POST /api/v1/provider/deposits
**Request**
```json
{
  "provider_name": "stripe",
  "amount": 50.00,
  "currency": "USD"
}
```
**Responses**
- `201 Created`
```json
{
  "payment_id": "uuid",
  "provider_name": "stripe",
  "checkout_url": "https://...",
  "status": "pending"
}
```
- `400 Bad Request` (below minimum)
```json
{ "error": "minimum_deposit", "message": "Minimum deposit is 10.00 USD." }
```
- `403 Forbidden` (suspended)
- `429 Too Many Requests`

### POST /api/v1/webhooks/stripe
- Verifies signature
- Idempotent by (provider_name, external_payment_id)
- Returns `200 OK` always for duplicates

### POST /api/v1/webhooks/paypal
- Verifies webhook authenticity
- Same idempotency guarantees

### POST /api/v1/admin/lead-assignments/:id/refund
**Request**
```json
{
  "refund_reason": "Bad lead - wrong service area",
  "memo": "Approved refund per policy #BL-02"
}
```
**Responses**
- `200 OK` with updated balance
- `409 Conflict` if already refunded
- `400 Bad Request` if invalid assignment

### POST /api/v1/admin/providers/:id/balance-adjust
**Request**
```json
{
  "entry_type": "manual_debit",
  "amount": 25.00,
  "memo": "Chargeback correction for duplicate deposit"
}
```
**Responses**
- `200 OK`
- `400 Bad Request` memo invalid or amount invalid
- `409 Conflict` insufficient funds for debit

### GET /api/v1/provider/billing/history
Supports: `page`, `limit`, `entry_type`, `date_from`, `date_to`

### Admin endpoints
- GET `/api/v1/admin/billing/providers`
- GET `/api/v1/admin/billing/providers/:id/ledger`
- GET `/api/v1/admin/payments`

---

## Database Schema (Architecture-Aligned)

### providers (balance-related fields)
```sql
-- If providers is separate from users, use providers(id). If not, adapt to users(id).
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  ADD COLUMN IF NOT EXISTS low_balance_threshold DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS low_balance_alert_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_topup_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_topup_threshold DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS auto_topup_amount DECIMAL(10,2);
```

### payments
```sql
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  provider_name VARCHAR(255) NOT NULL CHECK (provider_name IN ('stripe', 'paypal')),
  external_payment_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending','completed','failed','refunded')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payments_provider_external UNIQUE(provider_name, external_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_provider_status 
  ON payments(provider_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_external_id 
  ON payments(external_payment_id);
```

### provider_ledger
```sql
CREATE TABLE IF NOT EXISTS provider_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('deposit','lead_purchase','refund','manual_credit','manual_debit')),
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  related_lead_id UUID REFERENCES leads(id),
  related_subscription_id UUID REFERENCES provider_subscriptions(id),
  related_payment_id UUID REFERENCES payments(id),
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(20) CHECK (actor_role IN ('system','admin','provider')),
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_ledger_provider_created 
  ON provider_ledger(provider_id, created_at DESC);
```

---

## Testing Requirements

### Unit Tests
- Balance calculation from ledger entries
- Ledger entry validation (entry_type, amount, balance_after)
- Webhook signature verification (stripe/paypal)
- Idempotency detection (duplicate external_payment_id)
- Refund eligibility validation
- Admin memo validation (min/max length)
- Low-balance threshold crossing + reset logic

### Integration Tests
- Deposit flow: initiate → webhook → ledger credit → balance update → notification
- Charge flow: assignment → balance lock → ledger debit → assignment persisted
- Refund flow: refund → ledger credit → assignment refunded_at → reactivation
- Auto-deactivation: balance drop → subscription deactivated → email
- Reactivation: deposit/refund → subscriptions reactivated → email/audit log

### Race Condition Tests
- Concurrent assignments with limited funds (only one succeeds)
- Concurrent deposits (both credited once each)
- Concurrent duplicate webhook events (no double-credit)
- Concurrent refund attempts (idempotent block)

### Balance Reconciliation Tests
- Cached balance matches SUM(ledger)
- balance never negative
- balance_after correctness across sequences

### Performance Tests
- Ledger queries with 10,000 entries return < 500ms
- Webhook processing < 500ms avg
- Balance check+charge transaction < 100ms avg

---

## Definition of Done
- All schema matches locked architecture (payments + provider_ledger + provider balance fields + indexes)
- Deposits support Stripe + PayPal end-to-end (initiate + webhook complete)
- Webhooks secured and idempotent (duplicate events safe, no double credits)
- Balance updates are deterministic with balance_after and cached balance
- Atomic lead purchase charging implemented with row locking
- Low-balance alerting implemented with state tracking and reset logic
- Refunds are assignment-tied, one-time only, amount equals original charge
- Manual adjustments require memo (10–500 chars) and are audit-logged
- Subscriptions auto-deactivate/reactivate based on balance changes
- Tests cover idempotency, concurrency, reconciliation, and negative balance prevention
- All provider/admin routes enforce RBAC; admin routes require MFA

---
