# EPIC 05 - Filters & Eligibility: Implementation Plan

**Epic:** EPIC 05 - Filters & Eligibility  
**Status:** 🔄 Planning  
**Created:** Jan 4, 2026  
**Estimated Effort:** 3-4 days

---

## Pre-Implementation Checklist

### ✅ Dependencies Verified
- [x] **EPIC 01** - Platform Foundation (RBAC, MFA, audit logging) ✅
- [x] **EPIC 02** - Lead Intake (niche form schemas) ✅
- [x] **EPIC 04** - Competition Levels & Subscriptions ✅
- [x] **EPIC 10** - Email Infrastructure ✅
- [ ] **EPIC 12** - Observability (optional - can proceed without)

### ✅ Deferred Items Reviewed
- [x] Checked `DEFERRED_ITEMS_SUMMARY.md` - **No deferred items for EPIC 05**
- [x] Checked EPIC 05 specification - No ⚠️ section

### ✅ Pre-requisites Confirmed
- [x] `competition_level_subscriptions` table exists (EPIC 04)
- [x] `niches.form_schema` JSONB column exists (EPIC 02)
- [x] Email infrastructure available (EPIC 10)
- [x] Admin MFA middleware available (EPIC 01)
- [x] Audit logging available (EPIC 01)

---

## Overview

This epic implements the **eligibility gate** for lead distribution:
1. Providers define filters per subscription (which leads they want)
2. System evaluates lead data against filters to determine eligibility
3. Distribution engine (EPIC 06) receives eligible subscriptions grouped by level

### Key Components
- **Filter Schema & Validation** - TypeScript types, Zod schemas, field-type-operator mapping
- **Provider Filter API** - Set/view filters per subscription
- **Eligibility Engine** - Evaluate lead data against filter rules
- **Eligible Subscriptions Service** - Compute eligible subs grouped by level, with caching
- **Admin Tools** - View filters, logs, stats, manage invalid filters
- **Schema Change Handler** - Invalidate filters when niche schema changes

---

## Architecture Notes

### Table Clarification
The spec mentions `provider_subscriptions` but the actual table for per-niche subscriptions is `competition_level_subscriptions` (created in EPIC 04). This is where filter columns will be added:
- `competition_level_subscriptions.filter_rules` - JSONB
- `competition_level_subscriptions.filter_updated_at` - TIMESTAMPTZ
- `competition_level_subscriptions.filter_is_valid` - BOOLEAN

### Operator Support (MVP)
| Operator | Meaning | Value Shape |
|----------|---------|-------------|
| `eq` | equals | scalar |
| `neq` | not equals | scalar |
| `in` | in set | array |
| `not_in` | not in set | array |
| `contains` | contains substring/element | scalar |
| `gte` | >= | number |
| `lte` | <= | number |
| `between` | between inclusive | [min, max] |
| `exists` | field exists and not empty | boolean |

### Field Type → Allowed Operators
| Field Type | Allowed Operators |
|------------|-------------------|
| `select` | `eq`, `neq`, `in`, `not_in`, `exists` |
| `multi-select` | `in`, `not_in`, `contains`, `exists` |
| `text` | `eq`, `neq`, `contains`, `exists` |
| `number` | `eq`, `neq`, `gte`, `lte`, `between`, `exists` |
| `boolean` | `eq`, `exists` |
| `radio` | `eq`, `neq`, `exists` |

---

## Implementation Phases

### Phase 1: Database Schema ⬜
**Effort:** 30 minutes  
**Stories:** Prerequisite for all

**Tasks:**
1. Add filter columns to `competition_level_subscriptions`:
   - `filter_rules JSONB`
   - `filter_updated_at TIMESTAMPTZ`
   - `filter_is_valid BOOLEAN DEFAULT true`

2. Create `subscription_filter_logs` table:
   - `id`, `subscription_id`, `actor_id`, `actor_role`
   - `old_filter_rules`, `new_filter_rules`
   - `admin_only_memo`, `memo_updated_at`, `memo_updated_by`
   - `created_at`

