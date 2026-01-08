# UI Epic Execution Plan

**Document Type:** Execution Plan  
**Created:** Jan 5, 2026  
**Status:** Approved for Execution  
**Scope:** MVP UI/UX with Phase 2 & Phase 3 Readiness  
**Foundation:** Backend MVP Complete (12 Epics ✅)

---

## Executive Summary

This document defines the execution order for UI/UX implementation. The backend MVP is complete with all 12 epics delivered. This phase focuses on building the frontend to consume existing APIs.

**Total UI Epics:** 8  
**Estimated Effort:** 80-100 hours (~2-3 weeks)  
**Dependencies:** Backend MVP APIs ✅ Complete

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `PRD_UI_UX_MVP_Future_Aware.md` | UI/UX requirements |
| `UX_Design_Architecture_and_Standards.md` | UX architecture & patterns |
| `Testing_Architecture_and_Standards.md` | Testing standards (Vitest, Playwright, MSW) |
| `UI_Execution_Plan_MVP.md` | Detailed epic specifications |

---

## Technology Stack

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui (Radix-based)
- **Icons:** Lucide React (single icon system)
- **Charts:** ApexCharts (when justified)

### Testing
- **Unit/Integration:** Vitest + @testing-library/react
- **API Mocking:** MSW (Mock Service Worker)
- **E2E:** Playwright

---

## Epic Execution Order

| Phase | Epic | Name | Priority | Effort | Dependencies | Status |
|-------|------|------|----------|--------|--------------|--------|
| 1 | UI-01 | UI Foundation & App Shells | P1 | 8h | Next.js, Tailwind, shadcn | 🔴 Not Started |
| 1 | UI-02 | Core UI Primitives | P1 | 6h | UI-01 | 🔴 Not Started |
| 2 | UI-03 | Public Lead Submission UX | P1 | 10h | UI-01, UI-02, EPIC 02 APIs | 🔴 Not Started |
| 2 | UI-04 | Admin Lead Management | P1 | 12h | UI-01, UI-02, EPIC 03/05 APIs | 🔴 Not Started |
| 3 | UI-05 | Provider Inbox & Billing | P1 | 12h | UI-01, UI-02, EPIC 08 APIs | 🔴 Not Started |
| 3 | UI-06 | Dashboards & Financials | P2 | 10h | UI-01, UI-02, EPIC 11 APIs | 🔴 Not Started |
| 4 | UI-07 | Errors, Edge Cases & System UX | P2 | 8h | UI-01 through UI-06 | 🔴 Not Started |
| 4 | UI-08 | Phase 2 & 3 UX Readiness Hooks | P3 | 4h | All previous | 🔴 Not Started |

**Total Effort:** ~70 hours (core) + ~30 hours (testing) = ~100 hours

---

## Phase 1: Foundation (14 hours)

### UI-01: UI Foundation & App Shells
**Effort:** 8 hours  
**Priority:** P1 - Critical Foundation  
**Dependencies:** None (infrastructure only)

**Purpose:**  
Establish stable layouts, routing, and navigation for all roles.

**Stories:**
1. **Story 1.1 — Admin App Shell** (3h)
   - Create `/admin` layout with header, sidebar, content slot
   - Placeholder navigation items (feature-flag ready)
   - Responsive sidebar collapse
   - Layout render tests

2. **Story 1.2 — Provider App Shell** (3h)
   - Create `/provider` layout mirroring admin structure
   - Provider-specific navigation
   - Responsive behavior
   - Layout render tests

3. **Story 1.3 — Public Layout** (2h)
   - Create `/lead` public layout
   - Mobile-first responsive design
   - Clean, conversion-focused

**Deliverables:**
- `/admin/*` route shell
- `/provider/*` route shell
- `/lead/*` public shell
- Responsive sidebar component
- Navigation components (feature-flag ready)

**Backend APIs Required:** None (layout only)

---

### UI-02: Core UI Primitives
**Effort:** 6 hours  
**Priority:** P1 - Critical Foundation  
**Dependencies:** UI-01

