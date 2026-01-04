# Development Guide

This guide explains how to work on the Find Me A Hot Lead project, including the epic execution order and how to reference documentation.

---

## 🎯 Epic Execution Plan

**IMPORTANT:** Follow the epic execution plan in order. Each epic builds on previous ones.

**See:** `.cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md` for the full plan with dependencies.

### Current Status

| Phase | Epic | Name | Status | Deferred Items |
|-------|------|------|--------|----------------|
| 1 | 01 | Platform Foundation | ✅ **DONE** | 1 P2 remaining |
| 2 | 10 | Email Infrastructure | ✅ **DONE** | - |
| 3 | 02 | Lead Intake & Confirmation | ✅ **DONE** | - |
| 3 | 03 | Admin Lead Review | ✅ **DONE** | - |
| 3 | 04 | Competition Levels | ✅ **DONE** | - |
| 3 | 05 | Filters & Eligibility | ⬜ **NEXT** | - |
| 4 | 06 | Distribution Engine | ⬜ Pending | - |
| 2 | 07 | Billing & Payments | ⬜ Pending | - |
| 5 | 08 | Provider Dashboard | ⬜ Pending | - |
| 5 | 09 | Bad Lead & Refunds | ⬜ Pending | - |
| 6 | 11 | Reporting & Analytics | ⬜ Pending | 5 P3 items |
| 6 | 12 | Observability & Ops | ⬜ Pending | 2 P2/P3 items |

### Critical Path

```
EPIC 01 ✅ → EPIC 10 → EPIC 04 → EPIC 07 → EPIC 02 → EPIC 05 → EPIC 06
             └──────────────── Parallel ────────────────┘
```

---

## 📁 Documentation Structure

```
.cursor/docs/
├── Delivery/                              # Implementation epics & stories
│   ├── build_plan_mvp_epics.md           # ⭐ Epic index & dependencies
│   ├── DEFERRED_ITEMS_SUMMARY.md         # ⭐ Deferred items tracker (CHECK THIS!)
│   ├── DEFERRED_ITEMS_ANALYSIS.md        # Deferred items analysis & action plan
│   │
│   ├── EPIC_01_IMPLEMENTATION_PLAN.md    # ✅ Completed implementation plans
│   ├── EPIC_02_IMPLEMENTATION_PLAN.md
│   ├── EPIC_03_IMPLEMENTATION_PLAN.md
│   ├── EPIC_04_IMPLEMENTATION_PLAN.md
│   ├── EPIC_10_IMPLEMENTATION_PLAN.md
│   │
│   ├── EPIC_01_DEFERRED_ITEMS_COMPLETE.md # ✅ Deferred items completion reports
│   │
│   ├── EPIC_02_REVIEW.md                 # ✅ Epic review documents
│   ├── EPIC_03_REVIEW.md
│   ├── EPIC_04_REVIEW.md
│   ├── EPIC_10_REVIEW.md
│   │
│   ├── Epic_01_Platform_Foundation.md    # ✅ DONE
│   ├── Epic_02_Lead_Intake_Confirmation.md # ✅ DONE
│   ├── Epic_03_Admin_Lead_Review_Approval.md # ✅ DONE
│   ├── Epic_04_Competition_Levels_Subscriptions.md # ✅ DONE
│   ├── Epic_05_Filters_Eligibility.md    # ⬜ NEXT
│   ├── Epic_06_Distribution_Engine.md
│   ├── Epic_07_Billing_Balance_Payments.md
│   ├── Epic_08_Provider_Lead_Management.md
│   ├── Epic_09_Bad_Lead_Refunds.md
│   ├── Epic_10_Notifications_Email.md    # ✅ DONE
│   ├── Epic_11_Reporting_Analytics.md
│   └── Epic_12_Observability_and_Ops_LOCKED_v4.md
│
├── Products/                              # Product requirements & architecture
│   ├── Document_0_Product_Overview.md
│   ├── Document_1_PRD_MVP.md
│   └── Document_4_Technical_Architecture.md
│
└── Archive/                              # Historical/archived docs
```

