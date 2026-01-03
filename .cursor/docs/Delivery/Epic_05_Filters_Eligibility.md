# EPIC 05 — Filters & Eligibility

## Epic Goal
Enable Service Providers to define **subscription-level eligibility criteria** (“filters”) that determine which leads they can receive, and provide a **deterministic, defensive eligibility engine** that produces a clear, cacheable set of **eligible subscriptions grouped by Competition Level** for the Distribution Engine.

This epic is the **eligibility gate**: distribution must only consider subscriptions that pass filter validation + eligibility evaluation.

---

## In Scope (MVP)
- Filter rule schema stored on **provider subscriptions** (`filter_rules` JSONB) and validated against the **niche form schema** (`niches.form_schema` JSONB).
- Explicit mapping of **field types → allowed operators**.
- Provider endpoints to **set / update / view** filters per subscription.
- Filter change logs (`subscription_filter_logs`) including actor + old/new rules + optional admin memo.
- App-layer eligibility evaluator (operators: `eq`, `neq`, `in`, `not_in`, `contains`, `gte`, `lte`, `between`, `exists`) with fail-safe behavior.
- Helper to compute **eligible subscriptions per lead**, grouped by competition level, with **short TTL caching** and explicit invalidation triggers.
- Admin read-only tools to inspect filters, logs, and filter statistics.
- Handling for **niche schema evolution** that may invalidate existing filters (mark invalid, exclude from distribution, notify provider).

---

## Out of Scope (MVP)
- SQL-level filter evaluation (this epic defines eligibility in the **application layer**).
- Provider “availability hours” or scheduling constraints (future).
- Advanced boolean logic (nested AND/OR groups) beyond MVP rule list (future).
- Provider bidding or dynamic pricing (future).

---

## Key Concepts & Definitions

### Filter Rules (Subscription-Level)
Filters are configured **per provider subscription** (i.e., per provider × competition level).  
If a subscription has **no filters** (empty rules array), then **all leads** for that niche are eligible for that subscription (subject to other eligibility checks like subscription active + sufficient balance handled in other epics).

### Contract Boundary (Important)
- **Epic 05** produces: _eligible subscriptions grouped by level_ for a given lead.
- **Epic 06** consumes: eligible subscription set and performs fairness + assignments + charging.
- If a subscription’s `filter_rules` are invalid or malformed, the system must **fail-safe**: treat as **ineligible**.

---

## Data Model (MVP)

### 1) Provider Subscriptions (adds filter fields)
- `provider_subscriptions.filter_rules` JSONB
- `provider_subscriptions.filter_updated_at` TIMESTAMPTZ
- `provider_subscriptions.filter_is_valid` BOOLEAN DEFAULT TRUE

### 2) Filter Logs
`subscription_filter_logs` records every meaningful filter change (provider updates), and admin memo updates are separately audit-logged.

---

## Filter Rule Schema (MVP)

### Stored Shape (JSONB)
```json
{
  "version": 1,
  "rules": [
    {
      "field_key": "location",
      "operator": "in",
      "value": ["CA", "US"]
    },
    {
      "field_key": "budget",
      "operator": "gte",
      "value": 100
    }
  ]
}
```

### Operator Reference (MVP)
| Operator | Meaning | Value Shape |
|---|---|---|
| `eq` | equals | scalar |
| `neq` | not equals | scalar |
| `in` | in set | array |
| `not_in` | not in set | array |
| `contains` | contains substring / element | scalar |
| `gte` | >= | number |
| `lte` | <= | number |
| `between` | between inclusive | `[min,max]` |
| `exists` | field exists and not empty | boolean or omitted |

---

## Field Type → Allowed Operators (MVP)

| Field Type | Allowed Operators |
|---|---|
| `select` | `eq`, `neq`, `in`, `not_in`, `exists` |
| `multi-select` | `in`, `not_in`, `contains`, `exists` |
| `text` | `eq`, `neq`, `contains`, `exists` |
| `number` | `eq`, `neq`, `gte`, `lte`, `between`, `exists` |
| `boolean` | `eq`, `exists` |
| `radio` | `eq`, `neq`, `exists` |

