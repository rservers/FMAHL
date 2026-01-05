# EPIC 11 - Reporting & Analytics Implementation Plan

**Epic:** Reporting & Analytics  
**Created:** Jan 4, 2026  
**Target:** MVP Operations - Platform Visibility & Insights  
**Dependencies:** EPIC 01 ✅, EPIC 02 ✅, EPIC 03 ✅, EPIC 04 ✅, EPIC 05 ✅, EPIC 06 ✅, EPIC 07 ✅, EPIC 09 ✅  
**Status:** Planning  
**Estimated Effort:** 18-22 hours (~3 days)

---

## Pre-Implementation Checklist

### ✅ Deferred Items Review
- [x] Checked `DEFERRED_ITEMS_SUMMARY.md` - Found **8 P3 items** assigned to EPIC 11
- [x] Items to incorporate:
  1. **From EPIC 03:** Caching for Stats Endpoint (P3, 2h)
  2. **From EPIC 03:** Advanced Lead Filtering (P3, 4h)
  3. **From EPIC 03:** CSV Export of Leads (P3, 3h)
  4. **From EPIC 04:** Redis Caching for Competition Levels (P3, 4h)
  5. **From EPIC 06:** Distribution Analytics Dashboard (P3, 4h)
  6. **From EPIC 06:** Distribution Metrics Export (P3, 2h)
  7. **From EPIC 08:** Provider Lead Analytics (P3, 4h)
  8. **From EPIC 08:** Lead Search Enhancement (P3, 2h)

**Strategy:** Incorporate deferred items into EPIC 11 phases where they naturally fit. Some overlap with story requirements.

### ✅ Dependencies Verified
| Epic | Dependency | Status | Component |
|------|------------|--------|-----------|
| 01 | Auth/RBAC | ✅ | Admin MFA, provider auth, audit logging |
| 02 | Lead Intake | ✅ | leads table (submitted_at, confirmed_at) |
| 03 | Admin Review | ✅ | leads table (approved_at, rejected_at, rejection_reason) |
| 04 | Competition Levels | ✅ | competition_levels, subscriptions |
| 05 | Filters | ✅ | provider_filters, eligibility checks |
| 06 | Distribution | ✅ | lead_assignments, distributed_at, fairness fields |
| 07 | Billing | ✅ | provider_ledger, payments, balance |
| 09 | Bad Lead/Refunds | ✅ | bad_lead_*, refund_amount |

### ✅ Existing Infrastructure Verified
- `leads` table - ✅ All lifecycle fields
- `lead_assignments` table - ✅ All assignment fields
- `provider_ledger` table - ✅ All ledger entry types
- `payments` table - ✅ Payment status tracking
- `audit_log` table - ✅ All actions logged
- Redis - ✅ Available for caching
- BullMQ - ✅ Available for async exports

---

## Implementation Phases

### Phase 1: Database Schema & Types
**Effort:** 1 hour  
**Files:**
- `packages/database/schema.sql`
- `packages/database/migrate.ts`
- `apps/web/lib/types/reports.ts` (new)
- `apps/web/lib/validations/reports.ts` (new)

