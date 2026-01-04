# Development Guide

This guide explains how to work on the Find Me A Hot Lead project, including the epic execution order and how to reference documentation.

---

## 🎯 Epic Execution Plan

**IMPORTANT:** Follow the epic execution plan in order. Each epic builds on previous ones.

**See:** `.cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md` for the full plan with dependencies.

### Current Status

| Phase | Epic | Name | Status |
|-------|------|------|--------|
| 1 | 01 | Platform Foundation | ✅ **DONE** |
| 2 | 10 | Email Infrastructure | ⬜ **NEXT** |
| 2 | 04 | Competition Levels | ⬜ Pending |
| 2 | 07 | Billing & Payments | ⬜ Pending |
| 3 | 02 | Lead Intake | ⬜ Pending |
| 3 | 05 | Filters & Eligibility | ⬜ Pending |
| 3 | 03 | Admin Lead Review | ⬜ Pending |
| 4 | 06 | Distribution Engine | ⬜ Pending |
| 5 | 08 | Provider Dashboard | ⬜ Pending |
| 5 | 09 | Bad Lead & Refunds | ⬜ Pending |
| 6 | 11 | Reporting & Analytics | ⬜ Pending |
| 6 | 12 | Observability & Ops | ⬜ Pending |

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
│   ├── EPIC_EXECUTION_PLAN.md            # ⭐ START HERE - Epic order & dependencies
│   ├── build_plan_mvp_epics.md           # Epic index
│   ├── EPIC_01_IMPLEMENTATION_PLAN.md    # ✅ Completed implementation plan
│   ├── Epic_01_Platform_Foundation.md    # ✅ DONE
│   ├── Epic_02_Lead_Intake_Confirmation.md
│   ├── Epic_03_Admin_Lead_Review_Approval.md
│   ├── Epic_04_Competition_Levels_Subscriptions.md
│   ├── Epic_05_Filters_Eligibility.md
│   ├── Epic_06_Distribution_Engine.md
│   ├── Epic_07_Billing_Balance_Payments.md
│   ├── Epic_08_Provider_Lead_Management.md
│   ├── Epic_09_Bad_Lead_Refunds.md
│   ├── Epic_10_Notifications_Email.md    # ⬜ NEXT
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
   cat .cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md
   ```
   Verify the epic you want to work on is unblocked.

2. **Read the Epic Document**
   ```bash
   # Example: Starting EPIC 10
   cat .cursor/docs/Delivery/Epic_10_Notifications_Email.md
   ```

3. **Create Implementation Plan** (Optional)
   Create an implementation plan file like `EPIC_XX_IMPLEMENTATION_PLAN.md` to track progress.

4. **Reference in Your Code**
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

5. **Update Status**
   After completing an epic, update the status in:
   - `EPIC_EXECUTION_PLAN.md`
   - `DEVELOPMENT_GUIDE.md` (this file)

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

**What was built:**
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