**Validation must enforce**:
- `field_key` exists in `niches.form_schema`
- operator is allowed for that field type
- value shape matches operator
- for `select` / `radio`: value must be in allowed options
- for `between`: min/max are numbers and `min <= max`

---

## Stories & Tasks

### Story 1 — Filter Rule Schema & Validation Helper
**As a** system  
**I want** a strict filter rules schema and validation helper  
**So that** providers cannot create invalid or unsafe eligibility rules

**Acceptance Criteria**
- `filter_rules` validated via Zod (or equivalent)
- Field type → operator mapping enforced
- Operator value shape enforced
- Select/radio values validated against dropdown options
- Validation returns structured errors: `{ field_key, operator, message }`

**Tasks**
- Define TypeScript types and Zod schema for `filter_rules`
- Implement mapping: field type → allowed operators
- Implement helper: `validateFilterRules(filter_rules, niche_schema, dropdown_values) -> { valid, errors[] }`
- Unit tests: all field types × operators (valid + invalid)
- Unit tests: invalid values for select/radio; invalid shapes for `in`, `between`, etc.

---

### Story 2 — Provider Configure Filters per Subscription
**As a** service provider  
**I want** to set filters per subscription  
**So that** I only receive leads matching my criteria

**Acceptance Criteria**
- Provider can set/update `filter_rules` for a subscription they own
- Default behavior: no filters (empty rules) means “all eligible”
- Validation uses Story 1 helper
- Changes apply only to **future eligibility evaluations**
- Log written to `subscription_filter_logs` for real changes only
- Idempotent update (no log entry if rules unchanged)

**Tasks**
- Add columns on `provider_subscriptions`: `filter_rules`, `filter_updated_at`, `filter_is_valid`
- PUT `/api/v1/provider/subscriptions/:subscriptionId/filters`
  - RBAC: provider only
  - Validate subscription ownership + not deleted
  - Validate competition level is active
  - Validate filter_rules against niche schema + dropdown_values
  - Deep-equality check vs existing rules (idempotency)
  - Update `filter_rules`, `filter_updated_at`, set `filter_is_valid=true` if valid
  - Insert log entry with old/new rules (only if changed)
- Tests: success, invalid rules, idempotent no-op, ownership blocked

---

### Story 3 — Provider View Current Filters (Summary + Validation Status)
**As a** service provider  
**I want** to view my current filters and a human-readable summary  
**So that** I understand exactly what I’m eligible for

**Acceptance Criteria**
- Provider can retrieve:
  - raw `filter_rules`
  - `filter_updated_at`
  - `filter_summary` (human-readable)
  - `filter_is_valid`
  - `validation_errors` (if invalid)
- Provider subscription list includes:
  - `has_filters`
  - `filter_summary` (truncated)
  - `filter_is_valid`

**Tasks**
- Implement helper: `generateFilterSummary(filter_rules, niche_schema, dropdown_values) -> string`
- GET `/api/v1/provider/subscriptions/:subscriptionId/filters`
- Enhance GET `/api/v1/provider/subscriptions` response with filter metadata
- Tests: summary generation, invalid filter exposure, RBAC

---

### Story 4 — Eligibility Evaluation Engine (App Layer, Defensive)
**As a** system  
**I want** deterministic eligibility evaluation in the app layer  
**So that** distribution uses a clear and testable contract

**Acceptance Criteria**
- Supports MVP operators
- Returns `{ eligible: boolean, reasons?: string[] }`
- Defensive behavior:
  - missing required field => ineligible (unless `exists`)
  - malformed filter_rules => ineligible + log error
  - type mismatch => ineligible + log warning
- Optional debug trace mode for internal troubleshooting
- Target performance: <10ms per subscription evaluation

