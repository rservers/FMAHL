# EPIC 01 — Platform Foundation & Access Control

## Implementation Plan

| Field | Value |
|-------|-------|
| **Epic Reference** | `.cursor/docs/Delivery/Epic_01_Platform_Foundation.md` |
| **Dependencies** | None (foundational) |
| **Blocks** | All other epics |
| **Estimated Effort** | 3-4 days |
| **Status** | 🟢 **COMPLETE** |

---

## Executive Summary

EPIC 01 establishes the security and identity foundation for the entire platform. It includes user authentication, authorization (RBAC), email verification, password reset, MFA for admins, audit logging, and rate limiting.

**Critical Path:** Database schema → Auth utilities → Middleware → API routes → Admin APIs

---

## Current State Analysis

### Existing Code

| Component | Status | Gap Analysis |
|-----------|--------|--------------|
| `packages/database/schema.sql` | ⚠️ Partial | Missing: status enum, email verification fields, MFA fields, system role, audit_log table |
| `apps/web/lib/jwt.ts` | ⚠️ Partial | Missing: status in payload, token hashing for revocation |
| `apps/web/lib/password.ts` | ⚠️ Partial | Needs: cost factor 12, password validation |
| `apps/web/app/api/auth/*` | ⚠️ Partial | Has: login, signup, me. Missing: logout, verify-email, password reset, MFA |
| Rate limiting | ❌ Missing | Need Redis-backed rate limiter |
| Token revocation | ❌ Missing | Need Redis blacklist |
| RBAC middleware | ❌ Missing | Need role-based access control |
| MFA | ❌ Missing | Need TOTP for admin accounts |
| Audit logging | ❌ Missing | Need audit_log table and service |

---

## Implementation Roadmap

### Phase 1: Database Schema (Foundation)
**Priority: CRITICAL — Blocks all other phases**

```
┌─────────────────────────────────────────────────────────────┐
│ packages/database/schema.sql                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Update user_role enum → add 'system'                     │
│ 2. Add user_status enum (pending, active, suspended, deact) │
│ 3. Update users table:                                       │
│    - Replace is_active → status                             │
│    - Add email_verified                                      │
│    - Add email_verification_token_hash + expires_at         │
│    - Add password_reset_token_hash + expires_at             │
│    - Add mfa_secret, mfa_enabled                            │
│ 4. Create audit_log table                                   │
│ 5. Add all indexes per EPIC 01 spec                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ packages/database/seed.ts (new)                             │
├─────────────────────────────────────────────────────────────┤
│ 1. Create system user:                                      │
│    id: 00000000-0000-0000-0000-000000000000                 │
│    email: system@findmeahotlead.internal                    │
│    role: system                                             │
│    status: active                                           │
└─────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] Updated `schema.sql` with all EPIC 01 tables/columns
- [ ] `seed.ts` for system user
- [ ] Migration runs successfully

---

### Phase 2: Core Auth Utilities
**Depends on: Phase 1**

```
┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/password.ts                                    │
├─────────────────────────────────────────────────────────────┤
│ - SALT_ROUNDS = 12 (was 10)                                 │
│ - validatePassword(password, email): ValidationResult       │
│   • Min 8 chars                                             │
│   • 1 uppercase, 1 lowercase, 1 number, 1 special           │
│   • Cannot contain email                                    │
│ - hashPassword(password): string                            │
│ - verifyPassword(password, hash): boolean                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/jwt.ts                                         │
├─────────────────────────────────────────────────────────────┤
│ interface JWTPayload {                                      │
│   sub: string       // user_id                              │
│   email: string                                             │
│   role: UserRole                                            │
│   status: UserStatus                                        │
│   iat: number                                               │
│   exp: number                                               │
│ }                                                           │
│                                                             │
│ - signToken(user): string                                   │
│ - verifyToken(token): JWTPayload | null                     │
│ - hashToken(token): string  // for revocation lookup        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/redis.ts (new)                                 │
├─────────────────────────────────────────────────────────────┤
│ - Redis client singleton                                    │
│ - Connection handling                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/token-revocation.ts (new)                      │
├─────────────────────────────────────────────────────────────┤
│ - revokeToken(token): Promise<void>                         │
│   → Redis SET revoked_token:{hash} 1 EX 604800 (7 days)     │
│ - isTokenRevoked(token): Promise<boolean>                   │
│   → Redis GET revoked_token:{hash}                          │
└─────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] Updated `password.ts` with validation
- [ ] Updated `jwt.ts` with full payload
- [ ] New `redis.ts` client
- [ ] New `token-revocation.ts`

---

### Phase 3: Middleware Stack
**Depends on: Phase 2**

