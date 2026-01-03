# EPIC 04 — Competition Levels & Subscriptions

## Epic Goal
Enable Admins to configure **Competition Levels per niche** (price + max recipients + ordering), and enable Service Providers to **subscribe to one or more Competition Levels** per niche so they can receive leads under defined competitive conditions.

Competition Levels are a market mechanism balancing **fairness, exclusivity, and budget accessibility** by controlling how many providers compete for each lead, while allowing Service Providers to define what an acceptable lead is per level (filters/eligibility handled in **Epic 05**, distribution fairness handled in **Epic 06**).

---

## In Scope
- Admin management of Competition Levels per niche (CRUD + validation)
- Competition Level ordering per niche (atomic reorder)
- Provider subscriptions to Competition Levels (subscribe/unsubscribe)
- Subscription visibility (provider “my subscriptions”, admin “all subscriptions”)
- Subscription lifecycle state (active/inactive) driven by balance (Epic 07 triggers)
- Clear constraints to prevent invalid configuration states

---

## Non-Goals (MVP)
- Provider bidding / auction pricing
- Tier bundles / discounts
- Provider lead caps (day/week/month) (future)
- Auto-approval rules for providers/subscriptions beyond existing approval flow

---

## Dependencies
- **EPIC 01 — Platform Foundation & Access Control** (RBAC, auth, MFA for admin)
- **EPIC 07 — Billing & Payments** (balances, balance-change triggers)
- **EPIC 10 — Email Infrastructure** (subscription status notifications)
- **Locked Architecture** (tables + key fields)

---

## Data Concepts (Requirements)

### Competition Level (per niche)
Defines:
- `name` (unique per niche)
- `description` (optional)
- `price_per_lead` (≥ 0)
- `max_recipients` (> 0; reasonable upper bound e.g., ≤ 100)
- `order_position` (unique per niche; used by distribution traversal + start rotation)
- `is_active` (true by default)

### Provider Subscription
Links a provider to a Competition Level:
- Providers may subscribe to **multiple Competition Levels** (including multiple within the same niche)
- Subscription has an **eligibility flag** (`is_active`) that can be toggled based on balance
- Unsubscribe is **soft delete** (retain history)

---

## Stories & Tasks

### Story 1: Admin Manage Competition Levels (CRUD + Validation)
**As an** admin  
**I want** to create and manage competition levels per niche  
**So that** I can control pricing and exclusivity

**Acceptance Criteria**
- Admin can create a Competition Level for a niche with:
  - `name` (required, max 100 chars, unique per niche)
  - `description` (optional)
  - `price_per_lead` (required, DECIMAL, ≥ 0)
  - `max_recipients` (required, INTEGER, > 0, ≤ 100)
  - `order_position` (optional on create; if omitted, defaults to `MAX(order_position)+1` for the niche)
  - `is_active` (default true)
- Admin can update: `name`, `description`, `price_per_lead`, `max_recipients`, `order_position`, `is_active`
- Admin cannot update: `id`, `niche_id`, `created_at`
- Deactivated levels (`is_active=false`) cannot be used for new subscriptions or distribution
- Existing subscriptions remain but are not eligible for distribution when level is inactive
- Cannot delete a level if it has:
  - active subscriptions (non-deleted)
  - historical lead assignments
  - must deactivate instead
- All changes are audit-logged with old/new values

**Tasks**
- POST `/api/v1/admin/niches/:nicheId/competition-levels`
  - validate name uniqueness per niche
  - validate price/max recipients
  - auto-assign order_position if missing
- PATCH `/api/v1/admin/competition-levels/:id`
  - validate order_position uniqueness when changed
  - validate max_recipients not lower than active subscriber count
- GET `/api/v1/admin/niches/:nicheId/competition-levels`
  - include subscription counts
- DELETE `/api/v1/admin/competition-levels/:id`
  - block with 409 if active subscriptions or historical assignments exist
  - suggest deactivate
