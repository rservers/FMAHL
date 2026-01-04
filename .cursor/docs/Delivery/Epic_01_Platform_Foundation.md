# EPIC 01 — Platform Foundation & Access Control

## Epic Goal
Establish a secure, auditable, and production-ready foundation for the Find Me a Hot Lead platform, enabling safe multi-role access, strong security guarantees, and future extensibility.

This epic is **foundational** and must be completed before any other epic.

---

## In Scope
- Unified identity system
- Authentication & session management (JWT)
- Email verification
- Password reset
- Account status enforcement
- Role-Based Access Control (RBAC)
- Admin MFA (MVP)
- Audit logging
- Rate limiting
- System actor identity
- Environment & secrets management

---

## User Roles
- **Admin** — platform operator
- **Service Provider** — lead buyer
- **End User** — lead submitter
- **System** — background jobs, schedulers, webhooks

---

## Database Schema

> **Note:** This epic defines the foundational tables used across the platform. Downstream epics may extend these tables, but must not break constraints defined here.

### users
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'provider', 'end_user', 'system')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'deactivated')),
  email_verified BOOLEAN DEFAULT false,

  email_verification_token_hash VARCHAR(255),
  email_verification_expires_at TIMESTAMPTZ,

  password_reset_token_hash VARCHAR(255),
  password_reset_expires_at TIMESTAMPTZ,

  mfa_secret VARCHAR(255),
  mfa_enabled BOOLEAN DEFAULT false,

  last_login_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
  ON users(email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash
  ON users(password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;
```

### audit_log
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(20),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(50),
  entity_id UUID,
  metadata JSONB,
  admin_only_memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
```

### Revoked Tokens (Redis)
- **Key:** `revoked_token:<token_hash>`
- **Value:** `1`
- **TTL:** 7 days (match JWT expiry)

---

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` (provider registration)
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh` *(future; not in MVP unless explicitly enabled)*
- `GET  /api/v1/auth/me`

### Email Verification
- `POST /api/v1/auth/verify-email?token=<token>`
- `POST /api/v1/auth/resend-verification`

### Password Reset
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

### MFA (Admin)
- `POST /api/v1/auth/mfa/enroll`
- `POST /api/v1/auth/mfa/verify`
- `POST /api/v1/auth/mfa/disable` *(requires MFA challenge)*

### Admin — Account Management
- `GET  /api/v1/admin/users`
- `GET  /api/v1/admin/users/:id`
- `PUT  /api/v1/admin/users/:id/status`
- `PUT  /api/v1/admin/users/:id/role`

### Admin — Audit Logs
- `GET  /api/v1/admin/audit-logs`
- `GET  /api/v1/admin/audit-logs/:id`

---

## API Request/Response Schemas

> These schemas are the baseline contract. Individual services may add fields, but should not remove or rename fields without versioning.

### POST /api/v1/auth/register
**Public endpoint (no auth)**

**Request**
```json
{
  "email": "provider@example.com",
  "password": "SecurePass123!",
  "company_name": "ABC Roofing",
  "role": "provider"
}
```

**Response 201**
```json
{
  "user_id": "uuid",
  "email": "provider@example.com",
  "status": "pending",
  "email_verified": false,
  "message": "Registration successful. Please check your email to verify your account."
}
```

**Errors**
```json
{ "error": "Validation failed", "details": [{ "field": "email", "message": "Invalid email format" }] }
```
```json
{ "error": "Email already registered" }
```

### POST /api/v1/auth/login
**Public endpoint (no auth)**

**Request**
```json
{ "email": "provider@example.com", "password": "SecurePass123!" }
```

**Response 200**
```json
{
  "access_token": "jwt_token",
  "user": {
    "id": "uuid",
    "email": "provider@example.com",
    "role": "provider",
    "status": "active",
    "email_verified": true,
    "mfa_enabled": false
  }
}
```

**Response 200 — MFA Required (Admin)**
```json
{ "mfa_required": true, "mfa_token": "temporary_token" }
```

**Errors**
```json
{ "error": "Invalid email or password" }
```
```json
{ "error": "Please verify your email before logging in" }
```
```json
{ "error": "Your account has been suspended. Please contact support." }
```

### POST /api/v1/auth/mfa/verify
**Requires temporary MFA token**

**Request**
```json
{ "mfa_token": "temporary_token", "code": "123456" }
```

**Response 200**
```json
{
  "access_token": "jwt_token",
  "user": { "id": "uuid", "email": "admin@example.com", "role": "admin", "status": "active", "mfa_enabled": true }
}
```

**Errors**
```json
{ "error": "Invalid MFA code" }
```
```json
{ "error": "MFA token expired. Please log in again." }
```

### POST /api/v1/auth/verify-email?token=<token>
**Public endpoint (no auth)**

**Response 200**
```json
{ "message": "Email verified successfully. You can now log in.", "email_verified": true }
```

**Errors**
```json
{ "error": "Invalid verification token" }
```
```json
{ "error": "Verification token expired", "resend_available": true }
```

### POST /api/v1/auth/forgot-password
**Public endpoint (no auth)**

**Request**
```json
{ "email": "provider@example.com" }
```

**Response 200**
```json
{ "message": "If an account exists with this email, a password reset link has been sent." }
```

### POST /api/v1/auth/reset-password
**Public endpoint (no auth)**

**Request**
```json
{ "token": "reset_token", "new_password": "NewSecurePass123!" }
```

**Response 200**
```json
{ "message": "Password reset successfully. You can now log in." }
```

**Errors**
```json
{ "error": "Invalid reset token" }
```
```json
{ "error": "Reset token expired. Please request a new one." }
```

### PUT /api/v1/admin/users/:id/status
**RBAC:** Admin *(MFA required)*

**Request**
```json
{ "status": "suspended", "reason": "Fraudulent activity detected" }
```

**Response 200**
```json
{ "user_id": "uuid", "status": "suspended", "updated_at": "2026-01-02T14:30:00Z" }
```

**Errors**
```json
{ "error": "Invalid status value" }
```
```json
{ "error": "User not found" }
```

### GET /api/v1/admin/audit-logs?entity=lead&entity_id=uuid&page=1&limit=50
**RBAC:** Admin *(MFA required)*

**Response 200**
```json
{
  "logs": [
    {
      "id": "uuid",
      "actor_id": "uuid",
      "actor_role": "admin",
      "action": "lead_approved",
      "entity": "lead",
      "entity_id": "uuid",
      "metadata": { "previous_status": "pending_approval", "new_status": "approved" },
      "admin_only_memo": "Verified contact information",
      "created_at": "2026-01-02T14:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 123, "total_pages": 3 }
}
```


## Stories & Tasks

### Story 1: Unified User Identity
**As a** system  
**I want** a single identity model for all actors  
**So that** access control is consistent and secure

**Acceptance Criteria**
- Single `users` table
- Role enum: `admin`, `provider`, `end_user`, `system`
- Account status enum: `pending`, `active`, `suspended`, `deactivated`
- Role and status changes are audit-logged

**Tasks**
- Design users table
- Implement role enforcement middleware
- Implement status enforcement middleware
- Prevent role or status escalation

---

### Story 2: Authentication & Sessions
**As a** user  
**I want** secure authentication  
**So that** my account is protected

**Acceptance Criteria**
- Secure password hashing
- JWT-based authentication
- Access token expiry enforced
- Revoked tokens are rejected

**Tasks**
- Implement JWT generation (7-day expiry)
- Implement JWT verification middleware
- Implement token revocation (Redis blacklist)
- Secure token storage (HTTP-only cookies)

---

#### Password Policy (Story 2A)
**Acceptance Criteria**
- Minimum **8 characters**
- At least **1 uppercase**, **1 lowercase**, **1 number**, **1 special character**
- Password **cannot contain the email address**
- (Optional) Reject common passwords (e.g., via zxcvbn/common list)
- Frontend shows a **password strength meter**

**Tasks**
- Implement validation at API boundary (backend is source of truth)
- Hash using **bcrypt** (cost factor **12**)
- Add password strength feedback (frontend)

#### JWT Token Structure
**Access Token Payload (example)**
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "provider",
  "status": "active",
  "iat": 1234567890,
  "exp": 1234567890 + (7 * 24 * 60 * 60)  // 7 days from iat
}
```

**Token Storage**
- Web app: **HTTP-only cookie** (recommended)
- API clients: `Authorization: Bearer <token>`

**Expiry**
- Access token: **7 days**
- MFA temporary token: **5 minutes**
- Refresh token: **Not implemented in MVP** (future)

**Logout / Revocation**
- On logout, add the token hash to Redis `revoked_token:<token_hash>` with TTL 7 days.


### Story 3: Email Verification
**As a** service provider  
**I want** to verify my email address  
**So that** the platform can trust my identity

**Acceptance Criteria**
- New provider accounts require email verification
- Verification token is hashed at rest
- Token expires after 24 hours
- Resend verification supported
- `email_verified` enforced before provider activation

**Tasks**
- Generate verification token
- Store hashed token + expiry
- Verification endpoint
- Resend verification flow

---

### Story 4: Password Reset
**As a** user  
**I want** to reset my password  
**So that** I can regain access to my account

**Acceptance Criteria**
- Forgot password generates reset token
- Token expires after 1 hour
- Reset link sent via email
- Old password invalidated after reset

**Tasks**
- Forgot password endpoint
- Reset token generation & storage
- Reset password endpoint
- Token validation & expiry

---

#### Email Templates (Epic 10 Integration)
**Required Templates**
- `email_verification` — sent after registration  
  - Variables: `contact_name`, `verification_link`, `expires_at`
- `password_reset` — sent after forgot-password request  
  - Variables: `contact_name`, `reset_link`, `expires_at`
- `account_status_changed` — sent when an admin changes account status  
  - Variables: `provider_name`, `new_status`, `reason` *(optional)*

**Delivery**
- All emails are enqueued via **BullMQ** (Epic 10)
- Email failures **do not block** the user flow (they are logged and retried via queue policy)
- Delivery outcomes are recorded in `email_events` (Epic 10)


### Story 5: Account Status Management
**As an** admin  
**I want** to manage account status  
**So that** I can control platform access

**Acceptance Criteria**
- New accounts start in `pending`
- Admins can activate, suspend, or deactivate accounts
- Suspended or deactivated users cannot authenticate
- Status changes are audit-logged

**Tasks**
- Admin endpoints for status changes
- Enforce status checks during authentication
- Audit logging for status transitions

---

### Story 6: Role-Based Access Control (RBAC)
**As a** system  
**I want** strict role-based authorization  
**So that** users only access permitted resources

**Acceptance Criteria**
- Admin-only routes blocked for non-admins
- Provider data scoped by provider_id
- End users cannot access admin/provider APIs

**Tasks**
- RBAC middleware
- Resource ownership checks
- Authorization test coverage

---

### Story 7: Admin MFA (MVP)
**As an** admin  
**I want** MFA enforced  
**So that** platform control is protected

**Acceptance Criteria**
- MFA required for all admin accounts
- MFA enrollment enforced on first admin login
- MFA challenge required for admin-only routes

**Tasks**
- MFA secret storage
- TOTP verification
- MFA enforcement middleware

---

### Story 8: Audit Logging
**As an** admin  
**I want** a complete audit trail  
**So that** all sensitive actions are traceable

**Acceptance Criteria**
- Audit log records:
  - actor_id
  - actor_role
  - action
  - entity
  - entity_id
  - metadata
  - admin_only_memo (optional)
- Audit logs are immutable

**Tasks**
- Design audit_log table
- Centralized audit logger
- Read-only admin access

---

### Story 9: Rate Limiting
**As a** system  
**I want** rate limiting on all endpoints  
**So that** abuse is prevented

**Acceptance Criteria**
- 100 requests/minute per user
- Redis-backed limiter
- 429 returned when exceeded
- Rate limit headers included

**Tasks**
- Implement Redis rate limiter
- Apply limiter globally
- Add enforcement tests

---

#### Rate Limiting Configuration
**Global Default**
- 100 requests/minute per authenticated user
- 20 requests/minute per IP for unauthenticated endpoints

**Endpoint-Specific Overrides**
- `POST /api/v1/auth/login`: **5 attempts per email per 15 minutes**
- `POST /api/v1/auth/register`: **3 registrations per IP per hour**
- `POST /api/v1/auth/forgot-password`: **3 requests per email per hour**
- `POST /api/v1/auth/verify-email`: **10 attempts per IP per minute**
- `POST /api/v1/auth/mfa/verify`: **5 attempts per MFA token**

**Implementation**
- Redis-backed sliding window
- Emit headers:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`


### Story 10: System Actor Identity
**As a** system  
**I want** automated actions attributed  
**So that** background work is auditable

**Acceptance Criteria**
- `system` role exists
- Jobs and webhooks log actions as system

**Tasks**
- Create system user
- Inject system context into workers

#### System User Specification (Recommended)
**System User Record**
```json
{
  "id": "00000000-0000-0000-0000-000000000000",
  "email": "system@findmeahotlead.internal",
  "role": "system",
  "status": "active",
  "email_verified": true
}
```

**Usage**
- Background jobs & scheduled tasks (Epic 12)
- Webhook handlers (Epic 10)
- Automated lead distribution (Epic 06)
- Automated billing & refunds (Epic 07 / Epic 09)

**Audit Logging**
- System actions use `actor_id = 00000000-0000-0000-0000-000000000000`
- `actor_role = "system"`

---

### Story 11: Environment & Secrets Management
**As a** platform  
**I want** secrets managed securely  
**So that** credentials are protected

**Acceptance Criteria**
- No secrets committed to code
- Environment-based configuration
- Separate dev/staging/prod

**Tasks**
- Secret manager integration
- Environment loader
- CI secret scanning

---

## Definition of Done
- All admin routes require MFA
- Email verification enforced for providers
- RBAC enforced on all APIs
- Account status enforced during auth
- Rate limiting enabled globally
- Audit logs generated for all privileged actions
- No hardcoded secrets
- Security tests (SQLi, XSS, CSRF)
- Auth middleware latency < 50ms
- Unit & integration tests passing

---

## Deferred Items from Other Epics

### Rate Limiting for EPIC 04 Routes ✅ COMPLETED
**Deferred From:** EPIC 04 - Competition Levels & Subscriptions  
**Priority:** P2  
**Completed:** Jan 4, 2026

**Implementation:**
- ✅ Added 5 new rate limit configurations to `rate-limit.ts`
- ✅ Created 5 helper functions for EPIC 04 rate limits
- ✅ Applied rate limiting to all 5 EPIC 04 routes
- ✅ All routes return rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)