**Tasks:**
1. Create `report_export_jobs` table for async exports
2. Add indexes for report queries
3. Create TypeScript types for all report responses
4. Create Zod validation schemas for all report queries

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS report_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID REFERENCES users(id),
  actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('admin','provider')),
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('admin','provider')),
  type VARCHAR(50) NOT NULL,
  filters JSONB,
  format VARCHAR(10) NOT NULL DEFAULT 'csv',
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending','processing','completed','failed')),
  row_count INTEGER,
  artifact_path TEXT,
  download_expires_at TIMESTAMPTZ,
  file_expires_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_exports_requested_by_created
  ON report_export_jobs(requested_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_exports_status_created
  ON report_export_jobs(status, created_at DESC);
```

**Acceptance Criteria:**
- [ ] Migration runs successfully
- [ ] Types compile without errors
- [ ] Validation schemas cover all endpoints

---

### Phase 2: Caching Infrastructure
**Effort:** 1.5 hours  
**Files:**
- `apps/web/lib/services/report-cache.ts` (new)
- `apps/web/lib/config/report-config.ts` (new)

**Tasks:**
1. Create cache service wrapper for reports
2. Implement cache key generation with filters
3. Add TTL-based caching (5 minutes default)
4. Add cache bypass for admins (`?no_cache=true`)
5. Implement cache invalidation hooks (optional, documented)

**Cache Key Convention:**
```
reports:{scope}:{type}:{from}:{to}:{filters_hash}
```

**Deferred Items Addressed:**
- ✅ EPIC 03: Caching for Stats Endpoint
- ✅ EPIC 04: Redis Caching for Competition Levels (partially)

**Acceptance Criteria:**
- [ ] Cache wrapper works with Redis
- [ ] TTL-based expiration working
- [ ] Cache bypass works for admins

---

### Phase 3: Admin Platform KPI Dashboard API
**Effort:** 2 hours  
**Files:**
- `apps/web/app/api/v1/admin/reports/kpis/route.ts` (new)

**Endpoint:** `GET /api/v1/admin/reports/kpis?date_from=&date_to=`

**KPIs:**
- total_leads_submitted
- total_leads_confirmed
- total_leads_approved
- total_leads_rejected
- total_leads_distributed
- confirmation_rate (confirmed/submitted)
- approval_rate (approved/confirmed)
- distribution_rate (distributed/approved)
- avg_time_to_confirmation_minutes
- avg_time_to_approval_hours
- avg_time_to_distribution_minutes
- total_revenue (lead_purchase debits)
- total_refunds (refund credits)
- net_revenue (revenue - refunds)
- bad_lead_report_rate
- bad_lead_approval_rate
- top_rejection_reasons (array)

**Tasks:**
1. Implement KPI aggregation queries
2. Add Redis caching (TTL 5 minutes)
3. Add RBAC + MFA guard
4. Add validation for date_from/date_to
5. Handle empty data gracefully

**Acceptance Criteria:**
- [ ] All KPIs calculated correctly
- [ ] Cached with 5-minute TTL
- [ ] Requires admin + MFA

---

### Phase 4: Funnel Analytics API
**Effort:** 1.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/reports/funnel/route.ts` (new)

**Endpoint:** `GET /api/v1/admin/reports/funnel?date_from=&date_to=&bucket=day|hour&niche_id=`

**Response:**
- Time series aggregated by day (default) or hour
- Stages: submitted, confirmed, approved, distributed
- Optional niche filter for single-niche vs platform-wide

**Tasks:**
1. Implement time-series aggregation query
2. Support bucket parameter (day/hour)
3. Support optional niche filter
4. Add caching
5. Add tests for date bucketing

**Acceptance Criteria:**
- [ ] Time series returned correctly
- [ ] Bucketing works for day and hour
- [ ] Niche filter works

---

### Phase 5: Revenue & Deposits API
**Effort:** 1.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/reports/revenue/route.ts` (new)

**Endpoint:** `GET /api/v1/admin/reports/revenue?date_from=&date_to=`

**Response:**
- total_deposits
- total_lead_purchases
- total_refunds
- net_revenue
- payment_status_breakdown
- provider_topups_count

**Tasks:**
1. Aggregate provider_ledger by entry_type
2. Aggregate payments by status
3. Add caching
4. Add tests

**Acceptance Criteria:**
- [ ] All revenue metrics calculated correctly
- [ ] Payment breakdown matches payments table
- [ ] Cached with 5-minute TTL

---

### Phase 6: Fairness & Starvation Monitoring API
**Effort:** 1.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/reports/fairness/starvation/route.ts` (new)

**Endpoint:** `GET /api/v1/admin/reports/fairness/starvation?niche_id=&competition_level_id=`

**Response:**
- Subscriptions/providers with no leads since threshold
- Configurable threshold: `STARVATION_THRESHOLD_DAYS` (default 7)

**Tasks:**
1. Read config `STARVATION_THRESHOLD_DAYS`
2. Query subscriptions with last_received_at older than threshold
3. Support niche and competition level filters
4. Add caching

**Deferred Items Addressed:**
- ✅ EPIC 06: Distribution Analytics Dashboard (partially - fairness portion)

**Acceptance Criteria:**
- [ ] Threshold configurable via env
- [ ] NULL handling for last_received_at
- [ ] Filters work correctly

---

### Phase 7: Flagged Provider Metrics API
**Effort:** 1 hour  
**Files:**
- `apps/web/app/api/v1/admin/reports/providers/flags/route.ts` (new)

**Endpoint:** `GET /api/v1/admin/reports/providers/flags?date_from=&date_to=&provider_id=`

**Response:**
- Providers with abnormal bad-lead/refund behavior
- Thresholds configurable:
  - `BAD_LEAD_APPROVAL_RATE_THRESHOLD` (default 0.50)
  - `BAD_LEAD_REFUND_RATE_THRESHOLD` (default 0.20)

**Note:** This overlaps with EPIC 09's `/admin/bad-leads/metrics` endpoint. This endpoint focuses on flagging logic specifically.

**Tasks:**
1. Read thresholds from config
2. Compute provider metrics
3. Flag providers above thresholds
4. Add caching

**Acceptance Criteria:**
- [ ] Thresholds configurable
- [ ] Flagging logic correct
- [ ] Returns provider details

---

### Phase 8: Provider KPI Dashboard API
**Effort:** 1.5 hours  
**Files:**
- `apps/web/app/api/v1/provider/reports/kpis/route.ts` (new)

**Endpoint:** `GET /api/v1/provider/reports/kpis?date_from=&date_to=&group_by=niche|none`

**Response:**
- assignments_received
- acceptance_rate
- rejection_rate
- avg_time_to_view
- avg_time_to_accept
- bad_lead_reports_count
- bad_lead_approved_count
- refunds_amount
- net_spend (lead purchases - refunds)

**Optional:** `group_by=niche` returns KPIs per niche

**Deferred Items Addressed:**
- ✅ EPIC 08: Provider Lead Analytics

**Tasks:**
1. Aggregate lead_assignments for provider
2. Support niche grouping
3. Add authorization (provider can only see own data)
4. Add caching

**Acceptance Criteria:**
- [ ] All KPIs calculated correctly
- [ ] Niche grouping works
- [ ] Authorization enforced

---

### Phase 9: Admin Bad Lead Metrics API
**Effort:** 0.5 hours  
**Files:**
- Update `apps/web/app/api/v1/admin/bad-leads/metrics/route.ts` (if needed)

**Note:** This was implemented in EPIC 09. Verify it meets EPIC 11 requirements.

**Verification:**
- Returns all required fields
- Supports date_from/date_to
- Includes by_niche breakdown
- Cached with 5-minute TTL

**Tasks:**
1. Verify existing endpoint meets requirements
2. Add by_niche breakdown if missing
3. Ensure cache key includes all filters

**Acceptance Criteria:**
- [ ] Endpoint meets Story 9 requirements
- [ ] by_niche breakdown included

---

### Phase 10: Export Jobs Infrastructure
**Effort:** 2.5 hours  
**Files:**
- `apps/web/app/api/v1/reports/exports/route.ts` (new)
- `apps/web/app/api/v1/reports/exports/[jobId]/status/route.ts` (new)
- `apps/web/app/api/v1/reports/exports/[jobId]/download/route.ts` (new)
- `apps/worker/src/processors/report-export.ts` (new)
- `apps/worker/src/jobs/export-cleanup.ts` (new)

**Endpoints:**
- `POST /api/v1/reports/exports` - Request export
- `GET /api/v1/reports/exports/:jobId/status` - Check status
- `GET /api/v1/reports/exports/:jobId/download` - Download file

**Tasks:**
1. Create export request endpoint
2. Create BullMQ export processor
3. Implement CSV generation
4. Store artifacts in local filesystem (S3 for production)
5. Generate signed download URLs (1 hour TTL)
6. Implement file cleanup job (24 hour retention)
7. Add provider daily limit (5 exports/day)
8. Add row limit check (5000 max)
9. Add audit logging

**Export Types:**
- Admin: funnel, kpis, revenue, fairness, bad_leads
- Provider: assigned_leads

**Deferred Items Addressed:**
- ✅ EPIC 03: CSV Export of Leads
- ✅ EPIC 06: Distribution Metrics Export

**Acceptance Criteria:**
- [ ] Async export works via BullMQ
- [ ] Provider daily limit enforced
- [ ] Row limit enforced
- [ ] Files expire after 24 hours
- [ ] Download URL expires after 1 hour
- [ ] 410 Gone returned for expired exports

---

### Phase 11: Audit Actions & Rate Limiting
**Effort:** 0.5 hours  
**Files:**
- `apps/web/lib/services/audit-logger.ts`
- `apps/web/lib/middleware/rate-limit.ts`

**Audit Actions:**
- `REPORT_ACCESSED` - Admin accesses sensitive report
- `REPORT_EXPORT_REQUESTED` - Export job created
- `REPORT_EXPORT_COMPLETED` - Export job finished
- `REPORT_EXPORT_FAILED` - Export job failed
- `REPORT_EXPORT_DOWNLOADED` - File downloaded (optional)

**Rate Limiting:**
- `REPORT_EXPORT_PROVIDER` - 5/day for provider exports

**Tasks:**
1. Add audit actions
2. Add rate limit config
3. Implement in export endpoints

**Acceptance Criteria:**
- [ ] All export actions logged
- [ ] Provider export rate limited

---

### Phase 12: Advanced Lead Filtering (Admin)
**Effort:** 1.5 hours  
**Files:**
- `apps/web/lib/validations/lead.ts` (update)
- `apps/web/app/api/v1/admin/leads/queue/route.ts` (update)

**New Filters:**
- Date range (created_at, confirmed_at, approved_at)
- Search by email (contact_email, submitter_email)
- Filter by admin (approved_by_admin_id)
- Multi-niche filter
- Sort by multiple columns

**Deferred Items Addressed:**
- ✅ EPIC 03: Advanced Lead Filtering

**Tasks:**
1. Extend validation schema
2. Update queue API with new filters
3. Add database indexes if needed
4. Add tests

**Acceptance Criteria:**
- [ ] All new filters work
- [ ] Existing filters still work
- [ ] Performance acceptable

---

### Phase 13: Lead Search Enhancement (Provider)
**Effort:** 1 hour  
**Files:**
- `apps/web/app/api/v1/provider/leads/route.ts` (update)

**Enhancements:**
- Full-text search on lead form_data (if applicable)
- Search by lead attributes

**Deferred Items Addressed:**
- ✅ EPIC 08: Lead Search Enhancement

**Tasks:**
1. Add enhanced search parameters
2. Implement search logic
3. Add tests

**Acceptance Criteria:**
- [ ] Enhanced search works
- [ ] Performance acceptable

---

### Phase 14: Integration Testing
**Effort:** 2 hours  
**Files:**
- `test-epic11.sh` (new)

**Tests:**
1. Admin KPI dashboard
2. Funnel analytics
3. Revenue summary
4. Starvation monitoring
5. Flagged providers
6. Provider KPIs
7. Export job lifecycle
8. Caching behavior
9. Authorization checks
10. Rate limiting

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] TypeScript compiles
- [ ] No regressions

