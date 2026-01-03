# Find Me a Hot Lead
## Product Requirements Document — MVP (Document 1, v1.1)

---

## 1. Purpose

This document defines the **functional and non-functional requirements for the MVP** of *Find Me a Hot Lead*.

The goal of the MVP is to:
- Validate the Competition Level–based lead distribution model
- Launch with two digital service niches (VPS & Dedicated Servers)
- Enable monetization through pay-per-lead
- Ensure fairness, transparency, and financial accuracy
- Provide a stable foundation for future partner, CRM, and affiliate expansion

This document intentionally excludes Phase 2+ functionality.

---

## 2. In Scope (MVP)

- VPS Hosting niche
- Dedicated Servers niche
- Admin-managed lead approval and distribution
- Competition Level–based subscriptions
- Provider filters per Competition Level
- Pay-per-lead billing
- Bad lead dispute handling
- Admin, Provider, and End User interfaces
- API-first lead intake
- Attribution tracking (basic)
- Stripe & PayPal payments

---

## 3. Out of Scope (MVP)

The following are explicitly **not part of MVP** (but must not be blocked by MVP design):

- Partner / affiliate dashboards
- Auto-approval of leads
- Auto top-up execution (settings only)
- Provider bidding
- Built-in CRM workflows
- External CRM integrations
- Masked email / phone relay
- End-user accounts
- Provider scheduling / availability windows

---

## 4. Supported Niches (MVP)

### 4.1 VPS Hosting  
### 4.2 Dedicated Servers

Requirements:
- Each niche has:
  - Its own lead form schema
  - Its own Competition Levels
  - Its own pricing
- The system must support adding new niches without schema redesign.

---

## 5. User Roles

### 5.1 End Users (Lead Submitters)
- Submit service requests via public forms
- Provide required and optional information
- Receive confirmation email and confirm lead submission
- Are contacted directly by service providers

### 5.2 Service Providers (Lead Buyers)
- Receive and manage leads
- Subscribe & Unsubscribe to Competition Levels
- Configure filters per Competition Level
- Deposit and maintain account balance
- Request refunds for bad leads

### 5.3 Admins
- Approve and manage leads
- Approve and manage providers
- Configure niches, Competition Levels, and pricing
- Handle disputes and refunds
- Manage platform finances and reporting

---

## 6. Lead Intake Requirements

### 6.1 Lead Submission
- Leads must be submitted via API.
- Public landing pages consume the same API securely without exposing internal/integration APIs.
- Leads must confirm submission via confirmation email.
- Each lead must capture:
  - Required: email
  - Optional: phone
  - Niche-specific fields
  - Referrer URL
  - UTM parameters (if present)
  - Partner ID (nullable, future use)
  - Timestamp

### 6.2 Lead Statuses (MVP)

**Lead-level statuses:**
- Pending Confirmation
- Pending Approval
- Approved
- Rejected
- Distributed
- Bad Lead (Global)

> **Important:** Refunded is **not** a Lead status. Refunds apply at the Lead Assignment (per-provider) level.

---

## 7. Lead Approval & Confirmation

- A lead cannot be approved or distributed until the end user has confirmed their submission via the confirmation email.
- Until confirmed, the lead remains in **Pending Confirmation** and may be rejected.
- All confirmed leads require **manual admin approval**.
- Approved leads are automatically distributed.
- Rejected leads are never distributed.

**Post-distribution rules:**
- Once a lead is distributed, it cannot be rejected.
- Post-distribution invalidation must occur via:
  - Global Bad Lead, or
  - Per–Service Provider refund

---

## 8. Competition Levels

### 8.1 Definition
Competition Levels represent **how many providers receive a lead** and **how much each provider pays per lead**.

Competition Levels define:
- How many Service Providers receive a lead
- How much each Service Provider pays per lead

Competition Levels are not merely pricing tiers; they are a market mechanism that balances fairness, exclusivity, and budget accessibility by controlling how many providers compete for each lead.

### 8.2 Configuration (Per Niche)
Each Competition Level includes:
- Name
- Order (priority)
- Max providers per lead
- Price per lead
- Active / inactive flag

### 8.3 Provider Subscription
- Providers may subscribe to multiple Competition Levels.
- Each subscription has its own filters.
- Providers can pause or resume subscriptions.

---

## 9. Provider Filters

### Requirements
- Filters are configured **per Competition Level**.
- All filters default to “accept all”.
- Filter types must be extensible:
  - Dropdown (MVP)
  - Multi-select
  - Future: checkbox, numeric, text

### Behavior
- A provider only receives a lead if all filters match.
- Filters are evaluated during distribution.
- Filter changes apply only to leads that have not yet been distributed.
- Pending leads use the most recently saved filters at the time of distribution.
- Distributed leads are never re-evaluated.
- All filter changes are logged and visible to both Service Providers (per Competition Level) and Admins.

---

## 10. Lead Distribution Logic

### 10.1 Distribution Rules
- Distribution starts at a rotating Competition Level (lead-to-lead rotation).
- Providers must:
  - Match filters
  - Have sufficient balance
  - Not have already received the lead
- If max distribution is not met at a Competition Level:
  - Cascade to the next level.