**Purpose:**  
Build reusable components used across all screens.

**Stories:**
1. **Story 2.1 — DataTable Component** (3h)
   - Columns, sorting, pagination, row actions
   - Loading skeletons, empty states
   - Unit tests

2. **Story 2.2 — UI State Components** (2h)
   - `EmptyState`, `LoadingSkeleton`, `ErrorBanner`
   - Unit tests for each

3. **Story 2.3 — Tag/Badge Components** (1h)
   - Competition level tags
   - Niche tags
   - Status badges
   - Unit tests

**Deliverables:**
- `DataTable` component
- `EmptyState` component
- `LoadingSkeleton` component
- `ErrorBanner` component
- `StatusBadge` component
- `NicheTag`, `CompetitionLevelTag` components

**Backend APIs Required:** None (components only)

---

## Phase 2: Core Workflows (22 hours)

### UI-03: Public Lead Submission UX
**Effort:** 10 hours  
**Priority:** P1 - Core Conversion  
**Dependencies:** UI-01, UI-02, Backend EPIC 02 APIs ✅

**Purpose:**  
Mobile-first, spam-resistant lead entry point.

**Stories:**
1. **Story 3.1 — Lead Submission Form (Base)** (4h)
   - Create `/lead` form page
   - Mobile-first layout
   - Inline validation
   - Honeypot field
   - CAPTCHA toggle (config-driven)
   - Integration tests

2. **Story 3.2 — Multi-Step Form** (3h)
   - Convert to multi-step (feature-flagged)
   - Progress indicator
   - State preservation
   - Integration tests

3. **Story 3.3 — Anti-Spam Blocking UX** (2h)
   - Block on honeypot/CAPTCHA/rate-limit
   - Generic end-user messaging
   - Integration tests

4. **Story 3.4 — Lead Confirmation Screen** (1h)
   - `/lead/confirmation` page
   - Success + next steps messaging
   - Integration tests

**Backend APIs Required:**
- `POST /api/v1/leads` ✅
- `POST /api/v1/leads/verify` ✅
- `POST /api/v1/leads/confirm` ✅
- `GET /api/v1/niches` ✅

---

### UI-04: Admin Lead Management
**Effort:** 12 hours  
**Priority:** P1 - Core Admin Workflow  
**Dependencies:** UI-01, UI-02, Backend EPIC 03/05 APIs ✅

**Purpose:**  
Fast, low-friction lead review for admins.

**Stories:**
1. **Story 4.1 — Admin Lead List** (5h)
   - Create `/admin/leads` table
   - Columns: name, email, niche, competition levels, providers, revenue, dates
   - Inline approve/reject actions
   - Reject reveals reason + notify checkbox
   - Filters, sorting, pagination
   - Integration tests

2. **Story 4.2 — Admin Lead Detail** (5h)
   - Create `/admin/leads/[id]`
   - Tabs: Overview, Assignments, Finance, Attribution (disabled), Messages (disabled)
   - Decision panel (approve/reject)
   - Fraud & anti-spam signals display
   - Integration tests

3. **Story 4.3 — Bulk Lead Actions** (2h)
   - Multi-select rows
   - Bulk approve/reject with confirmation
   - Integration tests

**Backend APIs Required:**
- `GET /api/v1/admin/leads` ✅
- `GET /api/v1/admin/leads/:id` ✅
- `POST /api/v1/admin/leads/:id/approve` ✅
- `POST /api/v1/admin/leads/:id/reject` ✅
- `POST /api/v1/admin/leads/:id/distribute` ✅
- `GET /api/v1/admin/leads/:id/assignments` ✅

---

## Phase 3: Provider Experience (22 hours)

### UI-05: Provider Inbox & Billing
**Effort:** 12 hours  
**Priority:** P1 - Core Provider Workflow  
**Dependencies:** UI-01, UI-02, Backend EPIC 08 APIs ✅