---

## 🚀 Development Workflow

### Starting a New Epic

1. **Check the Execution Plan**
   ```bash
   cat .cursor/docs/Delivery/build_plan_mvp_epics.md
   ```
   Verify the epic you want to work on is unblocked.

2. **Review Deferred Items** ⭐ **NEW - IMPORTANT**
   ```bash
   cat .cursor/docs/Delivery/DEFERRED_ITEMS_SUMMARY.md
   ```
   Check if there are any deferred items assigned to this epic from previous epic reviews.
   
   **Questions to ask:**
   - Are there deferred items for this epic?
   - What's the priority (P1/P2/P3)?
   - Should they be implemented now or later?
   - Do they affect the implementation plan?

3. **Read the Epic Document**
   ```bash
   # Example: Starting EPIC 11
   cat .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
   ```
   Look for the "⚠️ Deferred Items from Other Epics" section at the bottom.

4. **Create Implementation Plan**
   Create an implementation plan file like `EPIC_XX_IMPLEMENTATION_PLAN.md` to track progress.
   
   **Include deferred items in the plan:**
   - List all deferred items for this epic
   - Decide which to implement (priority-based)
   - Add them as phases in the implementation plan
   - Document why any P2 items are being deferred further (if applicable)

5. **Reference in Your Code**
   ```typescript
   /**
    * Email Provider Abstraction
    * 
    * EPIC 10: Notifications & Email Infrastructure
    * See: .cursor/docs/Delivery/Epic_10_Notifications_Email.md
    */
   export interface EmailProvider {
     sendEmail(options: EmailOptions): Promise<void>
   }
   ```

6. **Update Status**
   After completing an epic, update the status in:
   - `build_plan_mvp_epics.md`
   - `DEVELOPMENT_GUIDE.md` (this file)
   - `DEFERRED_ITEMS_SUMMARY.md` (mark completed items)

---

### Completing an Epic

After implementing all phases of an epic, follow this checklist:

1. **✅ Code Quality Review**
   - All TypeScript compilation errors fixed
   - All linter warnings addressed
   - Code follows project conventions
   - Proper error handling in place

2. **✅ Test & Validate**
   - Create test script (e.g., `test-epic05.sh`)
   - Run all tests (unit, integration, build)
   - Verify database schema changes
   - Test all API endpoints
   - Verify UI pages (if applicable)

3. **✅ Review Against Implementation Plan**
   - All phases completed
   - All acceptance criteria met
   - Business rules enforced
   - Security requirements satisfied

4. **✅ Create Review Document**
   - Create `EPIC_XX_REVIEW.md`
   - Document what was built
   - List findings (if any)
   - Identify deferred items (P1/P2/P3)
   - Provide recommendations

5. **✅ Update Deferred Items Tracker** ⭐ **IMPORTANT**
   ```bash
   # Update the master tracker
   nano .cursor/docs/Delivery/DEFERRED_ITEMS_SUMMARY.md
   ```
   
   **For each deferred item:**
   - Add to DEFERRED_ITEMS_SUMMARY.md with priority
   - Add to target epic specification (⚠️ section)
   - Document context, recommendation, and guidance
   - Estimate effort and expected impact

6. **✅ Update Documentation**
   - Update `DEVELOPMENT_GUIDE.md` status table
   - Update `build_plan_mvp_epics.md` if needed
   - Update `README.md` if new features affect setup

7. **✅ Commit & Push**
   ```bash
   git add -A
   git commit -m "feat(epicXX): complete EPIC XX implementation"
   git push
   ```

8. **✅ Create Summary Document** (Optional)
   - Create `EPIC_XX_SUMMARY.md` for executive summary
   - Highlight key features and metrics

---

## 🔗 How to Reference Documentation

