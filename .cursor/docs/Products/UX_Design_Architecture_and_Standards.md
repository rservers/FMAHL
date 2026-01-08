# Find Me a Hot Lead
## UX Design Architecture & Standards

**Document Type:** UX Architecture & Standards  
**Filename:** UX_Design_Architecture_and_Standards.md  
**Status:** Final / Approved  
**Audience:** Engineering, Product, Design  
**Primary Use:** Cursor-first UI execution & long-term UX consistency  
**Scope:** MVP + Phase 2 + Phase 3 ready  

---

## 1. Purpose of This Document

This document defines **how UI/UX is architected, implemented, and extended** across the Find Me a Hot Lead platform.

It exists to:
- Ensure consistent UX patterns across all roles
- Prevent UI fragmentation as the product scales
- Keep implementation simple, maintainable, and Cursor-friendly
- Protect future phases (Partners, Affiliates, CRM, Messaging) from rework
- Act as the execution contract for UI decisions beyond PRDs

This document complements (does not replace):
- `PRD_UI_UX_MVP_Future_Aware.md`
- Product PRDs for Phase 1 (MVP), Phase 2, and Phase 3

---

## 2. Core UX Architecture Principles (Non-Negotiable)

### 2.1 Role-First Architecture
- UI is always rendered by role:
  - Admin
  - Service Provider
  - End User (Phase 3)
- No shared dashboards across roles
- Avoid conditional role logic within a single page where possible

---

### 2.2 Expand-by-Addition (Never by Rewrite)
- New functionality must be added via:
  - Tabs
  - Panels
  - Feature-flagged routes
  - Filters and metadata
- Existing screens must not be redesigned to support future phases

---

### 2.3 Action-Oriented UX
- Dashboards surface **what requires attention**
- Lists and tables are primary; charts are secondary
- Minimize clicks and navigation depth
- Prefer inline, conditional UI over page navigation

---

### 2.4 Cursor-Safe Design
To ensure Cursor can reliably generate and modify UI:
- Components must be small and focused
- Avoid deeply nested abstractions
- No global CSS overrides
- Prefer composition over inheritance
- Explicit patterns > clever abstractions

---

## 3. Approved UI Technology Stack

### 3.1 System of Record
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- shadcn/ui (Radix-based components)

This stack is authoritative.

---

### 3.2 Metronic / External Template Policy

**Allowed (conditionally):**
- Metronic layouts or widgets may be used **only if**:
  - Isolated at the component level
  - No global CSS or JS injection
  - No conflicts with Tailwind or shadcn styles

**Hard Rule:**
> If Metronic introduces Cursor confusion, CSS override churn, or architectural coupling, it must be removed immediately.

shadcn + Tailwind always win.

---

### 3.3 Icons & Charts
- Use **one icon system globally**
- Charts only when they drive decisions
- Tables preferred by default
- ApexCharts (or similar) allowed when justified

---

## 4. Routing & Layout Standards

### 4.1 Route Separation
- `/admin/*` → Admin shell
- `/provider/*` → Service Provider shell
- `/account/*` → End User (Phase 3)
- `/lead/*` → Public lead submission

---

### 4.2 Layout Structure
Each shell must include:
- Header (context actions + user menu)
- Sidebar (primary navigation)
- Main content area
- Optional right panel (details / actions)

Sidebars must support:
- Collapse behavior
- Feature-flagged navigation items

---

## 5. Dashboard Standards

Dashboards are **decision surfaces**, not analytics playgrounds.

---

### 5.1 Admin Dashboard

**Required Widgets (MVP):**
- Leads pending review
- Rejected leads
- Failed distributions
- System warnings / errors
- Total provider balances (aggregate)
- Top providers by balance
- Low-balance providers

**Optional Charts (MVP-safe):**
- Leads over time
- Revenue over time
- Approval vs rejection rate

**Rules:**
- Every widget must support drilldown
- No passive or decorative widgets
- Every metric must suggest an action

---

### 5.2 Service Provider Dashboard

**Required:**
- Leads received (time-based)
- Current balance
- Alerts (low balance, rejected leads)

**Optional (Future):**
- Outcome distribution
- SLA indicators

Inbox remains the primary workflow.

---

### 5.3 End User Dashboard (Phase 3)
- Leads submitted
- Matched providers
- Conversation status
- Close lead / feedback actions

---

## 6. List & Table Standards (Critical)

### 6.1 Table Capabilities
All data-heavy screens must support:
- Pagination or infinite scroll
- Sorting
- Filtering
- Loading skeletons
- Empty states

