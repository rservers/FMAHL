# Find Me a Hot Lead
## Product Requirements Document — UI/UX (MVP, Future-Aware)

**Document:** UI/UX PRD  
**Filename:** PRD_UI_UX_MVP_Future_Aware.md  
**Status:** Approved for Implementation  
**Primary Audience:** Engineering & Product (Cursor-first)  
**Secondary Audience:** Design  
**Scope:** MVP UI/UX with explicit support for Phase 2 & Phase 3 expansion

---

## 1. Purpose & Scope

This document defines the **UI/UX requirements** for the MVP of *Find Me a Hot Lead*.

Its purpose is to:
- Enable MVP delivery without UI rework
- Ensure UX decisions do not block Phase 2 (Partners & Growth)
- Ensure UX decisions do not block Phase 3 (CRM & Masked Communication)
- Act as a contract between Product, Engineering, and Design

This document specifies **what must exist and how it must behave**, not how it must look.

---

## 2. Design Principles & Guardrails (Non-Negotiable)

1. **Role-first UX**
   - UI must be driven by role (Admin, Service Provider, End User)
   - No shared assumptions across roles

2. **Expandable by design**
   - Navigation, screens, and layouts must support future tabs, panels, and sections

3. **No MVP-only dead ends**
   - No screens or flows that would require redesign to support Phase 2 or Phase 3

4. **Explicit absence**
   - Features not available in MVP must be intentionally hidden or disabled

5. **Operational clarity over polish**
   - Admin clarity > visual elegance
   - Provider confidence > dashboard complexity

---

## 2.1 Responsive & Device Support

- **End-user lead submission flow**
  - Fully mobile-responsive
  - Optimized for common mobile screen sizes
  - Touch-friendly inputs and validation

- **Service Provider UI**
  - Desktop-first for MVP
  - Mobile usability is a nice-to-have, not required

- **Admin UI**
  - Desktop-only for MVP

---

## 2.2 Accessibility (a11y)

Minimum requirements:
- Semantic HTML structure
- Keyboard navigability for all core actions
- Visible focus states
- Accessible form labels and error messages
- Sufficient color contrast

Target:
- WCAG 2.1 AA where reasonably achievable for MVP

---

## 2.3 Localization & Language Support

- MVP UI is **English-only**
- All UI copy must be localization-ready
- No hardcoded strings in logic

---

## 2.4 Session & Browser Behavior

- Admin and Provider sessions expire after configurable inactivity
- On expiration:
  - Redirect to login
  - Unsaved changes are discarded
  - Clear timeout message displayed

- Multi-tab usage allowed
- Concurrent sessions allowed unless revoked by Admin
- No real-time session synchronization required

---

## 3. Personas & UX Surfaces

### 3.1 Admin (MVP + Always)

- Lead approval and enforcement
- Financial and operational oversight
- Marketplace health monitoring

---

### 3.2 Service Provider (MVP)

- Receives and views leads
- Manages balance and billing
- Submits bad lead claims

**Future (Phase 3):**
- Messaging
- CRM indicators
- SLA metrics

---

### 3.3 End User

**MVP**
- Anonymous
- Submits lead via public form

**Future (Phase 3)**
- Authenticated account
- Manages multiple leads across niches
- Views matched providers
- Masked communication

---

### 3.4 Partner / Affiliate

- Not visible in MVP UI
- No navigation or screens exposed

---

## 4. Information Architecture (MVP)

### 4.1 Global Layout

- Role-based layouts
- Admin and Provider interfaces fully separated

---

### 4.2 Admin Navigation (MVP)

- Dashboard
- Leads
- Providers
- Finance
- System / Settings

**Future**
- Partners
- Assets
- Communications
- Reports

---

### 4.3 Service Provider Navigation (MVP)

- Dashboard
- Leads
- Billing / Balance
- Support

**Future**
- Conversations
- CRM Insights
- Performance

---

## 5. Dashboards (Intent-Based)

### 5.1 Admin Dashboard

**MVP Intent**
- Operational awareness
- Risk and failure visibility

**Example Content**
- Leads submitted today
- Leads pending approval
- Rejected leads
- Failed distributions
- Providers with low balance
- System warnings/errors

