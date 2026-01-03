# Find Me a Hot Lead — MVP Build Plan (Epics)

This document is the authoritative delivery index for the MVP build. It defines epic sequencing, dependencies, and global delivery standards. Detailed stories and tasks live in per-epic documents.

---

## Epic Dependencies (High-Level)

- **EPIC 01 → All other epics** (foundation & security)
- **EPIC 02 → EPIC 10** (lead confirmation requires email infrastructure)
- **EPIC 03 → EPIC 02** (leads must exist and be confirmed)
- **EPIC 04 → EPIC 05, EPIC 06** (competition levels feed filters & distribution)
- **EPIC 05 → EPIC 06** (eligibility required for distribution)
- **EPIC 06 → EPIC 04, EPIC 05, EPIC 07** (levels, filters, billing)
- **EPIC 07 → EPIC 06** (billing gates distribution)
- **EPIC 08 → EPIC 06, EPIC 07** (assigned leads & balances)
- **EPIC 09 → EPIC 06, EPIC 07** (assignments & ledger)
- **EPIC 10 → EPIC 02, EPIC 03, EPIC 06, EPIC 09** (email used across flows)
- **EPIC 11 → EPIC 06, EPIC 07** (data required for reporting)
- **EPIC 12 → All epics** (observability & ops)

---

## Epic Index (with file links)

### EPIC 01 — Platform Foundation & Access Control
**Goal:** Establish a secure, auditable, and production-ready foundation.

Includes:
- Unified identity & roles
- JWT authentication & sessions
- Admin MFA (MVP)
- Email verification
- Password reset
- Account status management
- RBAC enforcement
- Rate limiting
- Audit logging
- System actor identity
- Secrets & environment management

➡ File: `Epic_01_Platform_Foundation.md`

---

### EPIC 02 — Lead Intake & Confirmation
**Goal:** Safely capture high-quality leads and prevent premature approval or distribution.

Includes:
- Lead submission API
- Niche-based form schemas
- Pending Confirmation state
- Confirmation token (hashed, expiring)
- Confirmation success/rejection UI states
- Resend confirmation
- Attribution capture (UTM, referrer, partner placeholders)

➡ File: `Epic_02_Lead_Intake_Confirmation.md`

---

### EPIC 03 — Admin Lead Review & Approval
**Goal:** Enable human quality control before monetization.

Includes:
- Admin lead review UI
- Approval & rejection flows
- Optional end-user notification toggle
- Audit trail

➡ File: `Epic_03_Admin_Lead_Review_Approval.md`

---

### EPIC 04 — Competition Levels & Provider Subscriptions
**Goal:** Enable tiered competition and pricing.

Includes:
- Niche management (enable/disable; form schema management; dropdown values)
- Competition Level CRUD
- Pricing per level
- Default competition level per niche
- Competition level ordering & reordering
- Provider subscriptions (multi-level)

➡ File: `Epic_04_Competition_Levels_Subscriptions.md`

---

### EPIC 05 — Provider Filters & Eligibility Engine
**Goal:** Ensure providers only receive relevant leads.

Includes:
- Filter schema & persistence
- Eligibility evaluation (app-layer contract)
- Filter change logs (per competition level)
- Admin visibility into filter history

➡ File: `Epic_05_Filters_Eligibility.md`

---

### EPIC 06 — Lead Distribution Engine
**Goal:** Fair, deterministic, and atomic lead distribution.

Includes:
- Niche-level starting position rotation
- Within-level least-recently-served fairness
- Cascading across competition levels
- Deduplication across levels
- Atomic assignment + billing
- Insufficient balance handling

➡ File: `Epic_06_Distribution_Engine.md`

---

### EPIC 07 — Provider Billing, Balance & Payments
**Goal:** Accurate pay-per-lead billing.

Includes:
- Provider balances & ledger
- Stripe & PayPal deposits
- Auto-deactivation on low balance
- Low-balance alerts

➡ File: `Epic_07_Billing_Balance_Payments.md`

---

### EPIC 08 — Provider Lead Management
**Goal:** Provider visibility and confidence.

Includes:
- Provider dashboard
- Lead list & details
- Balance & transaction history

➡ File: `Epic_08_Provider_Lead_Management.md`

---

### EPIC 09 — Bad Lead & Refund Management
**Goal:** Controlled dispute resolution.

Includes:
- Provider bad lead requests
- Admin decisions (approve/reject with memo)
- Global Bad Lead handling
- Credits & ledger reconciliation

➡ File: `Epic_09_Bad_Lead_Refunds.md`

---

### EPIC 10 — Notifications & Email Infrastructure
**Goal:** Reliable communication without driving business logic.

Includes:
- Email templates (admin-editable)
- Template versioning
- Delivery/open/bounce tracking (informational)
- Provider webhooks for email events (e.g., SES/SendGrid)

➡ File: `Epic_10_Notifications_Email.md`

---

### EPIC 11 — Reporting & Analytics (MVP)
**Goal:** Basic operational visibility.

Includes:
- Lead volume & revenue reports
- Provider activity reports
- CSV exports

➡ File: `Epic_11_Reporting_Analytics.md`

---

### EPIC 12 — Observability, Reliability & Ops
**Goal:** Operate safely from day one.

Includes:
- Queues & retries
- Monitoring & alerting
- Backups & recovery
- Health checks

➡ File: `Epic_12_Observability_Ops.md`

---

## Platform-Wide Definition of Done

Every epic must satisfy:
- [ ] All API inputs validated (schema-based)
- [ ] RBAC enforced server-side
- [ ] All privileged actions audit-logged
- [ ] Rate limiting applied
- [ ] No secrets in code
- [ ] Parameterized DB queries only
- [ ] Transactions used where atomicity is required
- [ ] Unit & integration tests passing
- [ ] Security checks (SQLi, XSS, CSRF)
- [ ] Documentation updated

---