- Enforce RBAC + MFA
- Audit log: `competition_level_created`, `competition_level_updated`, `competition_level_deactivated`, `competition_level_deleted_attempt_blocked`

---

### Story 2: Admin Reorder Competition Levels (Atomic + Validation)
**As an** admin  
**I want** to reorder competition levels within a niche  
**So that** distribution traversal and starting rotation follow my configuration

**Acceptance Criteria**
- Admin can reorder levels within a niche
- Order positions are reassigned sequentially (1..N) based on provided order
- Reorder is atomic
- Validation:
  - all provided IDs belong to the niche
  - all levels for the niche are included (no partial reorder)
- Audit log captures old order and new order

**Tasks**
- POST `/api/v1/admin/niches/:nicheId/competition-levels/reorder`
  - payload: `{ ordered_level_ids: [...] }`
- Validate membership + completeness
- Update order_position transactionally (1..N)
- Audit log reorder metadata `{ old_order, new_order }`
- Return updated list ordered by order_position
- Enforce RBAC + MFA

---

### Story 3: Provider View Competition Levels (Context + Subscription Status)
**As a** service provider  
**I want** to view available competition levels per niche  
**So that** I can choose where to subscribe

**Acceptance Criteria**
- Default returns only active levels (`is_active=true`)
- Optional `include_inactive=true` returns all levels
- Listing includes:
  - `id`, `name`, `description`, `price_per_lead`, `max_recipients`, `order_position`, `is_active`
  - `is_subscribed` (boolean)
  - `subscription_status` if subscribed (`active` | `inactive`)
  - `active_subscribers_count` (informational)
- Ordered by `order_position` ASC

**Tasks**
- GET `/api/v1/provider/niches/:nicheId/competition-levels?include_inactive=false`
- Join to provider_subscriptions to compute subscription status
- Count active subscriptions per level
- RBAC enforcement (provider only)

---

### Story 4: Provider Subscribe / Unsubscribe (Validation + Constraints)
**As a** service provider  
**I want** to subscribe/unsubscribe to competition levels  
**So that** I can manage which leads I’m eligible to receive

**Acceptance Criteria**
**Subscribe**
- Cannot subscribe if:
  - level is inactive
  - already subscribed (non-deleted)
  - provider account is suspended
- Subscription defaults to `is_active=true` unless balance < price_per_lead
- Initial balance check:
  - if insufficient, subscription is created but `is_active=false` and provider can top up
- Subscription actions are audit-logged

**Unsubscribe**
- Unsubscribe is soft delete (`deleted_at` set)
- Cannot unsubscribe if there are pending lead assignments (integration with Epic 06)
- Unsubscribe action audit-logged

**Tasks**
- POST `/api/v1/provider/competition-levels/:id/subscribe`
  - validate level active
  - enforce uniqueness
  - check provider status
  - initial balance check (Epic 07)
  - queue notification if created inactive (Epic 10)
  - audit log
- POST `/api/v1/provider/competition-levels/:id/unsubscribe`
  - validate ownership
  - check pending assignments (Epic 06)
  - soft delete
  - audit log
- Enforce uniqueness constraint: `UNIQUE(provider_id, competition_level_id) WHERE deleted_at IS NULL`
- RBAC enforcement (provider only)

---

### Story 5: Subscription Status Management (Auto-Deactivate/Reactivate)
**As a** system  
**I want** subscriptions auto-deactivated/reactivated based on balance  
**So that** providers don’t receive unpaid leads

**Acceptance Criteria**
**Auto-deactivate**
- If provider balance < price_per_lead for a subscribed level, set subscription `is_active=false`
- Triggered by balance-affecting events (Epic 07): charge, payment failure, manual adjustment
- Notify provider via email template `subscription_deactivated`
- Audit-logged

**Auto-reactivate**
- If provider balance ≥ price_per_lead for an inactive subscription, set `is_active=true`
- Triggered by balance-affecting events (Epic 07): successful payment, refund, manual adjustment
- Notify provider via email template `subscription_reactivated`
- Audit-logged

