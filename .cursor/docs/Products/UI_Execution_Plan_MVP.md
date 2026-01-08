# Find Me a Hot Lead
## UI Execution Plan (MVP + Future-Aware)

**Document Type:** UI Execution Plan  
**Filename:** UI_Execution_Plan_MVP.md  
**Status:** Final / Approved  
**Audience:** Product, Engineering  
**Primary Use:** Execution sequencing for Cursor  
**Scope:** MVP UI with Phase 2 & Phase 3 readiness  

---

## 1. How This Plan Is Meant to Be Used

This document defines:
- What to build
- In what order
- At what level of granularity

### Execution Rules
- Do **not** skip epics
- Do **not** start an epic until dependencies are met
- Use **one Cursor prompt per task**
- Every task must:
  - reference `UX_Design_Architecture_and_Standards.md`
  - reference `Testing_Architecture_and_Standards.md`
  - generate tests unless explicitly stated otherwise

Cursor is responsible for **implementation**, not planning.

---

## 2. Epic Overview & Ordering

| Order | Epic | Purpose |
|------|------|--------|
| 1 | UI Foundation & App Shells | Layout, routing, navigation |
| 2 | Core UI Primitives | Reusable components |
| 3 | Public Lead Submission UX | Conversion entry point |
| 4 | Admin Lead Management | Core admin workflow |
| 5 | Service Provider Inbox & Billing | Provider workflows |
| 6 | Dashboards & Financials | Admin + Provider insights |
| 7 | Errors, Edge Cases & System UX | Resilience & trust |
| 8 | Phase 2 & 3 UX Readiness Hooks | Future-proofing |

---

## 3. EPIC 1 — UI Foundation & App Shells

### Goal
Establish stable layouts, routing, and navigation for all roles.

### Dependencies
- Next.js App Router
- Tailwind CSS
- shadcn/ui installed

---

### Story 1.1 — Admin App Shell

**As an Admin**, I want a consistent layout so I can navigate efficiently.

**Tasks**
1. Create `/admin` layout with header, sidebar, and content slot
2. Add placeholder navigation items (feature-flag ready)
3. Implement responsive sidebar collapse
4. Add layout render tests

**Acceptance Criteria**
- Admin layout renders consistently
- Navigation is visible and collapsible
- Layout is responsive (desktop/tablet)
- Tests verify layout renders

---

### Story 1.2 — Service Provider App Shell

**As a Service Provider**, I want a clean layout tailored to my role.

**Tasks**
1. Create `/provider` layout mirroring admin structure
2. Provider-specific navigation
3. Responsive behavior
4. Layout render tests

**Acceptance Criteria**
- Provider layout renders correctly
- Navigation items are role-specific
- Responsive behavior works
- Tests pass

---

## 4. EPIC 2 — Core UI Primitives

### Goal
Build once, reuse everywhere.

---

### Story 2.1 — DataTable Component

**Tasks**
1. Create reusable `DataTable` component
2. Support:
   - columns
   - sorting
   - pagination
   - row actions
3. Add unit tests:
   - render
   - sorting
   - empty state

**Acceptance Criteria**
- DataTable renders dynamic columns
- Sorting and pagination function
- Empty state renders
- Unit tests pass

---

### Story 2.2 — UI State Components

**Tasks**
1. Create:
   - `EmptyState`
   - `LoadingSkeleton`
   - `ErrorBanner`
2. Add unit tests for each

**Acceptance Criteria**
- Components render correctly
- States are visually distinct
- Tests pass

---

### Story 2.3 — Tag / Badge Components

**Tasks**
1. Create tag components for:
   - competition levels
   - niches
   - statuses
2. Add unit tests

**Acceptance Criteria**
- Tags render consistently
- Overflow handled gracefully
- Tests pass

---

## 5. EPIC 3 — Public Lead Submission UX

### Goal
Mobile-first, spam-resistant lead entry.

---

### Story 3.1 — Lead Submission Form (Base)

**Tasks**
1. Create `/lead` form page
2. Mobile-first layout
3. Inline validation
4. Honeypot field
5. CAPTCHA toggle (config-driven)
6. Integration tests (happy path)

**Acceptance Criteria**
- Form is mobile-friendly
- Validation errors display inline
- Spam protections active
- Successful submit redirects to confirmation
- Tests pass

---

### Story 3.2 — Multi-Step Form (Feature-Flagged)

**Tasks**
1. Convert form to multi-step
2. Add progress indicator
3. Preserve state between steps
4. Feature flag control
5. Integration tests

**Acceptance Criteria**
- Steps transition correctly
- State preserved on back/forward
- Feature flag works
- Tests pass

---

### Story 3.3 — Anti-Spam Blocking UX

**Tasks**
1. Block submission on:
   - honeypot trigger
   - CAPTCHA failure
   - rate-limit exceeded
2. Generic end-user messaging
3. Integration tests

**Acceptance Criteria**
- Spam submissions blocked
- User sees generic error
- Admin receives fraud signals
- Tests pass

---

### Story 3.4 — Lead Confirmation Screen

**As an End User**, I want confirmation after submission so I know what happens next.

**Tasks**
1. Create `/lead/confirmation` page
2. Display success + next steps messaging
3. Handle invalid direct access
4. Integration tests

**Acceptance Criteria**
- Confirmation shown after submit
- Page does not resubmit on refresh
- Invalid access handled gracefully
- Tests pass

---

**Note:** Rate-limit configuration UI is backend-only for MVP.

---

## 6. EPIC 4 — Admin Lead Management

