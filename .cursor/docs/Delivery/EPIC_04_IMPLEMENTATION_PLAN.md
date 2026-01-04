# EPIC 04 Implementation Plan — Competition Levels & Subscriptions

**Epic:** 04 - Competition Levels & Provider Subscriptions  
**Status:** 🟡 Planning  
**Started:** Jan 4, 2026  
**Depends On:** EPIC 01 ✅ (Platform Foundation)  
**Unlocks:** EPIC 05 (Filters & Eligibility), EPIC 06 (Distribution Engine)

---

## Overview

This epic establishes the **tiered competition system** that controls how leads are priced and distributed:

- **Competition Levels** define pricing tiers per niche (e.g., "Exclusive" = $50/lead to 1 provider, "Standard" = $10/lead to 5 providers)
- **Provider Subscriptions** link providers to competition levels they want to receive leads from
- **Auto-status management** based on balance (integration point for EPIC 07)

**Business Impact:** This is the core monetization model - higher competition levels = more exclusivity = higher price.

---

## Current State Analysis

### ✅ Already Exists

| Component | Location | Status |
|-----------|----------|--------|
| `niches` table | `packages/database/schema.sql` | ✅ Working |
| `providers` table | `packages/database/schema.sql` | ✅ Working |
| `provider_subscriptions` table | `packages/database/schema.sql` | ⚠️ Needs refactor |
| Admin auth + MFA | `apps/web/lib/middleware/` | ✅ Working |
| Provider auth | `apps/web/lib/middleware/` | ✅ Working |
| Audit logging | `apps/web/lib/services/audit-logger.ts` | ✅ Working |
| Email service | `packages/email/` | ✅ EPIC 10 complete |

### ⚠️ Schema Refactoring Required

The current `provider_subscriptions` table is designed for 1:1 (one subscription per provider) and includes balance management. EPIC 04 requires:

1. **New `competition_levels` table** - tiered pricing per niche
2. **Refactored subscriptions** - many-to-many (provider to competition levels)
3. **Balance moved to EPIC 07** - separate provider balance management

### 🔨 Needs Building

| Component | Priority |
|-----------|----------|
| `competition_levels` table | P0 |
| `competition_level_subscriptions` table (renamed to avoid conflict) | P0 |
| Admin Competition Level CRUD APIs | P0 |
| Admin Reorder API | P0 |
| Provider View Levels API | P0 |
| Provider Subscribe/Unsubscribe APIs | P0 |
| Provider My Subscriptions API | P1 |
| Admin All Subscriptions API | P1 |
| Subscription status management service | P1 |
| Scheduled reactivation job | P2 |
| Email templates (subscription_deactivated, subscription_reactivated) | P2 |

---

## Implementation Phases

### Phase 1: Database Schema (1 day)

**Files to Modify:**
- `packages/database/schema.sql`
- `packages/database/migrate.ts`

**New Tables:**

```sql
-- ============================================
-- COMPETITION LEVELS (EPIC 04)
-- ============================================

CREATE TABLE competition_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_per_lead_cents INTEGER NOT NULL CHECK (price_per_lead_cents >= 0),
  max_recipients INTEGER NOT NULL CHECK (max_recipients > 0 AND max_recipients <= 100),
  order_position INTEGER NOT NULL CHECK (order_position >= 1),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Unique constraints (only for non-deleted)
  CONSTRAINT uq_competition_level_name UNIQUE NULLS NOT DISTINCT (niche_id, name, deleted_at),
  CONSTRAINT uq_competition_level_order UNIQUE NULLS NOT DISTINCT (niche_id, order_position, deleted_at)
);

CREATE INDEX idx_competition_levels_niche ON competition_levels(niche_id);
CREATE INDEX idx_competition_levels_active ON competition_levels(niche_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_competition_levels_order ON competition_levels(niche_id, order_position) WHERE deleted_at IS NULL;

-- ============================================
-- COMPETITION LEVEL SUBSCRIPTIONS (EPIC 04)
-- ============================================

CREATE TABLE competition_level_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  competition_level_id UUID NOT NULL REFERENCES competition_levels(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deactivation_reason VARCHAR(255),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Provider can only subscribe once per level (when not deleted)
  CONSTRAINT uq_subscription_provider_level UNIQUE NULLS NOT DISTINCT (provider_id, competition_level_id, deleted_at)
);

CREATE INDEX idx_cls_provider ON competition_level_subscriptions(provider_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cls_level ON competition_level_subscriptions(competition_level_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cls_active ON competition_level_subscriptions(competition_level_id, is_active) WHERE deleted_at IS NULL;
```