**Batch processing**
- Status check runs after each balance-affecting transaction
- Background job runs every 5 minutes to reactivate eligible subscriptions

**Tasks**
- Implement service: `checkAndUpdateSubscriptionStatus(provider_id)`
- Add scheduled job: `reactivateEligibleSubscriptions()`
- Queue notification emails via Epic 10
- Audit log status changes with reason

---

### Story 6: Competition Level Rules Enforcement (Validation + Constraints)
**As a** system  
**I want** competition level rules enforced consistently  
**So that** configuration cannot create invalid states

**Acceptance Criteria**
- Field constraints:
  - `name` unique per niche; max 100 chars
  - `price_per_lead` ≥ 0
  - `max_recipients` > 0 and ≤ 100
  - `order_position` ≥ 1 and unique per niche
  - `is_active` default true
- Business rules:
  - cannot change `niche_id`
  - cannot deactivate the only active level for a niche
  - cannot set `max_recipients` below current active subscriber count
  - cannot delete levels with active subscriptions or historical assignments

**Tasks**
- Add DB constraints + indexes (see schema notes)
- Implement validation in admin APIs
- Unit/integration tests for violations and error messaging

---

### Story 7: Provider View My Subscriptions
**As a** service provider  
**I want** to view all my subscriptions  
**So that** I can manage my lead sources

**Acceptance Criteria**
- Provider can list all subscriptions (active + inactive)
- Includes: niche_name, level_name, price_per_lead, max_recipients, `is_active`, subscribed_at
- Filterable: `niche_id`, `is_active`
- Sortable: newest first
- Paginated (50/page)

**Tasks**
- GET `/api/v1/provider/subscriptions?page=1&limit=50&niche_id=&is_active=`
- Join niches + competition_levels
- RBAC enforcement

---

### Story 8: Admin View All Subscriptions
**As an** admin  
**I want** to view all provider subscriptions  
**So that** I can monitor adoption and health

**Acceptance Criteria**
- Admin can list subscriptions across all providers
- Includes provider identity, niche, level, price, `is_active`, subscribed_at, current_balance
- Filterable: provider_id, niche_id, competition_level_id, is_active
- Searchable: provider email
- Sortable: newest first
- Paginated (50/page)

**Tasks**
- GET `/api/v1/admin/subscriptions?page=1&limit=50&sort=-subscribed_at`
- Join users + niches + competition_levels + balances
- Enforce RBAC + MFA

---

## Database Schema Notes
Align to locked architecture. (Explicit schema recommended to remove ambiguity for Cursor agents.)

### competition_levels
- `id`, `niche_id`, `name`, `description`, `price_per_lead`, `max_recipients`, `order_position`, `is_active`, timestamps, `deleted_at`
- Constraints:
  - unique `(niche_id, name)` where not deleted
  - unique `(niche_id, order_position)` where not deleted
  - checks for price/max/order

### provider_subscriptions
- `id`, `provider_id`, `competition_level_id`, `is_active`, `deactivation_reason`, timestamps, `deleted_at`
- Constraint:
  - unique `(provider_id, competition_level_id)` where not deleted

---

## Definition of Done
- Admin CRUD competition levels per niche with validation + safe delete behavior
- Admin reorder is atomic and validated (completeness + membership)
- Providers can view levels with subscription status + subscriber counts
- Providers can subscribe/unsubscribe with validation and soft delete
- Provider “My Subscriptions” view implemented
- Admin “All Subscriptions” view implemented
- Auto-deactivate/reactivate supported (triggered by Epic 07) and audited
- At least 1 active level per niche enforced
- RBAC enforced everywhere; MFA enforced for all admin routes
- Tests:
  - Unit: validation rules, reorder, uniqueness, status transitions
  - Integration: subscribe/unsubscribe flows, reorder validation, delete-prevention
  - API: RBAC/MFA, pagination/filter/search
  - Performance: subscription status check < 100ms per provider; reactivation job < 5s for 1000 subs

---