**Tasks**
- Implement `evaluateEligibility(leadFormData, filter_rules, niche_schema, dropdown_values, options?)`
- Implement operator functions: `eq`, `neq`, `in`, `not_in`, `contains`, `gte`, `lte`, `between`, `exists`
- Add structured logging for invalid rules/type mismatches (no PII beyond lead_id/subscription_id)
- Unit test matrix:
  - all operators × types
  - missing fields
  - malformed rules
  - type mismatches
  - edge cases (null, empty strings, empty arrays)

---

### Story 5 — Compute Eligible Subscriptions for a Lead (Grouped by Level + Caching)
**As a** system  
**I want** to compute eligible subscriptions for a lead (grouped by level)  
**So that** the distribution engine can proceed fairly and efficiently

**Acceptance Criteria**
- Input: lead_id
- Output grouped structure: `{ [competition_level_id]: SubscriptionStub[] }`
- Considers only:
  - active competition levels
  - subscriptions active + not deleted
  - subscriptions with `filter_is_valid = true`
- Uses eligibility evaluator
- Caches eligible set per lead with TTL = 5 minutes
- Cache invalidation triggers:
  - lead status change
  - subscription filter update
  - subscription status change (activate/deactivate)
  - competition level activation/deactivation

**Tasks**
- Implement `getEligibleSubscriptionsByLevel(leadId) -> { [levelId]: EligibleSubscription[] }`
- Add Redis cache: `eligible_subs:${leadId}` (TTL 5m)
- Implement invalidation hooks (publish events or direct cache delete)
- Add metrics: compute time, cache hit rate
- Integration tests for correctness + caching behavior
- Performance tests: 100 subscriptions compute < 500ms

---

### Story 6 — Admin View Subscription Filters, Logs, and Stats
**As an** admin  
**I want** to view provider filters, change logs, and statistics  
**So that** I can troubleshoot matching and disputes

**Acceptance Criteria**
- Admin can view current filters for any subscription
- Admin can view filter logs (paginated) showing old/new rules and actor details
- Admin can view per-niche filter stats:
  - subscriptions with filters
  - most common fields
  - avg rule count
  - invalid filter count + list
- Read-only (except memo updates in Story 7)

**Tasks**
- GET `/api/v1/admin/subscriptions/:subscriptionId/filters`
- GET `/api/v1/admin/subscriptions/:subscriptionId/filter-logs?page=&limit=`
- GET `/api/v1/admin/niches/:nicheId/filter-stats`
- RBAC + MFA enforcement
- Indexes for log pagination performance

---

### Story 7 — Admin Notes on Filter Change Events (Memo + Search)
**As an** admin  
**I want** to attach internal notes to filter change events  
**So that** support decisions are traceable

**Acceptance Criteria**
- Admin can update `admin_only_memo` on a filter log entry
- Memo updates are audit-logged (old/new memo)
- Full-text search supported on memo content
- Memo not visible to providers

**Tasks**
- PATCH `/api/v1/admin/subscription-filter-logs/:id/memo`
- Add `memo_updated_at`, `memo_updated_by` fields
- Add full-text search index on `admin_only_memo`
- Tests: RBAC/MFA, audit logging, search

---

### Story 8 — Handle Niche Schema Changes (Filter Invalidation)
**As a** system  
**I want** to detect and handle invalid filters when niche schemas change  
**So that** distribution remains reliable

**Acceptance Criteria**
- On niche schema update:
  - revalidate filters for subscriptions in that niche
  - mark invalid filters: `filter_is_valid=false`
  - exclude invalid subscriptions from eligibility output
  - notify affected providers (email template: `filter_invalidated`)
- Admin can view invalid filter subscriptions per niche

**Tasks**
- Implement `validateSubscriptionFiltersForNiche(nicheId)`
- Update `provider_subscriptions.filter_is_valid`
- Queue provider emails via Epic 10
- GET `/api/v1/admin/niches/:nicheId/invalid-filters`
- Tests: schema change invalidates filters, eligibility excludes invalid subs

