# Find Me a Hot Lead
## Product Requirements Document — Phase 2: Partners & Growth

**Document:** PRD — Phase 2  
**Version:** 1.4 (Final)  
**Status:** Approved for Development  
**Scope:** Post-MVP Expansion  
**Design Principle:** Capability-first, UI-agnostic, automation-ready  

---

## 1. Purpose & Intent

Phase 2 expands *Find Me a Hot Lead* beyond first-party lead capture by introducing **Partners** and **Affiliates** as external demand sources, while preserving the platform’s primary invariant:

> **Lead quality for Service Providers is more important than growth velocity.**

Phase 2 focuses on:
- Trusted third-party lead acquisition
- Revenue-aligned commission models
- Fraud detection and quality enforcement
- Rich attribution and behavioral signal capture
- Admin-controlled growth with future automation readiness

Phase 2 intentionally avoids UI decisions and automated enforcement.

---

## 2. Explicit Non-Goals (Hard Guardrails)

Phase 2 does **not** include:
- UI/UX redesigns or dashboards
- CRM pipelines or deal tracking
- Provider bidding or auctions
- End-user accounts
- Automated lead approval or rejection
- Automated payouts
- Masked communications (email/phone)

Manual admin approval remains authoritative.

---

## 3. Personas & Roles

### 3.1 Partner (Lead Originator)

Partners generate and submit leads directly.

**Responsibilities**
- Generate high-quality leads
- Use approved assets only
- Follow platform validation and attribution rules

**Constraints**
- No provider visibility
- No lead modification after submission
- No self-service commission control

---

### 3.2 Affiliate (Traffic Referrer)

Affiliates direct traffic to platform-owned landing pages.

**Responsibilities**
- Drive qualified traffic
- Use approved referral assets

**Constraints**
- Cannot submit leads
- No lead-level visibility
- Attribution-only commissions

---

### 3.3 Admin (Expanded Authority)

Admins retain full authority:
- Approve partners, affiliates, and assets
- Configure commissions
- Enforce fraud controls
- Resolve disputes
- Authorize payouts
- Override any automated signal

---

### 3.4 Partner vs Affiliate — Lead Origination Model

| Dimension | Affiliate | Partner |
|--------|----------|---------|
| Creates lead | ❌ | ✅ |
| Controls form | ❌ | ✅ / Embedded |
| Submission path | Platform pages | Partner assets |
| Validation | Platform | Platform-enforced |
| Asset approval | Required | Mandatory |
| Fraud surface | Low | Medium–High |
| Commission trigger | Attribution | Revenue-based |

---

## 4. Partner & Affiliate Onboarding

### 4.1 Approval Requirements

All Partners and Affiliates require manual approval:
- Identity verification
- Policy acceptance
- Asset declaration
- Initial commission assignment

---

### 4.2 Asset Pre-Approval

All assets must be declared and approved:
- Domains / subdomains
- Landing pages
- Forms
- YouTube channels
- Social media groups
- Embedded widgets

Leads from undeclared assets are rejected and logged.

---

### 4.3 Partner Lead Ingestion Mechanisms

Partners may submit leads **only** via approved mechanisms.

#### Option A — Platform-Embedded Form (Preferred)
- Script embed or iframe
- Platform-controlled schema and validation
- Lowest fraud risk

#### Option B — Platform WordPress Plugin
- Schema enforcement
- Automatic metadata injection
- Asset binding

#### Option C — Direct API Submission (Restricted)
- Vetted partners only
- Scoped API keys
- Rate-limited
- Disabled by default

🚫 Not allowed:
- Raw HTML forms
- Custom payload schemas
- Missing asset IDs
- Unauthenticated submissions

---

### 4.4 Partner Sandbox & Testing Environment

Partners must be able to test integrations:
- Non-billable test mode
- Separate API keys
- No provider distribution
- Clearly marked test data

---

## 5. End-User Trust Badge & Verification (Critical)

### 5.1 Purpose

Partner forms may optionally display a **“Powered by Find Me a Hot Lead”** trust badge to:
- Build end-user confidence
- Reduce spam concerns
- Provide verifiable legitimacy

---

### 5.2 Tokenized Trust Badge (Non-Spoofable)

Trust badges must use **tokenized, cryptographically signed verification URLs**.

**Token characteristics**
- Partner-specific
- Asset-specific
- Time-bound
- Non-reusable across assets
- Cannot be manually constructed

---

### 5.3 Public Verification Page

Clicking the badge leads to a platform-hosted, read-only page displaying:
- Partner name
- Asset identifier (domain / channel)
- Approval status
- Approved niche(s)
- Anti-spam positioning statement

---

### 5.4 Trust Badge Revocation & Enforcement

Trust Badge verification is **state-based**, not just token-based.

If a partner or asset is suspended:
- Verification fails immediately
- Verification page reflects revoked status
- Badge may fail to render or render in warning state
- Lead submissions are rejected server-side

Token expiry alone is insufficient; live status checks are mandatory.

---

## 6. Commission Models & Revenue Alignment

### 6.1 Core Principle (Authoritative)

> **Partner commissions are calculated exclusively on net revenue actually retained by the platform.**

There is **no refund or bad-lead window**.  
Leads may be refunded or marked as bad quality at any time.

