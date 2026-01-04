# Epic Review Checklist

**Purpose:** Ensure comprehensive and consistent epic reviews that capture all deferred items.

**When to Use:** After completing all phases of an epic, before moving to the next epic.

---

## Pre-Review Preparation

- [ ] All implementation phases completed
- [ ] All tests passing (build, integration, unit)
- [ ] All code committed and pushed
- [ ] Documentation updated (README, guides)

---

## Review Process

### 1. Implementation Completeness ✅

- [ ] Verify all phases from implementation plan completed
- [ ] Check all acceptance criteria met
- [ ] Confirm all business rules enforced
- [ ] Validate all API endpoints working
- [ ] Verify database schema changes applied
- [ ] Check all email templates created (if applicable)
- [ ] Confirm audit actions added (if applicable)

### 2. Code Quality Assessment ✅

- [ ] TypeScript compilation successful (0 errors)
- [ ] Linter passing (0 errors)
- [ ] Code follows project patterns from previous epics
- [ ] Proper error handling in all routes
- [ ] Security controls in place (RBAC, MFA, validation)
- [ ] Performance optimizations applied (indexes, caching)
- [ ] Code well-documented (JSDoc comments)

### 3. Business Rules Verification ✅

- [ ] All critical business rules enforced
- [ ] Edge cases handled
- [ ] Validation comprehensive
- [ ] Transaction safety verified (where applicable)
- [ ] Race conditions prevented (row-level locking, etc.)

### 4. Security & Compliance ✅

- [ ] Authentication/authorization on all protected routes
- [ ] Input validation with Zod schemas
- [ ] SQL injection prevention (parameterized queries)
- [ ] Audit logging for sensitive actions
- [ ] Webhook signature verification (if applicable)
- [ ] Rate limiting applied (if applicable)

### 5. Integration Points ✅

- [ ] Verify integration with previous epics
- [ ] Check service dependencies working
- [ ] Confirm middleware usage correct
- [ ] Validate email service integration (if applicable)

### 6. Testing & Validation ✅

- [ ] Test script created (`test-epicXX.sh`)
- [ ] Database migration successful
- [ ] Manual API testing performed
- [ ] Integration tests passing

---

## Deferred Items Identification ⭐ **CRITICAL**

### Instructions

During your review, identify any work that was:
- Not implemented due to time constraints
- Simplified for MVP (needs enhancement later)
- Identified as future improvement
- Discovered as technical debt
- Performance optimization needed
- Security enhancement possible

### For Each Deferred Item

**Step 1: Document in Review**

In your `EPIC_XX_REVIEW.md` or `EPIC_XX_COMPREHENSIVE_REVIEW.md`, create a section:

```markdown
## Deferred Items

### 1. [Item Name] (P1/P2/P3)
**Priority:** P1 (Critical) / P2 (Important) / P3 (Nice to have)
**Target Epic:** EPIC XX or "Future"
**Effort:** X hours
**Description:** Full explanation of what needs to be done
**Reason for Deferral:** Why it wasn't done now
**Implementation Approach:** Step-by-step guidance
**Expected Impact:** Benefits when implemented
```

**Step 2: Add to Master Tracker**

- [ ] Open `.cursor/docs/Delivery/DEFERRED_ITEMS_SUMMARY.md`
- [ ] Add section: "## From EPIC XX (Epic Name)"
- [ ] For each deferred item, include:
  - [ ] Priority (P1/P2/P3)
  - [ ] Target epic
  - [ ] Status emoji (🔴 Not Started)
  - [ ] Effort estimate
  - [ ] Context paragraph
  - [ ] Recommendation paragraph
  - [ ] Implementation approach
  - [ ] Expected impact
- [ ] Update "Priority Summary" totals
- [ ] Update "Total Deferred Effort" calculation
- [ ] Update "Last Updated" timestamp
- [ ] Update "Next Review" to next epic