3. Create indexes:
   - `idx_subscription_filter_logs_subscription_created`
   - `idx_subscription_filter_logs_actor`
   - `idx_cls_filter_updated` (on competition_level_subscriptions)
   - `idx_cls_filter_invalid` (partial index for invalid filters)
   - `idx_subscription_filter_logs_memo_fts` (full-text search)

4. Update `packages/database/schema.sql`
5. Update `packages/database/migrate.ts` with `ensureEpic05Schema()`

**Files:**
- `packages/database/schema.sql`
- `packages/database/migrate.ts`

**Verification:**
```sql
\d competition_level_subscriptions -- shows new columns
\d subscription_filter_logs -- table exists
\di idx_subscription_filter_logs_* -- indexes exist
```

---

### Phase 2: TypeScript Types & Validation Schemas ⬜
**Effort:** 1 hour  
**Stories:** Story 1

**Tasks:**
1. Create filter types in `apps/web/lib/types/filter.ts`:
   - `FilterOperator` enum
   - `FilterRule` interface
   - `FilterRules` interface (versioned)
   - `FieldTypeOperatorMap` constant
   - `NicheFormField` interface

2. Create Zod schemas in `apps/web/lib/validations/filter.ts`:
   - `filterRuleSchema`
   - `filterRulesSchema`
   - `updateFilterSchema`

3. Create validation helper `apps/web/lib/filter/validator.ts`:
   - `validateFilterRules(filterRules, nicheSchema, dropdownValues)`
   - Field type → operator validation
   - Value shape validation
   - Select/radio option validation
   - Returns `{ valid: boolean, errors: FilterValidationError[] }`

**Files:**
- `apps/web/lib/types/filter.ts` (new)
- `apps/web/lib/validations/filter.ts` (new)
- `apps/web/lib/filter/validator.ts` (new)

**Tests:**
- All field types × operators (valid + invalid)
- Invalid values for select/radio
- Invalid shapes for `in`, `between`, etc.
- Missing fields, null values

---

### Phase 3: Eligibility Engine ⬜
**Effort:** 2 hours  
**Stories:** Story 4

**Tasks:**
1. Create `apps/web/lib/filter/evaluator.ts`:
   - `evaluateEligibility(leadFormData, filterRules, nicheSchema, options?)`
   - Returns `{ eligible: boolean, reasons?: string[] }`

2. Implement operator functions:
   - `evaluateEq(fieldValue, ruleValue)`
   - `evaluateNeq(fieldValue, ruleValue)`
   - `evaluateIn(fieldValue, ruleValue)`
   - `evaluateNotIn(fieldValue, ruleValue)`
   - `evaluateContains(fieldValue, ruleValue)`
   - `evaluateGte(fieldValue, ruleValue)`
   - `evaluateLte(fieldValue, ruleValue)`
   - `evaluateBetween(fieldValue, ruleValue)`
   - `evaluateExists(fieldValue, ruleValue)`

3. Implement defensive behavior:
   - Missing required field → ineligible
   - Malformed filter_rules → ineligible + log error
   - Type mismatch → ineligible + log warning

4. Add debug trace mode for troubleshooting

**Files:**
- `apps/web/lib/filter/evaluator.ts` (new)
- `apps/web/lib/filter/operators.ts` (new - optional split)

**Tests:**
- All operators × field types
- Missing fields
- Malformed rules
- Type mismatches
- Edge cases (null, empty strings, empty arrays)
- Performance: <10ms per subscription

---

### Phase 4: Provider Filter APIs ⬜
**Effort:** 1.5 hours  
**Stories:** Story 2, Story 3

**Tasks:**
1. Create `PUT /api/v1/provider/subscriptions/:subscriptionId/filters`:
   - RBAC: Provider only
   - Validate subscription ownership
   - Validate filter_rules against niche schema
   - Deep-equality check (idempotency)
   - Update filter_rules, filter_updated_at, filter_is_valid
   - Insert log entry (only if changed)

2. Create `GET /api/v1/provider/subscriptions/:subscriptionId/filters`:
   - Return raw filter_rules
   - Return filter_updated_at
   - Return filter_summary (human-readable)
   - Return filter_is_valid
   - Return validation_errors (if invalid)