---

### Story 9 — Provider Notification on Filter Updates (Optional, MVP-Ready)
**As a** service provider  
**I want** confirmation when I update my filters  
**So that** I have a record of my changes

**Acceptance Criteria**
- After a successful filter update, provider receives `filter_updated` email (async)
- Respects user preference `notify_on_filter_update` (default true)

**Tasks**
- Add notification preference key (if not already present): `notify_on_filter_update`
- Add email template: `filter_updated`
- Hook into Story 2 update flow to queue email via Epic 10

---

## API Endpoints (MVP)

### Provider
- `PUT /api/v1/provider/subscriptions/:subscriptionId/filters`
- `GET /api/v1/provider/subscriptions/:subscriptionId/filters`

### Admin
- `GET /api/v1/admin/subscriptions/:subscriptionId/filters`
- `GET /api/v1/admin/subscriptions/:subscriptionId/filter-logs`
- `PATCH /api/v1/admin/subscription-filter-logs/:id/memo`
- `GET /api/v1/admin/niches/:nicheId/filter-stats`
- `GET /api/v1/admin/niches/:nicheId/invalid-filters`

---

## Database Schema (MVP)

```sql
-- Provider subscriptions: filter fields
ALTER TABLE provider_subscriptions
  ADD COLUMN IF NOT EXISTS filter_rules JSONB,
  ADD COLUMN IF NOT EXISTS filter_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS filter_is_valid BOOLEAN DEFAULT true;

-- Filter logs
CREATE TABLE IF NOT EXISTS subscription_filter_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES provider_subscriptions(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('admin','provider','system')),
  old_filter_rules JSONB,
  new_filter_rules JSONB,
  admin_only_memo TEXT,
  memo_updated_at TIMESTAMPTZ,
  memo_updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscription_filter_logs_subscription_created
  ON subscription_filter_logs(subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_filter_logs_actor
  ON subscription_filter_logs(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_filter_updated
  ON provider_subscriptions(filter_updated_at DESC) WHERE filter_rules IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_filter_invalid
  ON provider_subscriptions(filter_is_valid) WHERE filter_is_valid = false;

-- Optional: GIN index for JSONB (future advanced queries)
CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_filter_rules_gin
  ON provider_subscriptions USING GIN (filter_rules);

-- Full-text search on admin memos
CREATE INDEX IF NOT EXISTS idx_subscription_filter_logs_memo_fts
  ON subscription_filter_logs USING GIN (to_tsvector('english', admin_only_memo))
  WHERE admin_only_memo IS NOT NULL;
```

---

## Dependencies
- **Epic 01** — Platform Foundation (RBAC, MFA, audit logging)
- **Epic 02** — Niche form schemas on `niches.form_schema` (and schema update triggers)
- **Epic 04** — Competition Levels & Subscriptions (subscription structures and statuses)
- **Epic 10** — Email Infrastructure (filter_updated / filter_invalidated notifications)
- **Epic 12** — Observability & Ops (metrics, logs, caching visibility)

---

## Definition of Done
- Providers can set and view filters per subscription with strict validation
- Field type → operator mapping enforced
- Eligibility evaluator deterministic + defensive (fail-safe) and fully unit-tested
- Eligible subscription set computed per lead and grouped by level, with caching + invalidation
- Filter changes logged with old/new rules + actor identity
- Admin can view filters, logs, stats, and invalid filter lists
- Invalid filters excluded from distribution and providers notified
- RBAC enforced for provider/admin routes; MFA enforced for admin routes
- Tests:
  - Unit: validation helper, evaluator operator matrix, summary generation, edge cases
  - Integration: filter update → log → notification; schema change → invalidation
  - API: success/error cases, RBAC/MFA, pagination, memo search
  - Performance: eligible computation < 500ms for 100 subscriptions; evaluator < 10ms/sub