---

### Phase 15: Documentation & Review
**Effort:** 1 hour  
**Files:**
- `README.md` (update)
- `.cursor/docs/DEVELOPMENT_GUIDE.md` (update)
- `.cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md` (update)
- `.cursor/docs/Delivery/DEFERRED_ITEMS_SUMMARY.md` (update - mark items complete)

**Tasks:**
1. Update README with new endpoints
2. Update development guide
3. Update execution plan status
4. Mark deferred items as complete
5. Document KPI definitions
6. Create code review document

**Acceptance Criteria:**
- [ ] All documentation updated
- [ ] Deferred items marked complete
- [ ] Code review complete

---

## Summary

### Total Effort Estimate
| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Database Schema & Types | 1.0h |
| 2 | Caching Infrastructure | 1.5h |
| 3 | Admin KPI Dashboard API | 2.0h |
| 4 | Funnel Analytics API | 1.5h |
| 5 | Revenue & Deposits API | 1.5h |
| 6 | Fairness & Starvation API | 1.5h |
| 7 | Flagged Provider Metrics API | 1.0h |
| 8 | Provider KPI Dashboard API | 1.5h |
| 9 | Admin Bad Lead Metrics (verify) | 0.5h |
| 10 | Export Jobs Infrastructure | 2.5h |
| 11 | Audit Actions & Rate Limiting | 0.5h |
| 12 | Advanced Lead Filtering | 1.5h |
| 13 | Lead Search Enhancement | 1.0h |
| 14 | Integration Testing | 2.0h |
| 15 | Documentation & Review | 1.0h |
| **Total** | | **20.0h** |