3. Create filter summary helper:
   - `generateFilterSummary(filterRules, nicheSchema)`
   - Human-readable description of rules

4. Update existing `GET /api/v1/provider/subscriptions`:
   - Add has_filters, filter_summary (truncated), filter_is_valid

**Files:**
- `apps/web/app/api/v1/provider/subscriptions/[subscriptionId]/filters/route.ts` (new)
- `apps/web/lib/filter/summary.ts` (new)
- `apps/web/app/api/v1/provider/subscriptions/route.ts` (update)

**Tests:**
- Success cases
- Invalid rules rejected
- Idempotent no-op
- Ownership blocked
- RBAC enforcement

---

### Phase 5: Audit Actions & Logging ⬜
**Effort:** 30 minutes  
**Stories:** Story 2, Story 7

**Tasks:**
1. Add audit actions to `apps/web/lib/services/audit-logger.ts`:
   - `FILTER_UPDATED` - Provider updated filters
   - `FILTER_INVALIDATED` - Schema change invalidated filters
   - `FILTER_MEMO_UPDATED` - Admin updated memo

2. Create filter log service `apps/web/lib/services/filter-log.ts`:
   - `logFilterChange(subscriptionId, actorId, actorRole, oldRules, newRules)`
   - `updateFilterMemo(logId, adminId, memo)`

**Files:**
- `apps/web/lib/services/audit-logger.ts` (update)
- `apps/web/lib/services/filter-log.ts` (new)

---

### Phase 6: Eligible Subscriptions Service ⬜
**Effort:** 2 hours  
**Stories:** Story 5

**Tasks:**
1. Create `apps/web/lib/services/eligibility.ts`:
   - `getEligibleSubscriptionsByLevel(leadId)`
   - Returns `{ [competitionLevelId]: EligibleSubscription[] }`

2. Query logic:
   - Only active competition levels
   - Only active subscriptions (not deleted)
   - Only subscriptions with filter_is_valid = true
   - Apply eligibility evaluator

3. Implement Redis caching:
   - Key: `eligible_subs:${leadId}`
   - TTL: 5 minutes
   - Invalidation hooks

4. Implement cache invalidation triggers:
   - Lead status change
   - Subscription filter update
   - Subscription status change
   - Competition level activation/deactivation

5. Add metrics:
   - Compute time
   - Cache hit rate

**Files:**
- `apps/web/lib/services/eligibility.ts` (new)

**Tests:**
- Correctness of grouping
- Caching behavior
- Invalidation triggers
- Performance: <500ms for 100 subscriptions

---

### Phase 7: Admin Filter APIs ⬜
**Effort:** 1.5 hours  
**Stories:** Story 6, Story 7

**Tasks:**
1. Create `GET /api/v1/admin/subscriptions/:subscriptionId/filters`:
   - View current filters for any subscription
   - Include filter_rules, summary, validation status
   - RBAC + MFA

2. Create `GET /api/v1/admin/subscriptions/:subscriptionId/filter-logs`:
   - Paginated filter change history
   - Include actor details, old/new rules
   - RBAC + MFA

3. Create `PATCH /api/v1/admin/subscription-filter-logs/:id/memo`:
   - Update admin_only_memo
   - Audit log the change
   - RBAC + MFA

4. Create `GET /api/v1/admin/niches/:nicheId/filter-stats`:
   - Subscriptions with filters count
   - Most common fields
   - Average rule count
   - Invalid filter count
   - RBAC + MFA

5. Create `GET /api/v1/admin/niches/:nicheId/invalid-filters`:
   - List subscriptions with invalid filters
   - Include provider info, subscription details
   - RBAC + MFA

**Files:**
- `apps/web/app/api/v1/admin/subscriptions/[subscriptionId]/filters/route.ts` (new)
- `apps/web/app/api/v1/admin/subscriptions/[subscriptionId]/filter-logs/route.ts` (new)
- `apps/web/app/api/v1/admin/subscription-filter-logs/[id]/memo/route.ts` (new)
- `apps/web/app/api/v1/admin/niches/[nicheId]/filter-stats/route.ts` (new)
- `apps/web/app/api/v1/admin/niches/[nicheId]/invalid-filters/route.ts` (new)

