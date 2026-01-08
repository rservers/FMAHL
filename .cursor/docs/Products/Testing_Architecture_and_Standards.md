# Find Me a Hot Lead
## Testing Architecture & Standards

**Document Type:** Testing Architecture & Standards  
**Filename:** Testing_Architecture_and_Standards.md  
**Status:** Final / Approved  
**Audience:** Engineering, Product, QA  
**Primary Use:** Cursor-driven test generation & enforcement  
**Scope:** MVP + Phase 2 + Phase 3 ready  

---

## 1. Purpose of This Document

This document defines **how testing is structured, generated, and enforced** across the Find Me a Hot Lead platform.

It ensures that:
- Tests are generated **by default**, not as an afterthought
- UI, workflows, and critical business paths are protected
- Cursor produces consistent, high-quality tests
- Testing scales with future phases without rewrites

This document complements:
- Product PRDs (Phase 1–3)
- `PRD_UI_UX_MVP_Future_Aware.md`
- `UX_Design_Architecture_and_Standards.md`

It does **not** replace them.

---

## 2. Testing Philosophy (Non-Negotiable)

### 2.1 Test the Behavior, Not the Implementation
- Validate **user-visible behavior**
- Avoid testing internal component structure
- Prefer assertions on:
  - rendered output
  - visible state
  - user actions
  - navigation results

### 2.2 Tests Are Part of “Done”
A feature is **not complete** unless:
- Required tests exist
- Tests pass locally
- Tests are deterministic

### 2.3 Fail Fast, Fail Loud
- Broken tests block merges
- Silent failures are unacceptable
- Errors must surface clearly in test output

---

## 3. Testing Types & Responsibilities

### 3.1 Unit Tests
**Purpose:** Validate isolated logic and UI components.

**Applies to:**
- Reusable UI components
- Utility functions
- Hooks
- Form validation logic

**Characteristics:**
- Fast
- No network calls
- No real routing
- No backend dependencies

---

### 3.2 Integration Tests
**Purpose:** Validate screens and flows with mocked data.

**Applies to:**
- Admin screens
- Provider screens
- Public lead form flows

**Characteristics:**
- Uses real components
- Mocks API responses
- Tests filters, tables, conditional UI

---

### 3.3 End-to-End (E2E) Tests
**Purpose:** Validate critical user journeys end-to-end.

**Applies to:**
- Lead submission
- Admin lead review
- Provider lead consumption
- Anti-spam and error flows

**Characteristics:**
- Runs in a browser
- Simulates real user behavior
- Covers regression-critical paths only

---

## 4. Approved Testing Tooling

### 4.1 Unit & Integration Testing
- **Vitest**
- **@testing-library/react**
- **@testing-library/user-event**

### 4.2 API Mocking Standard (Required)
- **MSW (Mock Service Worker)** is the default API mocking standard for unit/integration tests.
- Prefer MSW over ad-hoc fetch mocks to ensure consistent behavior and realistic request handling.

### 4.3 End-to-End Testing
- **Playwright**

---

## 5. Naming, Locations, and File Structure (Cursor-Critical)

### 5.1 Test Naming Convention (Required)
All tests must follow this convention:

- **Test files**: `<ComponentOrPage>.test.tsx` or `<flow>.spec.ts`
- **Describe blocks**: `<ComponentOrPage>` or `<flow name>`
- **Test cases**: `should <expected behavior> when <condition>`

**Examples**
- `DataTable.test.tsx`
- `AdminLeadList.test.tsx`
- `lead-submission.spec.ts`

Example test name:
- `should show reject reason fields when Reject is clicked`

---

### 5.2 Test File Location (Required)

To keep Cursor consistent and avoid scattered conventions:

#### Component tests (unit/integration)
- Co-locate tests with the component:
  - `src/components/<ComponentName>/<ComponentName>.tsx`
  - `src/components/<ComponentName>/<ComponentName>.test.tsx`

#### Page/screen tests (integration)
- Co-locate with the page route:
  - `src/app/admin/leads/page.tsx`
  - `src/app/admin/leads/page.test.tsx`

#### E2E tests
- Place in:
  - `e2e/<flow>.spec.ts`

---

## 6. Coverage Standards (Required)

### 6.1 UI Components
Every reusable component must have:
- At least **one unit test**
- Coverage for:
  - render
  - primary interaction
  - error/empty state (if applicable)

### 6.2 Screens / Pages
Every screen must have:
- At least **one integration test**
- Coverage for:
  - initial render
  - empty/loading state
  - primary user action

### 6.3 Critical Workflows (E2E Required)

The following workflows **must** have E2E coverage:

#### Public
- Lead submission (happy path)
- Lead submission blocked by anti-spam

#### Admin
- Lead review: approve
- Lead review: reject with reason
- Bulk approve / reject
- Error surfaced to admin

#### Service Provider
- View inbox
- Open lead detail
- **Submit bad lead claim** (required)
- Balance-related blocking (if applicable)

---

## 7. UX-Aligned Testing Rules

### 7.1 Lists & Tables
Tests must verify:
- Columns render correctly
- Sorting works
- Filtering updates results
- Pagination/infinite scroll loads data

### 7.2 Conditional UI
Tests must verify:
- Inline panels appear when triggered
- Required fields block submission
- Cancel restores prior state

### 7.3 Dashboards
Tests must verify:
- Widgets render with data
- Empty states render correctly
- Drilldowns navigate correctly

---

## 8. Anti-Spam & Fraud Testing (Required)

### 8.1 Form Protection Tests
Integration or E2E tests must cover:
- Honeypot triggered → submission blocked
- CAPTCHA failure → submission blocked
- Rate-limit exceeded → submission blocked

### 8.2 Fraud Signal Assertions
Tests must assert that:
- Spam triggers are logged
- Admin can see fraud signals
- End user receives generic error messaging only

---

## 9. Error Handling Tests

### 9.1 Admin Errors
Tests must verify:
- Descriptive error messages render
- Error context is visible
- Retry paths exist where applicable

### 9.2 Service Provider Errors
Tests must verify:
- Safe messaging
- No internal error leakage
- Admin still receives full context

---

## 10. Session & Security Testing

E2E tests must cover:
- Session expiration mid-flow
- Redirect to login
- Context restoration after login (when applicable)

---

## 11. Test Data & Determinism Standards

### 11.1 Mock Data
- Use deterministic fixtures
- Avoid randomness in IDs, dates, and ordering unless explicitly controlled
- Prefer factories/helpers for consistent setup

### 11.2 API Mocking Rules
- Unit/integration tests must mock requests via **MSW**
- No real backend dependencies
- E2E tests may use seeded test data if available; otherwise use stable stubs

---

## 12. Flaky Test Policy (Required)

### 12.1 Definition
A flaky test is any test that intermittently fails without code changes.

### 12.2 Handling Rules
- Flaky tests are treated as production bugs
- Must be addressed within the next development cycle
- Root causes must be eliminated (timing assumptions, unstable selectors, race conditions)

### 12.3 Temporary Quarantine (Last Resort)
If a flaky test blocks critical delivery:
- It may be quarantined behind:
  - a tag (e.g., `@flaky`)
  - a separate CI job
- Quarantine must include:
  - issue ticket reference
  - owner
  - deadline for removal

Quarantine is a temporary exception, not a normal practice.

---

## 13. CI/CD Integration (Required)

### 13.1 When Tests Run
- Unit + integration tests run:
  - on every PR
  - on merge to main
- E2E tests run:
  - on every PR (minimum “smoke subset”)
  - on merge to main (full suite)
  - before deploy to production (full suite)

### 13.2 Blocking Rules
- Any failing unit/integration test blocks merge
- E2E failures block deploy and should block merge unless explicitly waived by Admin/Release owner
- No silent skipping of failures

---

## 14. Performance & Load Testing

Performance/load testing is:
- **Out of scope for MVP**
- Explicitly deferred to a later phase

However, we must:
- Keep the system testable for performance later by avoiding hardcoded limits and supporting pagination/infinite scroll patterns.

---

## 15. Cursor Execution Rules (Critical)

### 15.1 Default Instruction
When using Cursor:

> “When implementing any UI feature, generate the required unit, integration, and/or E2E tests as defined in `Testing_Architecture_and_Standards.md`.”

### 15.2 Scope Control
Cursor prompts must:
- Implement **one screen or component at a time**
- Generate tests in the same task
- Avoid refactoring unrelated files

---

## 16. Definition of Done (Testing)

A feature is complete only when:
- Required tests exist
- Tests pass locally and in CI
- Tests are deterministic
- No flaky tests remain (or are quarantined with a removal deadline)

---

## 17. Phase 2 & Phase 3 Readiness

### Phase 2
- Partner/affiliate attribution tests
- Fraud/quality scoring tests
- Commission calculation scenarios

### Phase 3
- Messaging flows
- Delivered/read state verification
- Conversation closure scenarios

Future tests must extend existing patterns, not introduce new conventions.

---

## Conclusion

This document ensures that:
- Testing is intentional, not optional
- Cursor generates tests reliably and consistently
- Critical workflows are protected
- The platform can scale safely across phases

**Status:** Final & Approved