```
┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/middleware/auth.ts                             │
├─────────────────────────────────────────────────────────────┤
│ withAuth(handler, options?)                                 │
│ 1. Extract token from Authorization header or cookie        │
│ 2. Verify JWT signature                                     │
│ 3. Check token not revoked (Redis)                          │
│ 4. Check user status != suspended/deactivated               │
│ 5. For providers: check email_verified                      │
│ 6. Attach user to request context                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/middleware/rbac.ts                             │
├─────────────────────────────────────────────────────────────┤
│ requireRole(...roles: UserRole[])                           │
│ - Check user.role in allowed roles                          │
│ - Return 403 if not authorized                              │
│                                                             │
│ requireOwnership(getResourceOwnerId)                        │
│ - For provider-scoped resources                             │
│ - Admins bypass ownership checks                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/middleware/rate-limit.ts                       │
├─────────────────────────────────────────────────────────────┤
│ Rate Limits (Redis sliding window):                         │
│ ┌────────────────────────┬────────────────────────────────┐ │
│ │ Endpoint               │ Limit                          │ │
│ ├────────────────────────┼────────────────────────────────┤ │
│ │ Global (authenticated) │ 100 req/min per user           │ │
│ │ Global (anonymous)     │ 20 req/min per IP              │ │
│ │ POST /auth/login       │ 5 per email per 15 min         │ │
│ │ POST /auth/register    │ 3 per IP per hour              │ │
│ │ POST /auth/forgot-pwd  │ 3 per email per hour           │ │
│ │ POST /auth/verify-email│ 10 per IP per minute           │ │
│ │ POST /auth/mfa/verify  │ 5 per MFA token                │ │
│ └────────────────────────┴────────────────────────────────┘ │
│                                                             │
│ Response Headers:                                           │
│ - X-RateLimit-Limit                                         │
│ - X-RateLimit-Remaining                                     │
│ - X-RateLimit-Reset                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/middleware/mfa.ts                              │
├─────────────────────────────────────────────────────────────┤
│ requireMFA(handler)                                         │
│ - For admin-only routes                                     │
│ - Verify MFA was completed in session                       │
│ - Return 403 if MFA not verified                            │
└─────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] `middleware/auth.ts`
- [ ] `middleware/rbac.ts`
- [ ] `middleware/rate-limit.ts`
- [ ] `middleware/mfa.ts`

---

### Phase 4: Audit Logging Service
**Depends on: Phase 1**

```
┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/services/audit-logger.ts                       │
├─────────────────────────────────────────────────────────────┤
│ interface AuditEntry {                                      │
│   actor_id: string                                          │
│   actor_role: UserRole                                      │
│   action: string                                            │
│   entity?: string                                           │
│   entity_id?: string                                        │
│   metadata?: Record<string, any>                            │
│   admin_only_memo?: string                                  │
│ }                                                           │
│                                                             │
│ async function logAudit(entry: AuditEntry): Promise<void>   │
│                                                             │
│ Pre-defined actions:                                        │
│ - user.registered                                           │
│ - user.login                                                │
│ - user.logout                                               │
│ - user.email_verified                                       │
│ - user.password_reset                                       │
│ - user.mfa_enabled                                          │
│ - user.mfa_disabled                                         │
│ - admin.user_status_changed                                 │
│ - admin.user_role_changed                                   │
└─────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] `services/audit-logger.ts`

---

### Phase 5: Authentication API Routes
**Depends on: Phases 2, 3, 4**

```
API Route Structure:
apps/web/app/api/v1/auth/
├── register/route.ts       POST - Provider registration
├── login/route.ts          POST - User login
├── logout/route.ts         POST - User logout (revoke token)
├── me/route.ts             GET  - Get current user
├── verify-email/route.ts   POST - Verify email token
├── resend-verification/route.ts  POST - Resend verification
├── forgot-password/route.ts      POST - Request password reset
├── reset-password/route.ts       POST - Reset password with token
└── mfa/
    ├── enroll/route.ts     POST - Start MFA enrollment (admin)
    ├── verify/route.ts     POST - Complete MFA enrollment
    ├── challenge/route.ts  POST - MFA login challenge
    └── disable/route.ts    POST - Disable MFA
```

**Route Specifications:**

| Route | Auth | Rate Limit | Audit |
|-------|------|------------|-------|
| `POST /register` | Public | 3/IP/hr | ✅ |
| `POST /login` | Public | 5/email/15min | ✅ |
| `POST /logout` | Required | Global | ✅ |
| `GET /me` | Required | Global | ❌ |
| `POST /verify-email` | Public | 10/IP/min | ✅ |
| `POST /resend-verification` | Public | 3/email/hr | ❌ |
| `POST /forgot-password` | Public | 3/email/hr | ❌ |
| `POST /reset-password` | Public | Global | ✅ |
| `POST /mfa/enroll` | Admin | Global | ✅ |
| `POST /mfa/verify` | Admin | 5/token | ✅ |
| `POST /mfa/challenge` | MFA Token | 5/token | ✅ |
| `POST /mfa/disable` | Admin+MFA | Global | ✅ |