---

### Phase 8: Schema Change Handler ⬜
**Effort:** 1 hour  
**Stories:** Story 8

**Tasks:**
1. Create `apps/web/lib/services/filter-invalidation.ts`:
   - `validateSubscriptionFiltersForNiche(nicheId)`
   - Revalidate all filters for subscriptions in the niche
   - Mark invalid filters: `filter_is_valid = false`

2. Hook into niche schema update flow:
   - After niche form_schema is updated
   - Call `validateSubscriptionFiltersForNiche`

3. Queue provider notifications:
   - Use `filter_invalidated` email template
   - Via EPIC 10 email service

4. Update eligibility service:
   - Exclude invalid subscriptions from output

**Files:**
- `apps/web/lib/services/filter-invalidation.ts` (new)

**Tests:**
- Schema change invalidates filters
- Eligibility excludes invalid subs
- Providers notified

---

### Phase 9: Email Templates ⬜
**Effort:** 30 minutes  
**Stories:** Story 8, Story 9

**Tasks:**
1. Add email templates to `packages/email/templates/defaults.ts`:
   - `filter_updated` - Confirmation when provider updates filters
   - `filter_invalidated` - Notification when schema change invalidates filters

2. Update `packages/email/types.ts`:
   - Add template keys

3. Add notification preference (optional):
   - `notify_on_filter_update` (default true)

**Files:**
- `packages/email/templates/defaults.ts` (update)
- `packages/email/types.ts` (update)

---

### Phase 10: Integration & Testing ⬜
**Effort:** 2 hours  
**Stories:** All

**Tasks:**
1. Create comprehensive test script `test-epic05.sh`:
   - Database schema verification
   - API endpoint testing
   - Filter validation testing
   - Eligibility evaluation testing
   - Caching behavior testing

2. Unit tests:
   - Filter validation helper
   - Eligibility evaluator (operator matrix)
   - Summary generation
   - Edge cases

3. Integration tests:
   - Filter update → log → notification flow
   - Schema change → invalidation flow
   - Eligibility computation with multiple subscriptions

4. Performance tests:
   - Eligible computation <500ms for 100 subscriptions
   - Evaluator <10ms per subscription

5. Update `packages/database/seed.ts`:
   - Add sample filters for test subscriptions

**Files:**
- `test-epic05.sh` (new)
- `packages/database/seed.ts` (update)

---

### Phase 11: Documentation & Review ⬜
**Effort:** 1 hour  
**Stories:** All

**Tasks:**
1. Update `README.md`:
   - Document filter system
   - Add API endpoints

2. Update `DEVELOPMENT_GUIDE.md`:
   - Update epic status

3. Create `EPIC_05_REVIEW.md`:
   - Implementation summary
   - Findings and recommendations

4. Update `EPIC_EXECUTION_PLAN.md`:
   - Mark EPIC 05 complete
   - Update next epic recommendation

5. Check for deferred items:
   - Document any P2/P3 items
   - Add to target epics

**Files:**
- `README.md` (update)
- `.cursor/docs/DEVELOPMENT_GUIDE.md` (update)
- `.cursor/docs/Delivery/EPIC_05_REVIEW.md` (new)
- `.cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md` (update)

---

## API Endpoints Summary

### Provider Endpoints (2)
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/v1/provider/subscriptions/:subscriptionId/filters` | Set/update filters |
| GET | `/api/v1/provider/subscriptions/:subscriptionId/filters` | View current filters |

### Admin Endpoints (5)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/subscriptions/:subscriptionId/filters` | View subscription filters |
| GET | `/api/v1/admin/subscriptions/:subscriptionId/filter-logs` | View filter change logs |
| PATCH | `/api/v1/admin/subscription-filter-logs/:id/memo` | Update admin memo |
| GET | `/api/v1/admin/niches/:nicheId/filter-stats` | View filter statistics |
| GET | `/api/v1/admin/niches/:nicheId/invalid-filters` | View invalid filters |