### API Endpoints
| Endpoint | Method | Auth | Phase |
|----------|--------|------|-------|
| `/api/v1/admin/reports/kpis` | GET | Admin+MFA | 3 |
| `/api/v1/admin/reports/funnel` | GET | Admin+MFA | 4 |
| `/api/v1/admin/reports/revenue` | GET | Admin+MFA | 5 |
| `/api/v1/admin/reports/fairness/starvation` | GET | Admin+MFA | 6 |
| `/api/v1/admin/reports/providers/flags` | GET | Admin+MFA | 7 |
| `/api/v1/provider/reports/kpis` | GET | Provider | 8 |
| `/api/v1/reports/exports` | POST | Admin+MFA/Provider | 10 |
| `/api/v1/reports/exports/:id/status` | GET | Owner | 10 |
| `/api/v1/reports/exports/:id/download` | GET | Owner | 10 |

**Total New Endpoints:** 9

### Deferred Items to Complete
| Source | Item | Phase |
|--------|------|-------|
| EPIC 03 | Caching for Stats Endpoint | 2 |
| EPIC 03 | Advanced Lead Filtering | 12 |
| EPIC 03 | CSV Export of Leads | 10 |
| EPIC 04 | Redis Caching for Competition Levels | 2 |
| EPIC 06 | Distribution Analytics Dashboard | 6, 7 |
| EPIC 06 | Distribution Metrics Export | 10 |
| EPIC 08 | Provider Lead Analytics | 8 |
| EPIC 08 | Lead Search Enhancement | 13 |