---

### 6.2 Commission Rules

- Partners earn commission only on collected and retained revenue
- Refunded provider charges reduce commission eligibility
- If all provider charges are refunded, commission is zero
- If commission was already paid on refunded revenue, a clawback applies

Commission calculations always reflect current net revenue, regardless of timing.

---

### 6.3 Default & Override Models

- Global default commission rate
- Admin-defined partner overrides
- Effective-dated changes
- Immutable audit history

---

### 6.4 Tiered & Conditional Commissions

Supported models:
- Volume-based
- Quality-based
- Asset-specific
- Niche-specific
- Time-bound promotions

Only one commission model applies per revenue event.

---

### 6.5 Commission Examples

**Example A — No Refunds**
- Providers billed and retained
- Partner earns commission on total revenue

**Example B — Partial Refund**
- Some providers refunded
- Partner earns commission only on retained revenue

**Example C — Global Bad Lead**
- All providers refunded
- Partner earns no commission

---

## 7. Attribution & Metadata Capture

### 7.1 Core Attribution
- Partner ID
- Affiliate ID
- Asset ID
- Campaign ID
- Referrer
- UTM parameters
- Session ID
- Timestamp

---

### 7.2 Behavioral & Technical Signals
- IP & geo
- Device / user agent
- Submission velocity
- Duplicate detection hashes
- Contact reuse

---

### 7.3 Mandatory Partner Lead Contract

Hard fail if missing:
- Partner ID
- Approved Asset ID
- Niche ID
- Full niche schema
- Submission method
- Timestamp

---

### 7.4 Signal vs Decision Boundary

Phase 2 captures **signals only**.
- No automated bans
- No auto-approvals
- Admin remains final authority

---

## 8. Fraud Detection & Quality Enforcement

### 8.1 Metrics Tracked
Tracked per partner, affiliate, asset, campaign:
- Approval rate
- Rejection rate
- Refund rate
- Global bad lead correlation
- Time-to-refund
- Provider complaints

---

### 8.2 Manual Review Thresholds (Guidance)
- >20% rejection rate
- >15% refund rate
- Sudden submission velocity spikes
- Repeated asset mismatches

Thresholds trigger review, not automation.

---

### 8.3 Enforcement Actions (Admin Only)
- Asset suspension
- Partner throttling
- Commission reduction
- Attribution pause
- Clawbacks
- Partner suspension

All actions require reasons and are audit-logged.

---

## 9. Partner Asset Registry

### 9.1 Asset Model
Each asset includes:
- Owner
- Type
- Status
- Allowed submission methods
- Approval history
- Performance metrics

---

### 9.2 Asset Validation Rules
Before lead creation:
1. Partner active
2. Asset approved
3. Submission method allowed
4. Schema valid

Failures reject the lead and log fraud signals.

---

## 10. Notifications & Webhooks

### 10.1 Email Notifications

The platform must support system-generated email notifications for:

- Lead submitted
- Lead approved
- Lead rejected
- Commission earned
- Commission reversed (refunds / clawbacks)
- **Asset suspended or revoked**

Asset suspension notifications:
- Are sent immediately upon admin action
- Clearly identify the affected asset
- State that submissions are no longer accepted
- Are mandatory and cannot be disabled

Partners may opt into BCC-style notifications for lead-related events.

---

### 10.2 Webhooks (Optional)
- Lead status changes
- Commission events
- Signed payloads
- Retry with backoff

---

## 11. Partner / Affiliate Visibility Scope

Partners & Affiliates may see:
- Aggregated lead counts
- Approval / rejection totals
- Commission summaries

They may not see:
- End-user PII
- Provider identities
- Individual lead details

---

## 12. Disputes & Appeals

Partners may dispute:
- Lead rejection
- Commission calculations

Rules:
- Time-bound submissions
- Admin-only resolution
- Decisions are final

---

## 13. Rate Limiting

- Partner API: configurable (e.g., 60 req/min)
- Burst detection logged
- Webhook retry limits enforced

---

## 14. Data Retention & Deletion

- Attribution and logs retained per compliance requirements
- Partner data deleted on offboarding where legally required
- Audit logs are immutable

---

## 15. Dependencies & Assumptions

- MVP ledger remains authoritative
- Manual approval remains mandatory
- No UI assumptions
- No automation without admin control

---

## 16. Phase 3 Guardrail

Out of scope:
- CRM pipelines
- Deal management
- External CRM sync
- Masked communications
- Provider collaboration tools

---

## 17. Success Criteria (Phase 2)

Phase 2 succeeds when:
- Partner leads meet or exceed MVP quality
- Fraud is visible early
- Commissions are revenue-aligned and defensible
- Admin authority is preserved
- Platform is automation-ready

---

## 18. Deferred & Nice-to-Have (Post Phase 2)

- Partner Health Score
- Automated fraud alerts
- Bulk asset approval
- Commission forecasting
- Partner referral program
- A/B testing framework
- Integration templates (Webflow, Squarespace, etc.)

---

## Conclusion

Phase 2 enables scalable growth without compromising trust, establishes attribution and financial integrity, and prepares the platform for safe automation in later phases.

**Status:** Phase 2 PRD — Frozen