**Step 3: Add to Target Epic Specification**

- [ ] Open target epic file (e.g., `Epic_12_Observability_and_Ops_LOCKED_v4.md`)
- [ ] Find or create section: "## ⚠️ Deferred Items from Other Epics"
- [ ] Add detailed entry:
  ```markdown
  ### [Item Name] (EPIC XX)
  **Deferred From:** EPIC XX - Epic Name
  **Priority:** P1/P2/P3
  **Description:** [Full description]
  **Implementation Approach:**
  1. Step 1
  2. Step 2
  3. Step 3
  **Monitoring:** [How to verify]
  **Expected Impact:** [Benefits]
  ```

**Step 4: Commit All Changes**

```bash
# Add all documentation changes
git add .cursor/docs/Delivery/EPIC_XX_REVIEW.md
git add .cursor/docs/Delivery/DEFERRED_ITEMS_SUMMARY.md
git add .cursor/docs/Delivery/Epic_YY_*.md  # Target epic(s)

# Commit with descriptive message
git commit -m "docs(deferred): document EPIC XX deferred items

Added X deferred items from EPIC XX review:
- Item 1 (P2) -> EPIC YY
- Item 2 (P3) -> Future
...

Updated:
- DEFERRED_ITEMS_SUMMARY.md (master tracker)
- Epic_YY_*.md (target epic specifications)

All items documented with context, priority, and implementation guidance."

git push
```

---

## Priority Guidelines

### P1 - Critical for MVP
**Definition:** Must be implemented before production launch. System is incomplete or at risk without it.

**Examples:**
- Security vulnerabilities
- Data integrity issues
- Blocking dependencies for other epics
- Critical business logic missing

**Action:** Should not be deferred. If deferred, requires explicit approval and risk assessment.

---

### P2 - Important for Production
**Definition:** Important for production quality and operations. Should be implemented before or shortly after launch.

**Examples:**
- Monitoring and alerting
- Performance optimizations (when current performance is acceptable)
- Operational tooling
- Enhanced security features

**Action:** Plan to implement in EPIC 11 or EPIC 12. Document mitigation if launched without.

---

### P3 - Nice to Have
**Definition:** Valuable improvements that can wait. Enhances UX or adds convenience but system functions without it.

**Examples:**
- UI improvements
- Additional admin tools
- Analytics and reporting enhancements
- Future feature expansions

**Action:** Plan for post-MVP or future releases. Prioritize based on user feedback.

---

## Review Document Creation

### Create Review Document

- [ ] Create `EPIC_XX_REVIEW.md` or `EPIC_XX_COMPREHENSIVE_REVIEW.md`
- [ ] Include all sections:
  - [ ] Executive Summary
  - [ ] Implementation Completeness (phase-by-phase)
  - [ ] Code Quality Assessment
  - [ ] Business Rules Enforcement
  - [ ] Security Assessment
  - [ ] Integration Points Verification
  - [ ] Database Schema Review (if applicable)
  - [ ] API Endpoints Verification
  - [ ] Test Results
  - [ ] **Deferred Items** (with priorities)
  - [ ] Findings & Recommendations
  - [ ] Conclusion

### Commit Review

```bash
git add .cursor/docs/Delivery/EPIC_XX_REVIEW.md
git commit -m "docs(epicXX): comprehensive quality review

Overall Assessment: [Rating]

Key Findings:
- [Finding 1]
- [Finding 2]

Deferred Items: X items (P1: X, P2: X, P3: X)

Status: [APPROVED / APPROVED WITH CONDITIONS / NEEDS WORK]"

git push
```

---

## Post-Review Actions

### Update Status Trackers

- [ ] Update `DEVELOPMENT_GUIDE.md` - Mark epic as ✅ Done
- [ ] Update `EPIC_EXECUTION_PLAN.md` - Update status and dates
- [ ] Update `README.md` - Add new endpoints/features (if user-facing)
- [ ] Update `build_plan_mvp_epics.md` - Mark epic complete (if applicable)