### Key Business Rules
1. All report endpoints cached (TTL 5 minutes)
2. Admin endpoints require MFA
3. Provider export limit: 5/day
4. Export row limit: 5000
5. Export file retention: 24 hours
6. Download URL expiration: 1 hour
7. Starvation threshold: 7 days (configurable)
8. Bad lead approval rate threshold: 50% (configurable)
9. Refund rate threshold: 20% (configurable)

### Configuration Values
```env
STARVATION_THRESHOLD_DAYS=7
BAD_LEAD_APPROVAL_RATE_THRESHOLD=0.50
BAD_LEAD_REFUND_RATE_THRESHOLD=0.20
REPORT_CACHE_TTL_SECONDS=300
EXPORT_MAX_ROWS=5000
EXPORT_FILE_RETENTION_HOURS=24
EXPORT_URL_TTL_HOURS=1
PROVIDER_EXPORT_DAILY_LIMIT=5
```

---

## Risk Assessment

### Technical Risks
1. **Complex Aggregation Queries:** KPI queries may be slow for large datasets
   - Mitigation: Use indexes, caching, and query optimization
2. **Export Performance:** Large exports may timeout
   - Mitigation: Async processing via BullMQ, row limits
3. **Cache Invalidation:** Stale data if not invalidated properly
   - Mitigation: TTL-based caching only (no invalidation in MVP)

### Business Risks
1. **KPI Definition Ambiguity:** Stakeholders may disagree on definitions
   - Mitigation: Document all formulas clearly
2. **Export Abuse:** Users may request excessive exports
   - Mitigation: Rate limits, row limits, retention limits

---

## Success Criteria

1. ✅ All 9 API endpoints implemented and documented
2. ✅ All 8 deferred items addressed
3. ✅ Caching working with 5-minute TTL
4. ✅ Export jobs working asynchronously
5. ✅ All tests passing
6. ✅ KPI formulas documented and verified
7. ✅ Performance acceptable (<500ms cached, <2s cold)

---

## Next Epic After Completion

**EPIC 12 - Observability & Ops**
- Monitoring & alerting infrastructure
- Metrics endpoints
- Health checks
- Production readiness

---

**Ready to proceed? Say "yes" to start implementing all phases.**