### In Code Comments

```typescript
/**
 * User authentication service
 * 
 * Implements EPIC 01 - Platform Foundation & Access Control
 * See: .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 * 
 * Requirements:
 * - JWT token generation and validation
 * - Password hashing with bcrypt (cost 12)
 * - Role-based access control (RBAC)
 */
export async function authenticateUser(email: string, password: string) {
  // Implementation
}
```

### In API Routes

```typescript
/**
 * POST /api/v1/auth/register
 * 
 * EPIC 01: Platform Foundation & Access Control
 * See: .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 * 
 * Rate limit: 3 registrations per IP per hour
 */
export async function POST(request: NextRequest) {
  // Implementation
}
```

### In Database Migrations

```sql
-- EPIC 01: Platform Foundation
-- Creates user authentication tables per EPIC 01 spec
-- See: .cursor/docs/Delivery/Epic_01_Platform_Foundation.md

CREATE TABLE users (
  -- Implementation
);
```

---

## 📋 Quick Reference

### Product Documents

| Document | Purpose |
|----------|---------|
| `Document_0_Product_Overview.md` | High-level product vision, user personas |
| `Document_1_PRD_MVP.md` | Detailed MVP requirements |
| `Document_4_Technical_Architecture.md` | System design, tech decisions |

### Epic Dependencies

| Epic | Requires | Unlocks |
|------|----------|---------|
| 01 ✅ | None | All other epics |
| 10 | 01 | 02 |
| 04 | 01 | 05, 06 |
| 07 | 01 | 06, 08, 09, 11 |
| 02 | 01, 10 | 03, 06 |
| 05 | 01, 04 | 06 |
| 03 | 01, 02 | - |
| 06 | 04, 05, 07 | 08, 09, 11 |
| 08 | 06, 07 | - |
| 09 | 06, 07 | - |
| 11 | 06, 07 | - |
| 12 | All | - |

---

## 💡 Best Practices

### ✅ DO:
- Check `EPIC_EXECUTION_PLAN.md` before starting work
- Reference epics in function/component docstrings
- Link to specific user stories when implementing features
- Update epic status after completion
- Check epic dependencies before starting

### ❌ DON'T:
- Skip epics or work out of order
- Implement features without checking epic requirements
- Ignore epic dependencies
- Forget to update status trackers

---

## 🧩 Completed Epics

### EPIC 01: Platform Foundation ✅

**Implementation Plan:** `.cursor/docs/Delivery/EPIC_01_IMPLEMENTATION_PLAN.md`

### EPIC 10: Notifications & Email ✅

**Implementation Plan:** `.cursor/docs/Delivery/EPIC_10_IMPLEMENTATION_PLAN.md`  
**Review:** `.cursor/docs/Delivery/EPIC_10_REVIEW.md`

**Key Endpoints**
```
POST /api/v1/auth/register              # sends email_verification
POST /api/v1/auth/resend-verification   # sends email_verification
POST /api/v1/auth/forgot-password       # sends password_reset
POST /api/v1/webhooks/ses               # SNS → SES events
GET/POST /api/v1/admin/email-templates  # list/create templates
GET/PUT/DELETE /api/v1/admin/email-templates/:id
POST /api/v1/admin/email-templates/:id/preview
GET /api/v1/admin/email-events          # event log
```

**Local Email UI**
- MailHog: http://localhost:8025

### EPIC 02: Lead Intake & Confirmation ✅

**Implementation Plan:** `.cursor/docs/Delivery/EPIC_02_IMPLEMENTATION_PLAN.md`  
**Review:** `.cursor/docs/Delivery/EPIC_02_FINAL_REVIEW.md`

**Key Endpoints**
```
POST /api/v1/leads                      # submit lead
GET  /api/v1/leads/confirm              # confirm via token
POST /api/v1/leads/:id/resend-confirmation
GET  /api/v1/niches/:id/form-schema     # get niche form
```