### Prepare for Next Epic

- [ ] Review `EPIC_EXECUTION_PLAN.md` for next epic
- [ ] Check `DEFERRED_ITEMS_SUMMARY.md` for items assigned to next epic
- [ ] Read next epic specification
- [ ] Verify dependencies are complete

---

## Common Mistakes to Avoid

### ❌ DON'T:
- Skip documenting deferred items (causes work to be lost)
- Only update DEFERRED_ITEMS_SUMMARY.md (also update target epic specs)
- Document deferred items without priority (P1/P2/P3 is required)
- Defer P1 items without approval
- Create vague deferred items ("improve performance" - be specific!)
- Skip effort estimates (makes planning impossible)

### ✅ DO:
- Document EVERY deferred item, even small ones
- Update both tracker AND target epic specification
- Include context so future developers understand why
- Provide implementation guidance (step-by-step)
- Estimate effort realistically
- Get approval before deferring P1 items
- Be specific and actionable

---

## Review Quality Checklist

Before considering review complete:

- [ ] All implementation phases verified
- [ ] Code quality assessed (with rating)
- [ ] Business rules verified
- [ ] Security reviewed
- [ ] Integration points checked
- [ ] **All deferred items identified**
- [ ] **All deferred items documented in DEFERRED_ITEMS_SUMMARY.md**
- [ ] **All deferred items added to target epic specs**
- [ ] Review document created
- [ ] Status trackers updated
- [ ] All changes committed and pushed

---

## Template: Deferred Item Entry

```markdown
### [Short Descriptive Name] (P1/P2/P3)
**Target Epic:** EPIC XX - Epic Name (or "Future")
**Status:** 🔴 Not Started
**Effort:** X hours

**Context:**
[2-3 sentences explaining what this is and why it was deferred]

**Recommendation:**
[What should be implemented and how]

**Implementation Approach:**
1. Step 1
2. Step 2
3. Step 3

**Expected Impact:**
- Benefit 1
- Benefit 2

**Integration:**
[How it integrates with other epics, if applicable]
```

---

## Example: Well-Documented Deferred Item

```markdown
### Balance Reconciliation Job (P3)
**Target Epic:** EPIC 12 - Observability & Ops
**Status:** 🔴 Not Started
**Effort:** 0.5 hours

**Context:**
Provider cached balance should be periodically reconciled against the 
immutable ledger to detect any discrepancies. While the cached balance 
is updated atomically with ledger entries, a reconciliation job provides 
additional confidence and early detection of any calculation bugs.

**Recommendation:**
- Implement nightly cron job (3 AM)
- Compare `providers.balance` vs `SUM(provider_ledger.amount)`
- Use tolerance of 0.01 for floating point comparison
- Log discrepancies with severity: warning
- Alert if discrepancies > 1.00 USD

**Implementation Approach:**
1. Create job in `apps/worker/src/jobs/balance-reconciliation.ts`
2. Use `calculateBalance()` from ledger service
3. Schedule via BullMQ repeat jobs (cron: `0 3 * * *`)
4. Add monitoring metrics (discrepancies_found, auto_corrections)
5. Add alerting for large discrepancies

**Expected Impact:**
- Early detection of balance calculation bugs
- Increased confidence in billing accuracy
- Compliance for financial audits
- Estimated detection time: <24 hours for any discrepancy

**Integration:**
Uses `calculateBalance()` from EPIC 07 ledger service.
Monitoring integrates with EPIC 12 Prometheus/Grafana stack.
```

---

**Checklist Complete?** If all items checked, epic review is complete! 🎉

**Next:** Create implementation plan for next epic, incorporating any deferred items assigned to it.

---

**Maintained By:** Development Team
**Last Updated:** Jan 4, 2026
**Version:** 1.0