**Future**
- Partner quality metrics (Phase 2)
- Fraud indicators (Phase 2)
- Automation readiness signals (Phase 3)

---

### 5.2 Service Provider Dashboard

**MVP Intent**
- Lead and balance awareness

**Example Content**
- Leads received (today / last 7 days)
- Pending actions
- Current balance
- Alerts (low balance, rejected leads)

**Future**
- SLA indicators
- Conversation status
- Outcome metrics

---

### 5.3 End User Dashboard (Future — Phase 3)

- Leads submitted
- Matched providers
- Conversation status
- Lead closure actions

---

## 6. Core Screens — MVP Requirements

### 6.1 Public Lead Submission Form

**Purpose**
- Capture high-quality leads
- Set expectations

**Requirements**
- Clear sections
- Inline validation
- Explicit consent language

**Progress & Flow**
- May be single-page (initial MVP)
- Must support future multi-step flow
- If multi-step:
  - Progress indicator required
  - Back navigation without data loss

**Future**
- Masked communication opt-in (Phase 3)
- Account creation trigger (Phase 3)

---

### 6.2 Lead Confirmation Screen

- Confirmation message
- Reference ID
- No provider details

**Future**
- Account creation prompt (Phase 3)

---

### 6.3 Admin Lead Review Screen

- Full lead details
- Validation indicators
- Approve / reject actions
- Rejection reason capture

**Future**
- Partner attribution (Phase 2)
- Fraud signals (Phase 2)
- Conversation preview (Phase 3)

---

### 6.4 Admin Lead Detail View

- Lead metadata
- Distribution status
- Provider assignments
- Financial impact

**Future**
- Messaging tab (Phase 3)
- Outcome history (Phase 3)

---

### 6.5 Service Provider Lead Inbox

- Lead list
- Status indicators
- Sorting and filtering

**Data Volume Handling**
- Pagination or infinite scroll
- Server-side filtering

**Future**
- Conversation indicators
- SLA warnings

---

### 6.6 Service Provider Lead Detail

- Read-only lead data
- Actions:
  - Mark bad lead
  - Update internal status

**Future**
- Messaging panel
- Outcome reporting

---

### 6.7 Billing & Balance (Provider)

- Current balance
- Transaction history
- Deposit actions

**Future**
- Revenue-linked analytics
- Refund impact visibility

---

## 7. Admin UX — Operations & Maintenance

Admin UI must surface:
- Failed lead submissions
- Failed distributions
- Provider enforcement flags
- Manual overrides

### Bulk Actions
- Approve multiple leads
- Reject multiple leads with shared reason
- Confirmation required

---

## 8. Forms, Validation & Error UX

- Inline validation preferred
- Blocking errors clearly labeled
- User errors vs system errors distinct
- Destructive actions require confirmation

---

## 9. Notifications & Feedback UX

- Clear success/failure messaging
- Async processing indicators
- UI state must align with email notifications

---

## 9.1 Loading, Empty & Error States

### Loading
- Visible loading indicators
- Skeletons where appropriate

### Empty States
- Clear explanation (e.g., no leads yet)
- Suggested next steps

### Errors
- No internal system details exposed
- Clear recovery guidance

---

## 10. Extensibility Hooks (Inline by Design)

All core screens must:
- Support additional tabs
- Support additional metadata
- Avoid fixed layouts

Examples:
- Lead detail → Messaging tab (Phase 3)
- Provider inbox → CRM indicators (Phase 3)
- Admin nav → Partners section (Phase 2)

---

## 11. Explicit UI Non-Goals (MVP)

The MVP UI must not include:
- Messaging UI
- CRM pipelines
- Partner dashboards
- Automation controls
- AI features

---

## 12. UX Success Criteria

The UI/UX is successful when:
- Admins can operate confidently
- Providers understand value and cost
- No screens require redesign for Phase 2 or 3
- Engineers can extend without refactoring

---

## Conclusion

This UI/UX PRD ensures the MVP is **minimal, durable, and future-proof**, providing a stable foundation for partner growth and CRM-driven communication.

**Status:** Approved