**UI Pages**
```
/confirm/success          # confirmation success
/confirm/expired          # token expired
/confirm/invalid          # invalid token
/confirm/already-confirmed
```

**What was built:**
- Lead submission with niche-specific form validation
- Email confirmation with secure tokens (32-byte, SHA-256, 24h expiry)
- Lead status flow: `pending_confirmation` → `pending_approval`
- Attribution tracking (UTM params, referrer, partner)
- Resend confirmation (max 3, 5min cooldown)
- Dynamic form schema validation
- Confirmation UI pages

### EPIC 03: Admin Lead Review & Approval ✅

**Implementation Plan:** `.cursor/docs/Delivery/EPIC_03_IMPLEMENTATION_PLAN.md`  
**Review:** `.cursor/docs/Delivery/EPIC_03_REVIEW.md`

**Key Endpoints**
```
GET  /api/v1/admin/leads                # list leads (filtered)
GET  /api/v1/admin/leads/stats          # queue statistics
GET  /api/v1/admin/leads/:id            # lead details
POST /api/v1/admin/leads/:id/approve    # approve lead
POST /api/v1/admin/leads/:id/reject     # reject lead
POST /api/v1/admin/leads/bulk-approve   # bulk approve (max 50)
POST /api/v1/admin/leads/bulk-reject    # bulk reject (max 50)
```

**UI Pages**
```
/dashboard/leads          # admin lead queue
/dashboard/leads/:id      # lead detail + actions
```

**What was built:**
- Admin lead queue with filtering and pagination
- Lead detail view with full context
- Approve/reject actions with optional notes
- Bulk operations (up to 50 leads)
- Queue statistics (pending count, avg time, etc.)
- Optional email notifications (lead_approved, lead_rejected)
- Lead status flow: `pending_approval` → `approved` or `rejected`
- Admin notes for internal context

**What was built (EPIC 01):**
- Database schema with users, audit_log, and all enums
- JWT authentication with 7-day tokens
- Password hashing (bcrypt cost 12) with validation
- RBAC middleware
- Rate limiting (Redis-backed)
- Token revocation (Redis blacklist)
- MFA for admin accounts (TOTP)
- Audit logging service
- System user seeded

**API Routes Created:**
```
/api/v1/auth/register      POST - Provider registration
/api/v1/auth/login         POST - Login (with MFA support)
/api/v1/auth/logout        POST - Logout (token revocation)
/api/v1/auth/me            GET  - Get current user
/api/v1/auth/verify-email  POST - Email verification
/api/v1/auth/resend-verification  POST
/api/v1/auth/forgot-password      POST
/api/v1/auth/reset-password       POST
/api/v1/auth/mfa/enroll    POST - MFA enrollment
/api/v1/auth/mfa/verify    POST - Complete MFA setup
/api/v1/auth/mfa/challenge POST - MFA login
/api/v1/auth/mfa/disable   POST - Disable MFA
/api/v1/admin/users        GET  - List users
/api/v1/admin/users/:id    GET  - Get user
/api/v1/admin/users/:id/status  PUT - Update status
/api/v1/admin/users/:id/role    PUT - Update role
/api/v1/admin/audit-logs   GET  - List audit logs
/api/v1/admin/audit-logs/:id    GET - Get audit log
```

---

## 📚 Additional Resources

### Key Files

| File | Purpose |
|------|---------|
| `EPIC_EXECUTION_PLAN.md` | Epic order, dependencies, timeline |
| `build_plan_mvp_epics.md` | Epic index with summaries |
| `.cursorrules` | Coding standards and rules |

### Services

| Service | URL | Purpose |
|---------|-----|---------|
| Web App | http://localhost:3000 | Next.js application |
| MailHog | http://localhost:8025 | View dev emails |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache & queues |

---

**Happy Coding! 🚀**

Remember: Always follow the Epic Execution Plan and reference docs in your code.