### Goal
Fast, low-friction lead review.

---

### Story 4.1 — Admin Lead List

**Tasks**
1. Create `/admin/leads` table
2. Columns:
   - name
   - email
   - niche
   - competition levels (tags)
   - providers count (clickable)
   - revenue
   - date submitted
   - date distributed
3. Inline actions:
   - approve
   - reject (conditional fields)
4. Filters, sorting, pagination
5. Integration tests

**Acceptance Criteria**
- All columns render
- Inline approve/reject works
- Reject reveals reason + notify checkbox
- Clicking providers count opens assignment details
- Filters and sorting work
- Tests pass

---

### Story 4.2 — Admin Lead Detail

**Tasks**
1. Create `/admin/leads/[id]`
2. Tabs:
   - Overview
   - Assignments
   - Finance
   - Attribution (disabled)
   - Messages (disabled)
3. Decision panel
4. Fraud & anti-spam signals
5. Integration tests

**Acceptance Criteria**
- Detail page loads correctly
- Tabs render
- Decision panel works
- Fraud signals visible
- Tests pass

---

### Story 4.3 — Bulk Lead Actions

**Tasks**
1. Multi-select rows
2. Bulk approve/reject
3. Confirmation dialogs
4. Integration tests

**Acceptance Criteria**
- Multiple leads selectable
- Bulk actions apply correctly
- Confirmations enforced
- Tests pass

---

## 7. EPIC 5 — Service Provider Inbox & Billing

### Goal
Clear provider workflows.

---

### Story 5.1 — Provider Inbox

**Tasks**
1. Create `/provider/leads` list
2. Filters + pagination
3. Empty state guidance
4. Integration tests

**Acceptance Criteria**
- Leads display correctly
- Empty state shown when no leads
- Filters work
- Tests pass

---

### Story 5.2 — Provider Lead Detail

**Tasks**
1. Create `/provider/leads/[id]`
2. Lead details
3. Outcome selection
4. Bad lead claim action
5. Integration tests

**Acceptance Criteria**
- Lead details visible
- Outcomes selectable
- Bad lead claim works
- Tests pass

---

### Story 5.3 — Provider Billing / Balance Screen

**Tasks**
1. Create `/provider/billing`
2. Show:
   - current balance
   - subscribed competition levels
   - usage indicators
3. Low-balance messaging
4. Integration tests

**Acceptance Criteria**
- Balance visible
- Subscriptions displayed
- Low balance messaging works
- Tests pass

---

## 8. EPIC 6 — Dashboards & Financials

### Goal
Surface actionable insights.

---

### Story 6.1 — Admin Dashboard

**Tasks**
1. Widgets:
   - pending leads
   - rejected leads
   - failed distributions
   - total provider balances
2. Drilldown links
3. Integration tests

**Acceptance Criteria**
- Widgets render correctly
- Drilldowns work
- Tests pass

---

### Story 6.2 — Provider Balance & Demand Reports (Admin)

**Tasks**
1. Provider balances table
2. Filters:
   - competition level
   - niche
   - region (if available)
3. Sorting by balance
4. Integration tests

**Acceptance Criteria**
- Sorting/filtering works
- Data supports campaign decisions
- Drilldowns work
- Tests pass

---

### Story 6.3 — Service Provider Dashboard

**Tasks**
1. Create `/provider/dashboard`
2. Widgets:
   - leads received
   - current balance
   - alerts (low balance, rejected leads)
3. Drilldowns to inbox/billing
4. Integration tests

**Acceptance Criteria**
- Dashboard renders key metrics
- Alerts are actionable
- Drilldowns work
- Tests pass

---

## 9. EPIC 7 — Errors, Edge Cases & System UX

### Goal
Make failures understandable.

---

### Story 7.1 — Error Messaging Standards

**Tasks**
1. Admin detailed errors
2. Provider safe errors
3. Error banner usage
4. Integration tests

**Acceptance Criteria**
- Errors render per role
- No sensitive leakage to providers
- Tests pass

---

### Story 7.2 — Session Expiry Handling

**Tasks**
1. Handle expired sessions
2. Redirect to login
3. Restore context
4. E2E tests

**Acceptance Criteria**
- Session expiry handled gracefully
- User returns to prior context
- Tests pass

---

## 10. EPIC 8 — Phase 2 & 3 UX Readiness Hooks

### Goal
Zero redesign later.

---

### Story 8.1 — Phase 2 Placeholders

**Tasks**
1. Partner/Affiliate nav items (disabled)
2. Attribution UI slots
3. Feature flag enforcement

**Acceptance Criteria**
- Placeholders hidden or disabled
- Feature flags respected
- Tests pass

---

### Story 8.2 — Phase 3 Messaging Placeholders

**Tasks**
1. Messages tabs (disabled)
2. Delivered/read indicators (UI only)
3. Feature flag enforcement

**Acceptance Criteria**
- Messaging UI hidden/disabled
- No partial exposure
- Tests pass

---

## 11. Global Testing Expectations

- Unit tests for reusable components
- Integration tests for screens
- E2E tests for:
  - lead submission
  - admin review
  - provider bad lead claim
- MSW for API mocking
- Playwright for E2E

---

## 12. Definition of Done (Execution)

An epic is complete when:
- All stories implemented
- All acceptance criteria met
- Tests pass locally and in CI
- UX and testing standards followed

---

## Conclusion

This execution plan:
- Aligns with PRDs and UX standards
- Is fully Cursor-executable
- Prevents rework
- Scales into Phase 2 and Phase 3

**Status:** Final & Approved