- Distribution is **one-time only**.

### 10.2 Fairness Model

Lead distribution uses a **two-dimensional fairness model**:

1. **Within a Competition Level (Provider Fairness)**  
   - Eligible providers are ordered by **least recently served**.
   - The provider who has gone the longest without receiving a lead is prioritized.

2. **Across Competition Levels (Lead-to-Lead Fairness)**  
   - Each new lead rotates the starting Competition Level.
   - Prevents higher-priced levels from always receiving first access.

This ensures fairness even when provider eligibility varies due to filters.

### 10.3 Charging
- Providers are charged immediately upon assignment.
- Charges are ledgered.
- No lead is delivered without a successful charge.

---

## 11. Provider Billing & Balance

### 11.1 Payments
- Supported methods:
  - Stripe
  - PayPal
- Providers pre-fund their account balance.

### 11.2 Balance Rules
- Providers with insufficient balance cannot receive leads.
- Providers whose balance drops below the minimum required for subscribed Competition Levels are auto-deactivated.
- When balance is restored, eligible Competition Levels are auto-reactivated and the provider is notified.
- Providers can configure low-balance alert thresholds.

### 11.3 Ledger
- All financial transactions are recorded:
  - Deposits
  - Charges
  - Refunds
  - Admin credits/debits

---

## 12. Bad Lead Handling

Refund classification and resolution is a **manual administrative decision**.

### 12.1 Provider-Initiated Requests
- Providers may submit a bad lead request with:
  - Reason
  - Optional notes
- Providers may only submit a bad lead request for Distributed leads

Admin outcomes:
- **Approve Refund:** refund this provider for this lead
- **Reject Request:** must include admin memo; no refund
- **Global Bad Lead:** mark lead as globally invalid and refund all providers

### 12.2 Admin-Initiated
- Admin may mark a lead as Global Bad Lead at any time after distribution.
- All providers receive refunds automatically and notified of the lead change and refund they've received.
- All pending Provider-Initiated Requests related to this lead will be approved (Global Bad Lead), but only refunded once (if they've received a refund for this lead already then they wouldn't receive an additional refund, but will receive a refund if they haven't received a refund already). Any existing **Approve Refund** for this lead will be updated to **Global Bad Lead** and will not receive any additional refund, given they've already received a refund for this lead.
- All pending Provider-Initiated Requests related to this lead will be approved (Global Bad Lead), but only refunded once (if they've received a refund for this lead already then they wouldn't receive an additional refund, but will receive a refund if they haven't received a refund already). Any existing **Approve Refund** for this lead will be updated to **Global Bad Lead** and will not receive any additional refund, given they've already received a refund for this lead.

---

## 13. Notifications & Email

- Email notifications for:
  - Lead confirmation
  - New lead assigned
  - Lead rejected / refunded
  - Low balance alerts
- Email open tracking is recorded for informational purposes only.
- Open tracking must not determine refund eligibility.
- Email templates are admin-configurable.
- Email submitted by End Users must be valid

---

## 14. Admin Interface Requirements

Admins must be able to:
- Approve/reject leads
- View lead distribution, notifications, and financials
- Add and manage Service Providers
- Configure niches and forms
- Configure Competition Levels and pricing
- Handle disputes and refunds
- Credit/debit provider balances
- View revenue and lead analytics
- View audit logs

### 14.1 Audit & Change Logs

Audit logs must include:
- Provider profile changes
- Subscription and filter changes
- Competition Level configuration changes
- Manual financial actions
- Lead state changes

Each log entry records:
- Entity type & ID
- Action
- Previous and new values
- Actor
- Timestamp
- Optional admin-only memo

Logs are immutable.

---

## 15. Service Provider Interface Requirements

Providers must be able to:
- View assigned leads
- See Competition Level per lead
- Manage subscriptions and filters
- View balances and ledger
- Submit bad lead requests
- View filter change history per Competition Level
- Configure notifications

Providers must NOT see:
- Other providers
- Other Competition Levels for a lead

---

## 16. End User Interface Requirements

End users must be able to:
- Submit a lead via public form
- Confirm submission via email link
- Be contacted directly by providers

---

## 17. Reporting & Analytics (MVP)

### Admin
- Leads submitted / approved / rejected
- Revenue per lead, niche, provider, Competition Level
- Refund rates
- Service Provider activity

### Providers
- Leads received
- Spend
- Refunds

CSV export required.

---

## 18. Non-Functional Requirements

- API-first architecture
- Role-based access control
- Deterministic distribution
- Financial consistency
- Full audit trail
- Multi-niche scalability

---

## 19. Success Criteria (MVP)

- Fair and correct lead distribution
- Providers only pay for delivered leads
- Admins can manage disputes and finances
- VPS & Dedicated Servers supported end-to-end
- No blockers for Phase 2+

---

## 20. Dependencies

- Stripe & PayPal
- Email delivery service
- Hosting & database infrastructure

---

## 21. Related Documents

- Document 0: Product Overview & Context
- Document 2: PRD — Phase 2 (Partners & Growth)
- Document 3: PRD — Phase 3 (CRM & Ecosystem)
- Document 4: Technical Architecture

---