**Rate Limits Applied:**
- `POST /api/v1/admin/niches/:nicheId/competition-levels` - 100 req/min per admin
- `PATCH /api/v1/admin/competition-levels/:id` - 100 req/min per admin
- `POST /api/v1/admin/niches/:nicheId/competition-levels/reorder` - 50 req/min per admin
- `POST /api/v1/provider/competition-levels/:id/subscribe` - 30 req/min per provider
- `POST /api/v1/provider/competition-levels/:id/unsubscribe` - 30 req/min per provider

**Files Modified:**
- `apps/web/lib/middleware/rate-limit.ts` - Added configs and helper functions
- `apps/web/app/api/v1/admin/niches/[nicheId]/competition-levels/route.ts` - Applied rate limiting
- `apps/web/app/api/v1/admin/competition-levels/[id]/route.ts` - Applied rate limiting
- `apps/web/app/api/v1/admin/niches/[nicheId]/competition-levels/reorder/route.ts` - Applied rate limiting
- `apps/web/app/api/v1/provider/competition-levels/[id]/subscribe/route.ts` - Applied rate limiting
- `apps/web/app/api/v1/provider/competition-levels/[id]/unsubscribe/route.ts` - Applied rate limiting

**Status:** ✅ Complete and tested

---

## Dependencies
- None (foundational)

---