**Deliverables:**
- [ ] All auth routes implemented
- [ ] Request/response schemas match EPIC 01 spec
- [ ] Error handling per spec

---

### Phase 6: Admin API Routes
**Depends on: Phase 5**

```
API Route Structure:
apps/web/app/api/v1/admin/
├── users/
│   ├── route.ts              GET  - List users (paginated)
│   └── [id]/
│       ├── route.ts          GET  - Get user details
│       ├── status/route.ts   PUT  - Update user status
│       └── role/route.ts     PUT  - Update user role
└── audit-logs/
    ├── route.ts              GET  - List audit logs (paginated)
    └── [id]/route.ts         GET  - Get audit log details
```

**All admin routes require:**
- Admin role
- MFA verified
- Audit logging

**Deliverables:**
- [ ] User management endpoints
- [ ] Audit log viewing endpoints
- [ ] Pagination working
- [ ] Filters working

---

### Phase 7: Validation Schemas
**Can be done in parallel with Phase 5**

```
┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/validations/auth.ts                            │
├─────────────────────────────────────────────────────────────┤
│ Schemas:                                                    │
│ - registerSchema                                            │
│ - loginSchema                                               │
│ - verifyEmailSchema                                         │
│ - forgotPasswordSchema                                      │
│ - resetPasswordSchema                                       │
│ - mfaEnrollSchema                                           │
│ - mfaVerifySchema                                           │
│ - mfaChallengeSchema                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ apps/web/lib/validations/admin.ts                           │
├─────────────────────────────────────────────────────────────┤
│ Schemas:                                                    │
│ - updateUserStatusSchema                                    │
│ - updateUserRoleSchema                                      │
│ - listUsersQuerySchema                                      │
│ - listAuditLogsQuerySchema                                  │
└─────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] Auth validation schemas
- [ ] Admin validation schemas

---

## Dependencies to Install

```bash
cd /home/yazan/FMAHL

# MFA (TOTP)
npm install otpauth --workspace=apps/web

# QR Code for MFA enrollment
npm install qrcode @types/qrcode --workspace=apps/web

# Redis client (check if already installed)
npm install ioredis --workspace=apps/web

# Crypto utilities
npm install crypto-js @types/crypto-js --workspace=apps/web
```

---

## Testing Checklist

### Unit Tests
- [ ] Password validation rules
- [ ] Password hashing/verification
- [ ] JWT signing/verification
- [ ] Token revocation
- [ ] Rate limit calculations

### Integration Tests
- [ ] Full registration flow
- [ ] Login with various states (pending, active, suspended)
- [ ] Email verification flow
- [ ] Password reset flow
- [ ] MFA enrollment and verification
- [ ] Admin user management
- [ ] Rate limiting enforcement

### Security Tests
- [ ] SQL injection attempts
- [ ] XSS in user inputs
- [ ] CSRF protection
- [ ] Token tampering
- [ ] Brute force protection

---

## Definition of Done

| Requirement | Status |
|-------------|--------|
| Database schema matches EPIC 01 spec | ✅ |
| All API endpoints implemented | ✅ |
| RBAC enforced on all routes | ✅ |
| Rate limiting enabled globally | ✅ |
| MFA required for admin routes | ✅ |
| Email verification for providers | ✅ |
| Token revocation working | ✅ |
| Audit logging complete | ✅ |
| Password validation correct | ✅ |
| Error responses per spec | ✅ |
| No hardcoded secrets | ✅ |
| Unit tests passing | ⬜ (TODO) |
| Integration tests passing | ⬜ (TODO) |
| Security tests passing | ⬜ (TODO) |

---

## Next Epic Recommendation

After EPIC 01, the dependency graph allows:

```
EPIC 01 (Foundation) ✅
    │
    ├── EPIC 02 (Lead Intake) ← Needs EPIC 10 for email
    │
    ├── EPIC 04 (Competition Levels)
    │       │
    │       └── EPIC 05 (Filters) → EPIC 06 (Distribution)
    │
    ├── EPIC 07 (Billing)
    │
    └── EPIC 10 (Notifications/Email) ← Required by EPIC 02
```

**Recommended next:** **EPIC 10 (Notifications)** or **EPIC 04 (Competition Levels)**

- Choose **EPIC 10** if you want to complete lead intake flows (EPIC 02 needs email)
- Choose **EPIC 04** if you want to focus on provider subscriptions first

---

## Quick Start Commands

```bash
# 1. Start local services (if not running)
cd /home/yazan/FMAHL
./scripts/setup-local.sh

# 2. Install new dependencies
npm install otpauth qrcode @types/qrcode ioredis --workspace=apps/web

# 3. Run migrations after schema update
npm run db:migrate --workspace=packages/database

# 4. Start development
npm run dev --workspace=apps/web
```

---

**Ready to implement? Start with Phase 1: Database Schema Updates!**