**Tasks:**
- [ ] Add `competition_levels` table to schema.sql
- [ ] Add `competition_level_subscriptions` table to schema.sql
- [ ] Add indexes and constraints
- [ ] Create `ensureEpic04Schema()` in migrate.ts
- [ ] Add trigger for updated_at
- [ ] Run migration and verify

---

### Phase 2: Validation Schemas (0.5 day)

**Files to Create:**
- `apps/web/lib/validations/competition-levels.ts`

**Schemas:**

```typescript
// Create competition level
z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price_per_lead_cents: z.number().int().min(0),
  max_recipients: z.number().int().min(1).max(100),
  order_position: z.number().int().min(1).optional(), // auto-assign if omitted
  is_active: z.boolean().default(true),
})

// Update competition level
z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  price_per_lead_cents: z.number().int().min(0).optional(),
  max_recipients: z.number().int().min(1).max(100).optional(),
  order_position: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
})

// Reorder levels
z.object({
  ordered_level_ids: z.array(z.string().uuid()).min(1),
})

// List query
z.object({
  include_inactive: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
```

**Tasks:**
- [ ] Create validation file
- [ ] Define create/update schemas
- [ ] Define reorder schema
- [ ] Define query schemas

---

### Phase 3: Audit Actions (0.25 day)

**Files to Modify:**
- `apps/web/lib/services/audit-logger.ts`

**New Actions:**
```typescript
// Competition levels
COMPETITION_LEVEL_CREATED: 'competition_level.created',
COMPETITION_LEVEL_UPDATED: 'competition_level.updated',
COMPETITION_LEVEL_DEACTIVATED: 'competition_level.deactivated',
COMPETITION_LEVEL_REACTIVATED: 'competition_level.reactivated',
COMPETITION_LEVEL_REORDERED: 'competition_level.reordered',
COMPETITION_LEVEL_DELETE_BLOCKED: 'competition_level.delete_blocked',

// Subscriptions
SUBSCRIPTION_CREATED: 'subscription.created',
SUBSCRIPTION_DEACTIVATED: 'subscription.deactivated',
SUBSCRIPTION_REACTIVATED: 'subscription.reactivated',
SUBSCRIPTION_DELETED: 'subscription.deleted',
```

---

### Phase 4: Admin Competition Level CRUD (1 day)

**Files to Create:**
- `apps/web/app/api/v1/admin/niches/[nicheId]/competition-levels/route.ts`
- `apps/web/app/api/v1/admin/competition-levels/[id]/route.ts`

**Endpoints:**

#### `POST /api/v1/admin/niches/:nicheId/competition-levels`
Create a new competition level for a niche.

**Request:**
```json
{
  "name": "Exclusive",
  "description": "Only you receive the lead",
  "price_per_lead_cents": 5000,
  "max_recipients": 1,
  "is_active": true
}
```

**Response:**
```json
{
  "id": "uuid",
  "niche_id": "uuid",
  "name": "Exclusive",
  "description": "Only you receive the lead",
  "price_per_lead_cents": 5000,
  "max_recipients": 1,
  "order_position": 1,
  "is_active": true,
  "created_at": "2026-01-04T12:00:00Z"
}
```

**Logic:**
1. Validate niche exists
2. Validate name unique within niche
3. Auto-assign order_position if not provided (MAX + 1)
4. Insert record
5. Audit log

#### `GET /api/v1/admin/niches/:nicheId/competition-levels`
List all levels for a niche.

**Response:**
```json
{
  "levels": [
    {
      "id": "uuid",
      "name": "Exclusive",
      "price_per_lead_cents": 5000,
      "max_recipients": 1,
      "order_position": 1,
      "is_active": true,
      "active_subscribers_count": 5,
      "total_subscribers_count": 8
    }
  ],
  "total": 3
}
```

#### `PATCH /api/v1/admin/competition-levels/:id`
Update a competition level.