---

## New Files Summary

### Types & Validation (3)
- `apps/web/lib/types/filter.ts`
- `apps/web/lib/validations/filter.ts`
- `apps/web/lib/filter/validator.ts`

### Services (5)
- `apps/web/lib/filter/evaluator.ts`
- `apps/web/lib/filter/summary.ts`
- `apps/web/lib/services/filter-log.ts`
- `apps/web/lib/services/eligibility.ts`
- `apps/web/lib/services/filter-invalidation.ts`

### API Routes (7)
- `apps/web/app/api/v1/provider/subscriptions/[subscriptionId]/filters/route.ts`
- `apps/web/app/api/v1/admin/subscriptions/[subscriptionId]/filters/route.ts`
- `apps/web/app/api/v1/admin/subscriptions/[subscriptionId]/filter-logs/route.ts`
- `apps/web/app/api/v1/admin/subscription-filter-logs/[id]/memo/route.ts`
- `apps/web/app/api/v1/admin/niches/[nicheId]/filter-stats/route.ts`
- `apps/web/app/api/v1/admin/niches/[nicheId]/invalid-filters/route.ts`

---

## Risk Assessment

### Technical Risks
1. **Complex validation logic** - Many operator × field type combinations
   - Mitigation: Comprehensive test matrix

2. **Performance with many subscriptions** - Eligibility computation at scale
   - Mitigation: Redis caching, performance testing

3. **Cache invalidation edge cases** - Stale eligibility data
   - Mitigation: Clear invalidation triggers, short TTL

### Business Risks
1. **Invalid filters blocking leads** - Providers miss leads
   - Mitigation: Fail-safe to ineligible + notification

2. **Schema changes breaking existing filters** - Provider confusion
   - Mitigation: Clear email notification, admin visibility

---

## Definition of Done

- [ ] Providers can set and view filters per subscription with strict validation
- [ ] Field type → operator mapping enforced
- [ ] Eligibility evaluator deterministic + defensive (fail-safe)
- [ ] Eligible subscription set computed per lead, grouped by level, with caching
- [ ] Filter changes logged with old/new rules + actor identity
- [ ] Admin can view filters, logs, stats, and invalid filter lists
- [ ] Invalid filters excluded from distribution and providers notified
- [ ] RBAC enforced for provider/admin routes; MFA enforced for admin routes
- [ ] All tests passing (unit, integration, performance)
- [ ] Documentation updated

---

## Phase Tracking

| Phase | Description | Status | Started | Completed |
|-------|-------------|--------|---------|-----------|
| 1 | Database Schema | ⬜ | | |
| 2 | TypeScript Types & Validation | ⬜ | | |
| 3 | Eligibility Engine | ⬜ | | |
| 4 | Provider Filter APIs | ⬜ | | |
| 5 | Audit Actions & Logging | ⬜ | | |
| 6 | Eligible Subscriptions Service | ⬜ | | |
| 7 | Admin Filter APIs | ⬜ | | |
| 8 | Schema Change Handler | ⬜ | | |
| 9 | Email Templates | ⬜ | | |
| 10 | Integration & Testing | ⬜ | | |
| 11 | Documentation & Review | ⬜ | | |

---

## Estimated Total Effort

| Category | Effort |
|----------|--------|
| Database Schema | 0.5 hours |
| Types & Validation | 1 hour |
| Eligibility Engine | 2 hours |
| Provider APIs | 1.5 hours |
| Audit & Logging | 0.5 hours |
| Eligibility Service | 2 hours |
| Admin APIs | 1.5 hours |
| Schema Handler | 1 hour |
| Email Templates | 0.5 hours |
| Testing | 2 hours |
| Documentation | 1 hour |
| **Total** | **~13.5 hours (2-3 days)** |

---

## Next Steps

1. ✅ Implementation plan created
2. ⬜ Get approval to proceed
3. ⬜ Start Phase 1: Database Schema