**Purpose:**  
Clear provider workflows for lead management and billing.

**Stories:**
1. **Story 5.1 — Provider Inbox** (5h)
   - Create `/provider/leads` list
   - Filters + pagination
   - Status indicators
   - Empty state guidance
   - Integration tests

2. **Story 5.2 — Provider Lead Detail** (4h)
   - Create `/provider/leads/[id]`
   - Read-only lead data
   - Outcome selection
   - Bad lead claim action
   - Integration tests

3. **Story 5.3 — Provider Billing Screen** (3h)
   - Create `/provider/billing`
   - Current balance display
   - Subscribed competition levels
   - Transaction history
   - Low-balance messaging
   - Integration tests

**Backend APIs Required:**
- `GET /api/v1/provider/inbox` ✅
- `GET /api/v1/provider/leads/:id` ✅
- `POST /api/v1/provider/leads/:id/accept` ✅
- `POST /api/v1/provider/leads/:id/reject` ✅
- `POST /api/v1/provider/leads/:id/bad-lead` ✅
- `GET /api/v1/provider/balance` ✅
- `GET /api/v1/provider/billing/history` ✅
- `GET /api/v1/provider/subscriptions` ✅

---

### UI-06: Dashboards & Financials
**Effort:** 10 hours  
**Priority:** P2 - Insights & Monitoring  
**Dependencies:** UI-01, UI-02, Backend EPIC 11 APIs ✅

**Purpose:**  
Surface actionable insights for admins and providers.

**Stories:**
1. **Story 6.1 — Admin Dashboard** (4h)
   - Widgets: pending leads, rejected leads, failed distributions, provider balances
   - Drilldown links to relevant screens
   - Integration tests

2. **Story 6.2 — Admin Provider Balance Reports** (3h)
   - Provider balances table
   - Filters: competition level, niche
   - Sorting by balance
   - Export functionality
   - Integration tests

3. **Story 6.3 — Provider Dashboard** (3h)
   - Create `/provider/dashboard`
   - Widgets: leads received, current balance, alerts
   - Drilldowns to inbox/billing
   - Integration tests

**Backend APIs Required:**
- `GET /api/v1/admin/reports/kpis` ✅
- `GET /api/v1/admin/reports/funnel` ✅
- `GET /api/v1/admin/reports/revenue` ✅
- `GET /api/v1/provider/reports/kpis` ✅
- `GET /api/v1/admin/providers` ✅

---

## Phase 4: Polish & Future-Proofing (12 hours)

### UI-07: Errors, Edge Cases & System UX
**Effort:** 8 hours  
**Priority:** P2 - Resilience  
**Dependencies:** UI-01 through UI-06

**Purpose:**  
Make failures understandable and recoverable.

**Stories:**
1. **Story 7.1 — Error Messaging Standards** (4h)
   - Admin: detailed errors with context
   - Provider: safe errors, no sensitive leakage
   - Error banner usage patterns
   - Integration tests

2. **Story 7.2 — Session Expiry Handling** (4h)
   - Handle expired sessions gracefully
   - Redirect to login with return URL
   - Context restoration after login
   - E2E tests

**Backend APIs Required:**
- All existing APIs (error handling)

---

### UI-08: Phase 2 & 3 UX Readiness Hooks
**Effort:** 4 hours  
**Priority:** P3 - Future-Proofing  
**Dependencies:** All previous

**Purpose:**  
Zero redesign for future phases.

**Stories:**
1. **Story 8.1 — Phase 2 Placeholders** (2h)
   - Partner/Affiliate nav items (disabled)
   - Attribution UI slots
   - Feature flag enforcement

2. **Story 8.2 — Phase 3 Messaging Placeholders** (2h)
   - Messages tabs (disabled)
   - Delivered/read indicators (UI only)
   - Feature flag enforcement

**Backend APIs Required:** None (placeholders only)

---

## Dependency Matrix

### Backend to UI Dependencies

