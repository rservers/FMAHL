# Find Me a Hot Lead  
## Product Requirements Document — MVP (Document 1)

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
- Leads must confirm lead submission (link via confirmation email)
- Each lead must capture:
  - Required: email
  - Optional: phone
  - Niche-specific fields
  - Referrer URL
  - UTM parameters (if present)
  - Partner ID (nullable, future use)
  - Timestamp

### 6.2 Lead Statuses
- Pending Confirmation 
- Pending Approval
- Approved
- Rejected
- Distributed
- Bad Lead (Global)
- Refunded

---

## 7. Lead Approval

- A lead cannot be approved or distributed until the end user has confirmed their submission via the confirmation email. Until that happens, the lead will remain in Pending Confirmation status where it can be rejected.
- All leads require **manual admin approval**.
- Approved leads are automatically distributed.
- Rejected leads are never distributed.
- Global Bad Lead status refunds all assigned providers.
- Refunded leads are not Global (in case of filter/criteria mismatch)

---

## 8. Competition Levels

### 8.1 Definition
Competition Levels represent **how many providers receive a lead** and **how much each provider pays per lead**.

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
- Filter changes apply only to leads that have not yet been distributed. Distributed leads are not affected by filter updates. Pending leads will use the most recently saved filter configuration at the time of distribution.
- All filter changes are logged and visible to both the Service Provider (per Competition Level) and Admins via the audit log.

---

## 10. Lead Distribution Logic

### 10.1 Distribution Rules
- Distribution starts at the highest applicable Competition Level and then round-robin across Competition Levels with each subsequent lead.
- Uses round-robin within each level.
- Providers must:
  - Match filters
  - Have sufficient balance
  - Not have already received the lead
- If max distribution is not met:
  - Cascade to the next Competition Level.
- Distribution is **one-time only**.

### 10.2 Charging
- Provider is charged immediately upon assignment.
- Charges are ledgered.
- No lead is delivered without successful charge.

### 10.3 Round-Robin Behavior

Lead distribution follows a two-dimensional round-robin model to ensure fairness across both service providers and Competition Levels:

1. **Within a Competition Level (Provider Rotation)**  
   - Service Providers subscribed to the same Competition Level are selected using round-robin distribution.
   - This ensures equal opportunity among providers at the same Competition Level.
   - Provider rotation state is persisted between leads.

2. **Across Competition Levels (Lead-to-Lead Rotation)**  
   - Each new lead rotates the *starting Competition Level* used for distribution.
   - This prevents higher Competition Levels from always receiving first priority and ensures fair exposure across all subscribed levels over time.
   - Cascading rules still apply if the maximum distribution count is not met within a given Competition Level.

---

## 11. Provider Billing & Balance

### 11.1 Payments
- Supported methods:
  - Stripe
  - PayPal
- Providers pre-fund their balance.

### 11.2 Balance Rules
- Providers with insufficient balance cannot receive leads.
- Providers with balance below lead price are auto-deactivated and will receive an email notification. 
- Auto-reactivate when balance ≥ minimum required (Service Provider tops up their balance) and will receive an email notification of Competition Level(s) reactivated.
- Providers can set a low-balance alert threshold and will receive an email notification when that balance is met or surpassed.

### 11.3 Ledger
- All transactions are recorded:
  - Deposits
  - Charges
  - Refunds
  - Admin credits/debits

---

## 12. Bad Lead Handling
Refund classification and resolution is a manual administrative decision. The system does not automatically infer refund eligibility based on reason alone; administrators are responsible for selecting the appropriate outcome and documenting their decision.

### 12.1 Provider-Initiated
- Providers may submit a bad lead request.
- Request includes:
  - Reason
  - Optional notes
- Admin reviews:
  - Approve → refund issued
  - Reject → must include memo, refund this Service Provider for this lead and update the status to Refunded.
  - Bad Lead (Global) → must issue memo, update lead status to Bad Lead globally and issue a refund to all Service Providers that received this lead.

### 12.2 Admin-Initiated
- Admin may mark a lead as globally bad.
- All providers receive refunds automatically.
- Status updated to Bad Lead

---

## 13. Notifications & Email

### Requirements
- Email notifications for:
  - New lead assigned
  - Lead rejected (Bad Lead) / refunded
  - Low balance alerts
- Email read tracking must be recorded (open tracking). Email open tracking is informational and does not alone determine lead validity or refund eligibility.
- Email templates configurable by admin.
- Email submitted by End Users must be valid

---

## 14. Admin Interface Requirements

Admins must be able to:
- Approve/reject leads
- View lead activity - emails/nofitications, distribution breakdown, finances
- Add and manage Service Providers 
- Configure niches and forms (including fields and field options/type)
- Configure Competition Levels and pricing including viewing 
- Handle disputes and refunds
- Credit/debit provider balances and manage finances
- View revenue and lead reports
- View audit logs

### 14.1 Admin Audit & Change Logs

Admins must be able to view an audit log of all critical system changes to support transparency, dispute resolution, and operational accountability.

The audit log must include, at a minimum:

- Changes to Service Provider profiles
- Changes to Service Provider Competition Level subscriptions
- Changes to Service Provider filters per Competition Level
- Changes to Competition Level configuration (pricing, caps, order, status)
- Manual financial actions (credits, debits, refunds)
- Lead status changes (approval, rejection, global bad lead)

Each log entry must record:
- Entity type (e.g., Provider, Competition Level, Lead)
- Entity identifier
- Action performed
- Previous value(s)
- New value(s)
- Actor (admin user)
- Timestamp
- Optional admin note or memo

Audit logs are read-only and cannot be modified or deleted.


---

## 15. Service Provider Interface Requirements

Providers must be able to:
- View assigned leads
- See Competition Level per lead
- Configure Competition Level subscriptions
- Manage filters per subscription
- View balances and ledger
- Submit bad lead requests
- Configure notifications
- Service Providers must be able to view a history of filter changes per Competition Level, including timestamps, to support transparency and dispute resolution.


Providers must NOT see:
- Other providers
- Other Competition Levels for a lead

---

## 16. End User Interface Requirements

End users must be able to:
- Submit a lead via public form
- Receive confirmation email and confirm lead submission via confirmation link
- Be contacted by providers directly via email

---

## 17. Reporting & Analytics (MVP)

### Admin
- Leads submitted
- Leads approved/rejected
- Revenue per niche, per lead, per Service Provider, and per Competition Level
- Refund rate
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
- Scalable to multiple niches

---

## 19. Success Criteria (MVP)

- Leads are distributed fairly and correctly
- Providers only pay for delivered leads
- Admin can manage disputes and finances
- Platform supports VPS & Servers end-to-end
- No architectural blockers for Phase 2+

---

## 20. Dependencies

- Payment processors (Stripe, PayPal)
- Email delivery service
- Hosting & database infrastructure

---

## 21. Related Documents

- Document 0: Product Overview & Context
- Document 2: PRD — Phase 2 (Partners & Growth)
- Document 3: PRD — Phase 3 (CRM & Ecosystem)
- Document 4: Technical Architecture & API Design

---