**Validations:**
- Cannot change `niche_id`
- Cannot set `max_recipients` below active subscriber count
- Cannot deactivate if it's the only active level for the niche

#### `DELETE /api/v1/admin/competition-levels/:id`
Attempt to delete (will block if has subscriptions or historical assignments).

**Response (blocked):**
```json
{
  "error": "Cannot delete competition level with active subscriptions",
  "suggestion": "Deactivate the level instead",
  "active_subscriptions": 5
}
```

**Tasks:**
- [ ] Create POST handler (create level)
- [ ] Create GET handler (list levels)
- [ ] Create PATCH handler (update level)
- [ ] Create DELETE handler (with blocking logic)
- [ ] Apply adminWithMFA middleware
- [ ] Validate inputs
- [ ] Audit log all actions

---

### Phase 5: Admin Reorder API (0.5 day)

**Files to Create:**
- `apps/web/app/api/v1/admin/niches/[nicheId]/competition-levels/reorder/route.ts`

**Endpoint:** `POST /api/v1/admin/niches/:nicheId/competition-levels/reorder`

**Request:**
```json
{
  "ordered_level_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Logic:**
1. Validate all IDs belong to the niche
2. Validate all non-deleted levels are included
3. Atomically update order_position (1..N)
4. Audit log with old/new order

**Tasks:**
- [ ] Create POST handler
- [ ] Validate completeness and membership
- [ ] Transactional update
- [ ] Audit log

---

### Phase 6: Provider View Levels API (0.5 day)

**Files to Create:**
- `apps/web/app/api/v1/provider/niches/[nicheId]/competition-levels/route.ts`

**Endpoint:** `GET /api/v1/provider/niches/:nicheId/competition-levels`

**Query Params:**
- `include_inactive` (boolean, default: false)

**Response:**
```json
{
  "levels": [
    {
      "id": "uuid",
      "name": "Exclusive",
      "description": "Only you receive the lead",
      "price_per_lead_cents": 5000,
      "max_recipients": 1,
      "order_position": 1,
      "is_active": true,
      "is_subscribed": true,
      "subscription_status": "active",
      "active_subscribers_count": 5
    }
  ]
}
```

**Tasks:**
- [ ] Create GET handler
- [ ] Join with subscriptions for current provider
- [ ] Count active subscribers
- [ ] Apply provider authentication
- [ ] Return ordered by order_position

---

### Phase 7: Provider Subscribe/Unsubscribe APIs (1 day)

**Files to Create:**
- `apps/web/app/api/v1/provider/competition-levels/[id]/subscribe/route.ts`
- `apps/web/app/api/v1/provider/competition-levels/[id]/unsubscribe/route.ts`

#### `POST /api/v1/provider/competition-levels/:id/subscribe`

**Validations:**
1. Level exists and is active
2. Provider not already subscribed (non-deleted)
3. Provider account is not suspended
4. Initial balance check (EPIC 07 integration point - stub for now)

**Response:**
```json
{
  "id": "subscription-uuid",
  "competition_level_id": "uuid",
  "competition_level_name": "Exclusive",
  "is_active": true,
  "subscribed_at": "2026-01-04T12:00:00Z"
}
```

#### `POST /api/v1/provider/competition-levels/:id/unsubscribe`

**Validations:**
1. Subscription exists and belongs to provider
2. No pending lead assignments (EPIC 06 integration point - stub for now)

**Logic:**
1. Soft delete (set `deleted_at`)
2. Audit log

**Tasks:**
- [ ] Create subscribe handler
- [ ] Create unsubscribe handler
- [ ] Validate level active/exists
- [ ] Check provider status
- [ ] Enforce uniqueness
- [ ] Soft delete for unsubscribe
- [ ] Audit log both actions

---

### Phase 8: Provider My Subscriptions API (0.5 day)

**Files to Create:**
- `apps/web/app/api/v1/provider/subscriptions/route.ts`

**Endpoint:** `GET /api/v1/provider/subscriptions`

**Query Params:**
- `niche_id` (optional)
- `is_active` (optional)
- `page`, `limit` (pagination)

**Response:**
```json
{
  "subscriptions": [
    {
      "id": "uuid",
      "niche_id": "uuid",
      "niche_name": "VPS Hosting",
      "level_id": "uuid",
      "level_name": "Exclusive",
      "price_per_lead_cents": 5000,
      "max_recipients": 1,
      "is_active": true,
      "subscribed_at": "2026-01-04T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 3,
    "total_pages": 1
  }
}
```

**Tasks:**
- [ ] Create GET handler
- [ ] Join niches + competition_levels
- [ ] Filter by niche_id, is_active
- [ ] Paginate (50/page)
- [ ] Apply provider auth

---

### Phase 9: Admin All Subscriptions API (0.5 day)

**Files to Create:**
- `apps/web/app/api/v1/admin/subscriptions/route.ts`

**Endpoint:** `GET /api/v1/admin/subscriptions`

**Query Params:**
- `provider_id` (optional)
- `niche_id` (optional)
- `competition_level_id` (optional)
- `is_active` (optional)
- `search` (email search)
- `page`, `limit` (pagination)

**Response:**
```json
{
  "subscriptions": [
    {
      "id": "uuid",
      "provider_id": "uuid",
      "provider_email": "provider@example.com",
      "provider_business_name": "Acme Corp",
      "niche_id": "uuid",
      "niche_name": "VPS Hosting",
      "level_id": "uuid",
      "level_name": "Exclusive",
      "price_per_lead_cents": 5000,
      "is_active": true,
      "subscribed_at": "2026-01-04T12:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

**Tasks:**
- [ ] Create GET handler
- [ ] Multi-table join (users, providers, niches, levels)
- [ ] Filter and search
- [ ] Paginate (50/page)
- [ ] Apply adminWithMFA

---

### Phase 10: Subscription Status Service (0.5 day)

**Files to Create:**
- `apps/web/lib/services/subscription-status.ts`

**Service Functions:**

```typescript
// Check and update subscription status based on provider balance
async function checkAndUpdateSubscriptionStatus(providerId: string): Promise<void>

// Deactivate subscriptions for providers with insufficient balance
async function deactivateInsufficientBalanceSubscriptions(providerId: string): Promise<void>

// Reactivate subscriptions for providers with sufficient balance
async function reactivateEligibleSubscriptions(providerId: string): Promise<void>
```

**Logic (stubbed for EPIC 07):**
- For now, always assume balance is sufficient
- EPIC 07 will call these when balance changes

**Tasks:**
- [ ] Create subscription status service
- [ ] Stub balance check (always returns true)
- [ ] Add deactivation_reason tracking
- [ ] Integration point for EPIC 07

---

### Phase 11: Email Templates (0.25 day)

**Files to Modify:**
- `packages/email/templates/defaults.ts`
- `packages/email/types.ts`

**New Templates:**
- `subscription_deactivated` - Notify provider when subscription is deactivated due to low balance
- `subscription_reactivated` - Notify provider when subscription is reactivated after balance restored

**Tasks:**
- [ ] Add template keys to types.ts
- [ ] Add template content to defaults.ts
- [ ] Seed via migration

---

### Phase 12: Integration & Testing (0.5 day)

**Testing Scope:**
1. **Database**: All tables, constraints, indexes
2. **API Routes**: All CRUD operations
3. **Validations**: All business rules
4. **Auth**: Admin MFA, provider auth
5. **Audit**: All actions logged

**Test Script:** `test-epic04.sh`

**Tasks:**
- [ ] Create test script
- [ ] Verify database schema
- [ ] Test admin CRUD operations
- [ ] Test reorder functionality
- [ ] Test provider subscribe/unsubscribe
- [ ] Test list/filter operations
- [ ] Verify audit logging
- [ ] Run full build

---

## API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/admin/niches/:nicheId/competition-levels` | Admin+MFA | Create level |
| GET | `/api/v1/admin/niches/:nicheId/competition-levels` | Admin+MFA | List levels |
| POST | `/api/v1/admin/niches/:nicheId/competition-levels/reorder` | Admin+MFA | Reorder levels |
| GET | `/api/v1/admin/competition-levels/:id` | Admin+MFA | Get level |
| PATCH | `/api/v1/admin/competition-levels/:id` | Admin+MFA | Update level |
| DELETE | `/api/v1/admin/competition-levels/:id` | Admin+MFA | Delete level |
| GET | `/api/v1/admin/subscriptions` | Admin+MFA | List all subscriptions |
| GET | `/api/v1/provider/niches/:nicheId/competition-levels` | Provider | View levels |
| POST | `/api/v1/provider/competition-levels/:id/subscribe` | Provider | Subscribe |
| POST | `/api/v1/provider/competition-levels/:id/unsubscribe` | Provider | Unsubscribe |
| GET | `/api/v1/provider/subscriptions` | Provider | My subscriptions |

---

## Files Created/Modified Summary

### New Files (12)
1. `apps/web/lib/validations/competition-levels.ts`
2. `apps/web/app/api/v1/admin/niches/[nicheId]/competition-levels/route.ts`
3. `apps/web/app/api/v1/admin/niches/[nicheId]/competition-levels/reorder/route.ts`
4. `apps/web/app/api/v1/admin/competition-levels/[id]/route.ts`
5. `apps/web/app/api/v1/admin/subscriptions/route.ts`
6. `apps/web/app/api/v1/provider/niches/[nicheId]/competition-levels/route.ts`
7. `apps/web/app/api/v1/provider/competition-levels/[id]/subscribe/route.ts`
8. `apps/web/app/api/v1/provider/competition-levels/[id]/unsubscribe/route.ts`
9. `apps/web/app/api/v1/provider/subscriptions/route.ts`
10. `apps/web/lib/services/subscription-status.ts`
11. `test-epic04.sh`

### Modified Files (4)
1. `packages/database/schema.sql`
2. `packages/database/migrate.ts`
3. `packages/email/templates/defaults.ts`
4. `packages/email/types.ts`
5. `apps/web/lib/services/audit-logger.ts`

---

## Estimated Effort

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Database schema | 1 day |
| 2 | Validation schemas | 0.5 day |
| 3 | Audit actions | 0.25 day |
| 4 | Admin CRUD APIs | 1 day |
| 5 | Admin reorder API | 0.5 day |
| 6 | Provider view levels API | 0.5 day |
| 7 | Provider subscribe/unsubscribe | 1 day |
| 8 | Provider my subscriptions | 0.5 day |
| 9 | Admin all subscriptions | 0.5 day |
| 10 | Subscription status service | 0.5 day |
| 11 | Email templates | 0.25 day |
| 12 | Integration & testing | 0.5 day |
| **Total** | | **7 days** |

---

## Integration Points

### With EPIC 01 (Platform Foundation) ✅
- Uses admin authentication + MFA middleware
- Uses provider authentication
- Uses audit logging service
- Uses RBAC system

### With EPIC 07 (Billing & Payments) - Future
- Balance checks for subscription activation
- Balance change events trigger status updates
- Provider balance visible in admin subscription list

### With EPIC 05 (Filters & Eligibility) - Future
- Filters are per subscription (competition level)
- Eligibility evaluated per subscription

### With EPIC 06 (Distribution Engine) - Future
- Distribution uses competition level ordering
- Distribution respects max_recipients
- Distribution charges per level price

---

## Business Rules Summary

1. **Name Uniqueness**: Level names must be unique within a niche
2. **Order Uniqueness**: Order positions must be unique within a niche
3. **Price >= 0**: Price can be $0 (free leads)
4. **1 <= Max Recipients <= 100**: Reasonable bounds
5. **At Least One Active**: Cannot deactivate if only active level for niche
6. **Cannot Reduce Below Active**: Cannot set max_recipients below current subscriber count
7. **Soft Delete Only**: Subscriptions are soft-deleted, never hard-deleted
8. **Balance Gating**: Subscriptions auto-deactivate when balance < price (EPIC 07)
9. **No Double Subscribe**: One subscription per provider per level
10. **Active Level Only**: Cannot subscribe to inactive level

---

## Definition of Done

- [ ] All database tables created with proper constraints
- [ ] All API endpoints implemented and tested
- [ ] All validation rules enforced
- [ ] RBAC/MFA enforced on all admin routes
- [ ] Provider auth enforced on all provider routes
- [ ] All actions audit logged
- [ ] Email templates created and seeded
- [ ] Build passes with no TypeScript errors
- [ ] All tests pass

---

**Ready to implement? Start with Phase 1 (Database Schema).**