| UI Epic | Required Backend Epics | Status |
|---------|------------------------|--------|
| UI-01 | None | Ready |
| UI-02 | None | Ready |
| UI-03 | EPIC 02 (Lead Intake) | ✅ Complete |
| UI-04 | EPIC 03 (Admin Review), EPIC 05 (Filters) | ✅ Complete |
| UI-05 | EPIC 08 (Provider Dashboard), EPIC 09 (Bad Leads) | ✅ Complete |
| UI-06 | EPIC 11 (Reporting) | ✅ Complete |
| UI-07 | All (error handling) | ✅ Complete |
| UI-08 | None (placeholders) | Ready |

**Result:** All backend dependencies met ✅

---

### UI Epic Dependencies

```
UI-01 (Foundation)
  ↓
UI-02 (Primitives)
  ↓
  ├── UI-03 (Lead Submission)
  ├── UI-04 (Admin Lead Mgmt)
  └── UI-05 (Provider Inbox)
        ↓
      UI-06 (Dashboards)
        ↓
      UI-07 (Errors/Edge Cases)
        ↓
      UI-08 (Future Hooks)
```

---

## Testing Strategy

### Per-Epic Testing Requirements

| Epic | Unit Tests | Integration Tests | E2E Tests |
|------|------------|-------------------|-----------|
| UI-01 | Layout renders | - | - |
| UI-02 | All components | - | - |
| UI-03 | Form validation | Form flows | Lead submission |
| UI-04 | - | All screens | Lead review (approve/reject) |
| UI-05 | - | All screens | Bad lead claim |
| UI-06 | - | Dashboard renders | - |
| UI-07 | Error components | Error flows | Session expiry |
| UI-08 | - | Feature flags | - |

### E2E Critical Paths (Required)

1. **Lead Submission Flow**
   - Happy path: form → submit → confirmation
   - Anti-spam: honeypot trigger → blocked

2. **Admin Lead Review**
   - Approve: select → approve → distributed
   - Reject: select → reject reason → rejected
   - Bulk: multi-select → bulk action → confirmation

3. **Provider Workflow**
   - Inbox: view leads → open detail
   - Bad lead: view → submit claim

4. **Session Handling**
   - Expiry → redirect → login → context restore

---

## Timeline Estimate

### Aggressive (Parallel Work)
- **Phase 1:** 1-2 days (Foundation)
- **Phase 2:** 3-4 days (Core Workflows)
- **Phase 3:** 3-4 days (Provider Experience)
- **Phase 4:** 2-3 days (Polish)
- **Total:** ~2 weeks

### Conservative (Sequential)
- **Phase 1:** 2-3 days
- **Phase 2:** 4-5 days
- **Phase 3:** 4-5 days
- **Phase 4:** 3-4 days
- **Total:** ~3 weeks

---

## Execution Rules

1. **Do NOT skip epics** - Dependencies are strict
2. **Do NOT start until dependencies met**
3. **One Cursor prompt per story** - Keep scope focused
4. **Every story must**:
   - Reference `UX_Design_Architecture_and_Standards.md`
   - Reference `Testing_Architecture_and_Standards.md`
   - Generate required tests
5. **Definition of Done**:
   - All acceptance criteria met
   - Tests pass locally
   - Code builds without errors
   - Documentation updated

---

## Success Criteria

The UI/UX implementation is successful when:
- ✅ Admins can operate confidently
- ✅ Providers understand value and cost
- ✅ End users can submit leads easily
- ✅ No screens require redesign for Phase 2 or 3
- ✅ All tests pass (unit, integration, E2E)
- ✅ Mobile-responsive where required

---

## Next Steps

1. **Immediate:** Start UI-01 (Foundation & App Shells)
2. **Parallel:** Set up testing infrastructure (Vitest, MSW, Playwright)
3. **Review:** After each epic, review and validate before proceeding

---

**Created By:** AI Assistant  
**Date:** Jan 5, 2026  
**Status:** Ready for Execution

**First Epic:** UI-01 - UI Foundation & App Shells