---

### 6.2 Quick Actions & Conditional UI

Preferred patterns:
- Inline actions
- Conditional panels / divs
- Side drawers for details

**Example:**
- Reject lead → inline reject reason + notify checkbox
- No page reload required

---

### 6.3 Bulk Actions (Admin Required)
- Multi-select rows
- Bulk approve / reject
- Confirmation dialogs required
- Clear success/failure feedback

---

## 7. Detail View Standards

Detail views must:
- Be reachable from list views
- Include:
  - Overview section
  - Metadata section
  - History / timeline
- Support future tabs without redesign

Tabs are treated as **slots**:
- Overview
- Assignments
- Finance
- Attribution (Phase 2)
- Messages (Phase 3)

---

## 8. Forms & Validation Standards

### 8.1 Validation
- Inline validation preferred
- Errors appear near the field
- Blocking vs non-blocking errors clearly distinguished

---

### 8.2 Lead Form Anti-Spam Standards (Required)

All lead submission forms must implement layered anti-spam protections.

#### Required Controls

1. **Honeypot Field**
   - Hidden input field
   - Any trigger flags the lead
   - Stored as a fraud signal

2. **CAPTCHA (Configurable)**
   - Supported:
     - Google reCAPTCHA
     - Cloudflare Turnstile
   - Configurable per landing page
   - Enable/disable controlled by Admin
   - Failed CAPTCHA attempts must be logged

3. **Rate Limiting**
   - Applied per:
     - IP address
     - Session / browser fingerprint (if available)
   - Default thresholds configurable
   - Violations block submission and are logged

---

#### Fraud Signal Logging (Required)

The following must be captured in lead metadata:
- Honeypot triggered
- CAPTCHA required / passed / failed
- CAPTCHA failure count
- Rate-limit triggered
- Rate-limit violation count
- Source IP and user-agent (privacy-aware)

These signals support:
- Admin review
- Reporting & dashboards
- Auto approval/rejection (future)
- Partner/affiliate quality scoring

---

#### UX Behavior
- **End User:** generic error messaging only
- **Admin:** full visibility into anti-spam signals

Anti-spam failures must never silently fail.

---

### 8.3 Multi-Step Form Pattern
- Progress indicator required
- Back navigation allowed
- State preserved across steps
- Feature-flag controlled per landing page

---

## 9. Loading, Empty & Error States

### 9.1 Loading
- Skeletons preferred over spinners
- No blank screens

---

### 9.2 Empty States
- Explain why data is empty
- Suggest next steps

---

### 9.3 Error States

**Admin:**
- Detailed error message
- Internal error codes
- Context for investigation

**Service Provider:**
- Safe, user-friendly message
- Clear next action
- Admin sees full error context

---

## 10. Session & Security UX

- Sessions expire after inactivity
- Clear timeout messaging
- Redirect to login
- Attempt context restoration after login
- Multi-tab usage allowed

---

## 11. Accessibility Standards (Minimum)

- Keyboard navigable UI
- Visible focus indicators
- Semantic HTML
- Labels for all inputs
- WCAG 2.1 AA where reasonably achievable

---

## 12. Localization & Copy Standards

- English-only for MVP
- All copy externalized
- No hardcoded strings in logic

---

## 13. Financial UX Standards (Admin)

### Required Views
- Total balances (aggregate)
- Providers sorted by balance
- Providers with balances + competition levels
- Demand signals by:
  - Niche
  - Region (if available)
  - Competition level

All views must support:
- Filtering
- Drilldown
- Export

---

## 14. Phase 2 & Phase 3 UX Readiness

### Phase 2
- Partner & affiliate placeholders
- Attribution metadata slots
- Fraud indicators

### Phase 3
- Messaging tabs
- Conversation indicators
- Delivered / read states

Future features must fit existing structures.

---

## 15. Feature Flags & Visibility

- All future features must be:
  - Feature-flagged
  - Hidden or disabled (never half-visible)
- No placeholder UI that confuses users

---

## 16. Definition of Done (UX)

UX is complete when:
- All patterns comply with this document
- No redesign required for Phase 2 or 3
- Admin workflows minimize clicks
- Provider workflows are clear and fast
- Cursor can safely generate and modify UI

---

## Conclusion

This document ensures the Find Me a Hot Lead UI is:
- Operationally strong
- Technically simple
- Future-proof
- Cursor-executable
- Consistent across roles and phases

**Status:** Final & Approved
