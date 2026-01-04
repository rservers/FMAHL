# EPIC 11 — Reporting & Analytics (LOCKED)

**Product:** Find Me a Hot Lead (FMHL)  
**Epic ID:** EPIC-11  
**Priority:** P4 (Operations)  
**Status:** LOCKED (Build-Ready)  
**Owner:** Product / Engineering  
**Last Updated:** 2026-01-02

---

## Purpose

Provide platform operators (admins) and providers with reliable reporting and analytics for lead flow health, revenue/billing visibility, fairness monitoring, bad lead/refund patterns, and exports—without creating “analytics-driven business logic” dependencies.

---

## Key Principles

- **Read-only analytics:** Reports are informational; they do not drive billing, distribution, or refunds.
- **Deterministic definitions:** Every KPI has a clear formula and data source.
- **Performance & caching:** Expensive aggregations are cached (TTL-based in MVP).
- **Auditability:** Exports and sensitive report actions are audit-logged.
- **Least privilege:** Admin vs provider visibility strictly enforced (RBAC + MFA for admin).

---

## Architecture Alignment

This epic depends on and reads from schemas and invariants established in:

- **Epic 01 — Platform Foundation & Access Control:** RBAC, MFA, audit_log
- **Epic 02 — Lead Intake & Confirmation:** leads lifecycle (submitted/confirmed)
- **Epic 03 — Admin Lead Review:** approval/rejection fields & rejection reasons
- **Epic 04 — Competition Levels & Subscriptions:** competition_levels, provider_subscriptions
- **Epic 05 — Filters & Eligibility:** filter logs + invalid filters
- **Epic 06 — Distribution Engine:** lead_assignments, distributed_at, fairness fields
- **Epic 07 — Billing & Payments:** provider_ledger, payments, provider balances
- **Epic 09 — Bad Lead & Refunds:** bad lead fields on lead_assignments + refund linkage
- **Epic 12 — Observability & Ops:** caching/metrics/alerts infrastructure

**Important:** This epic does not introduce any behavioral coupling—no report output is used as an input into distribution, billing, or bad lead decisioning.

---

## Scope (MVP)

### Admin Reporting
- Platform KPIs & health dashboard
- Funnel metrics (submitted → confirmed → approved → distributed)
- Revenue & deposits reporting
- Fairness / starvation monitoring
- Bad lead / refund analytics
- Exporting reports (async jobs)

### Provider Reporting
- Provider dashboard KPIs (leads received, acceptance/rejection, refunds)
- Provider billing summary view (high-level; detailed ledger is Epic 07)
- Export (provider-scoped) of assigned leads

---

## Out of Scope (MVP)

- Real-time analytics (streaming)
- ML/AI insights
- Custom report builder
- Cross-tenant benchmarking for providers
- Localization/i18n analytics labels (future)
- Any “automated action” based on metrics (alerts are informational only)

---

## Data Sources & KPI Definitions

### Leads Table (Epic 02/03)
- submitted_at
- confirmed_at
- approved_at / rejected_at
- rejection_reason (enum or string per Epic 03)

### Lead Assignments (Epic 06/09)
- assigned_at
- viewed_at / accepted_at / rejected_at
- bad_lead_reported_at, bad_lead_status
- refunded_at, refund_amount, refund_reason
- price_charged (from assignment) / billing references

### Billing (Epic 07)
- provider_ledger (entry_type, amount, balance_after, created_at)
- payments (status, amount, provider_name, currency)

---

# User Stories

## Story 1: Admin Platform KPI Dashboard (Overview)

**As an** admin  
**I want** a KPI dashboard for platform health  
**So that** I can monitor lead flow, operations, and issues quickly

### Acceptance Criteria
- Dashboard includes KPI rollups for a given period (default last 7 days):
  - total_leads_submitted
  - total_leads_confirmed
  - total_leads_approved
  - total_leads_rejected
  - total_leads_distributed
  - confirmation_rate = confirmed/submitted
  - approval_rate = approved/confirmed
  - distribution_rate = distributed/approved
  - avg_time_to_confirmation (submitted_at → confirmed_at)
  - avg_time_to_approval (confirmed_at → approved_at)
  - avg_time_to_distribution (approved_at → distributed_at)
  - total_revenue (sum of lead_purchase debits)
  - total_refunds (sum of refund credits)
  - net_revenue = total_revenue - total_refunds
  - bad_lead_report_rate = bad_lead_reports / assignments
  - bad_lead_approval_rate = approved_bad_leads / bad_lead_reports
- Includes **top rejection reasons** breakdown (nice-to-have, but included for clarity)
- Cached with TTL 5 minutes
- RBAC + MFA required

### API
`GET /api/v1/admin/reports/kpis?date_from=&date_to=`

### Response 200 (example)
```json
{
  "period": { "from": "2025-12-26", "to": "2026-01-02" },
  "kpis": {
    "total_leads_submitted": 1200,
    "total_leads_confirmed": 900,
    "total_leads_approved": 700,
    "total_leads_rejected": 200,
    "total_leads_distributed": 650,
    "confirmation_rate": 0.75,
    "approval_rate": 0.78,
    "distribution_rate": 0.93,
    "avg_time_to_confirmation_minutes": 18.2,
    "avg_time_to_approval_hours": 6.3,
    "avg_time_to_distribution_minutes": 4.1,
    "total_revenue": 16250.00,
    "total_refunds": 1250.00,
    "net_revenue": 15000.00,
    "bad_lead_report_rate": 0.08,
    "bad_lead_approval_rate": 0.62,
    "top_rejection_reasons": [
      { "reason": "out_of_service_area", "count": 45 },
      { "reason": "duplicate", "count": 30 },
      { "reason": "incomplete_info", "count": 25 }
    ]
  }
}
```

### Tasks
- Implement KPI aggregation queries (SQL)
- Add Redis cache layer (key: `admin:kpis:{from}:{to}` TTL 5m)
- Add RBAC+MFA guard
- Add unit tests for KPI formulas
- Add integration test with seeded sample data

---

## Story 2: Funnel Analytics (Time Series)

**As an** admin  
**I want** funnel analytics over time  
**So that** I can detect drop-offs and operational bottlenecks

### Acceptance Criteria
- Returns time series aggregated by day (default) or hour (optional)
- Stages:
  - submitted
  - confirmed
  - approved
  - distributed
- If `niche_id` is provided: returns **single-niche** funnel series  
- If `niche_id` omitted: returns **platform-wide aggregate** series
- Cached TTL 5 minutes
- RBAC + MFA required

### API
`GET /api/v1/admin/reports/funnel?date_from=&date_to=&bucket=day|hour&niche_id=`

### Response 200 (example)
```json
{
  "period": { "from": "2025-12-26", "to": "2026-01-02" },
  "bucket": "day",
  "niche_id": null,
  "series": [
    { "date": "2025-12-26", "submitted": 120, "confirmed": 90, "approved": 70, "distributed": 66 },
    { "date": "2025-12-27", "submitted": 140, "confirmed": 100, "approved": 80, "distributed": 75 }
  ]
}
```

### Tasks
- Implement time-series query by stage timestamps
- Support optional niche filter (single niche)
- Cache results (key: `admin:funnel:{bucket}:{from}:{to}:{niche_id||'all'}` TTL 5m)
- Tests for date bucketing and niche filter

---

## Story 3: Revenue & Deposits Summary

**As an** admin  
**I want** revenue and deposit reporting  
**So that** I can reconcile billing outcomes and platform cashflow

### Acceptance Criteria
- Provides:
  - total_deposits (ledger entry_type='deposit')
  - total_lead_purchases (entry_type='lead_purchase')
  - total_refunds (entry_type='refund')
  - net_revenue = lead_purchases - refunds
  - payment_status_breakdown (payments.status)
  - provider_topups_count
- Currency assumed USD in MVP (store currency in payments per Epic 07)
- Cached TTL 5 minutes
- RBAC + MFA required

### API
`GET /api/v1/admin/reports/revenue?date_from=&date_to=`

### Tasks
- Aggregate provider_ledger totals by entry_type
- Aggregate payments by status and provider_name
- Cache (key: `admin:revenue:{from}:{to}` TTL 5m)
- Tests + fixtures

---

## Story 4: Fairness & Starvation Monitoring

**As an** admin  
**I want** visibility into provider starvation risk  
**So that** I can identify fairness problems and provider dissatisfaction

### Acceptance Criteria
- Starvation threshold days is configurable via config value:
  - `STARVATION_THRESHOLD_DAYS` (default 7)
- Report identifies subscriptions/providers that have not received leads since threshold:
  - last_received_at is NULL or older than threshold
- Filterable by niche_id and competition_level_id
- Cached TTL 5 minutes
- RBAC + MFA required

### API
`GET /api/v1/admin/reports/fairness/starvation?date_from=&date_to=&niche_id=&competition_level_id=`

### Tasks
- Read config `STARVATION_THRESHOLD_DAYS`
- Query provider_subscriptions.last_received_at with thresholds
- Cache (key includes filters)
- Tests for NULL handling, threshold boundaries

---

## Story 5: Flagged Provider Metrics (Bad Lead Patterns)

**As an** admin  
**I want** to identify providers with abnormal bad-lead/refund behavior  
**So that** I can investigate fraud or configuration issues

### Acceptance Criteria
- Thresholds configurable via config values:
  - `BAD_LEAD_APPROVAL_RATE_THRESHOLD` (default 0.50)
  - `BAD_LEAD_REFUND_RATE_THRESHOLD` (default 0.20)
- Flags are informational only (no auto penalties)
- Supports date range (default last 30 days)
- RBAC + MFA required

### API
`GET /api/v1/admin/reports/providers/flags?date_from=&date_to=&provider_id=`

### Tasks
- Read thresholds from config
- Compute provider metrics:
  - total_assignments
  - total_bad_lead_reports
  - total_bad_lead_approved
  - approval_rate
  - refund_rate
- Mark flagged if above thresholds
- Tests for threshold boundaries

---

## Story 6: Provider KPI Dashboard

**As a** provider  
**I want** to view my performance KPIs  
**So that** I can manage my lead handling and ROI

### Acceptance Criteria
- Provider sees:
  - assignments_received
  - acceptance_rate
  - rejection_rate
  - avg_time_to_view
  - avg_time_to_accept
  - bad_lead_reports_count
  - bad_lead_approved_count
  - refunds_amount
  - net_spend (lead purchases - refunds)
- Optional query param `group_by=niche`:
  - If set: return KPIs per niche (for multi-niche providers)
  - Else: aggregate across all niches
- Provider can only see their own data (RBAC provider role)

### API
`GET /api/v1/provider/reports/kpis?date_from=&date_to=&group_by=niche|none`

### Tasks
- Aggregate lead_assignments for provider_id
- Join niches for niche breakdown when group_by=niche
- Tests for authorization + grouping logic

---

## Story 7: Export Reports (Async Job)

**As an** admin or provider  
**I want** to export report data  
**So that** I can do offline analysis and share data

### Acceptance Criteria
- Exports run asynchronously via BullMQ (Epic 12)
- Export types:
  - admin: platform KPIs, funnel, revenue, fairness, bad leads
  - provider: assigned leads export (provider scoped)
- Export limits:
  - Provider: max 5 exports/day
  - Admin: no explicit daily limit in MVP (monitor)
- Export size limits:
  - If estimated rows > 5000: return 400 with guidance to narrow filters
- Export outputs:
  - CSV (MVP), optional XLSX later
- **Retention & link TTL**
  - Export files retained **24 hours**
  - Signed download URL expires **1 hour**
  - After export file expiration: download returns **410 Gone** with message `"Export expired"`
- Audit logging:
  - export requested
  - export completed / failed
  - (optional) export downloaded (nice-to-have)
- RBAC enforced; MFA required for admin exports

### APIs

#### POST /api/v1/reports/exports
**Request**
```json
{
  "scope": "admin|provider",
  "type": "funnel|kpis|revenue|fairness|bad_leads|assigned_leads",
  "filters": {
    "date_from": "2025-12-26",
    "date_to": "2026-01-02",
    "niche_id": null
  },
  "format": "csv"
}
```

**Response 202**
```json
{ "ok": true, "job_id": "uuid", "status": "pending" }
```

**Response 400 (export too large)**
```json
{ "error": "Export too large. Please narrow your date range or filters.", "max_rows": 5000 }
```

**Response 429 (provider daily limit)**
```json
{ "error": "Export limit exceeded", "limit": 5, "reset_at": "2026-01-03T00:00:00Z" }
```

#### GET /api/v1/reports/exports/:jobId/status
**Response 200**
```json
{
  "job_id": "uuid",
  "status": "pending|processing|completed|failed",
  "created_at": "2026-01-02T14:00:00Z",
  "completed_at": "2026-01-02T14:02:30Z",
  "row_count": 1234,
  "download_url": "https://...",
  "expires_at": "2026-01-02T15:02:30Z",
  "error": null
}
```

**Response 404**
```json
{ "error": "Export job not found" }
```

#### GET /api/v1/reports/exports/:jobId/download
- Returns 302 to signed URL OR streams file (implementation choice)
- **Response 410**
```json
{ "error": "Export expired" }
```

### Tasks
- Create export_jobs table (or reuse BullMQ job metadata + DB row)
- Implement export job processors (CSV writer)
- Enforce provider daily limit with Redis counter (`exports:{provider_id}:{date}`)
- Enforce row limit check before enqueue (estimated row count query)
- Store export artifact in object storage (S3 or equivalent)
- Generate signed URL (TTL 1 hour)
- Enforce file retention 24 hours (scheduled cleanup job)
- Audit log:
  - report_export_requested
  - report_export_completed
  - report_export_failed
  - (optional) report_export_downloaded
- Add API tests (202, 400, 429, 404, 410)

---

## Story 8: Caching Strategy (TTL-based)

**As a** system  
**I want** report endpoints cached  
**So that** heavy aggregates don’t overload the database

### Acceptance Criteria
- Default caching is TTL-based (5 minutes)
- Cache keys include user scope + filters
- Cache bypass via `?no_cache=true` for admins only (optional)
- Optional future invalidation hooks documented (post-MVP)

### Optional invalidation triggers (post-MVP)
- Lead approved → invalidate admin KPI + funnel
- Assignment created → invalidate fairness metrics
- Refund processed → invalidate revenue + bad lead metrics
- Provider deposit → invalidate revenue summary

### Tasks
- Implement Redis caching wrapper
- Define cache key conventions per endpoint
- Metrics for cache hit rate & compute duration (Epic 12)

---

## Story 9: Admin Bad Lead Metrics Dashboard (Read-only)

**As an** admin  
**I want** aggregated bad lead analytics  
**So that** I can track quality issues and refund exposure

### Acceptance Criteria
- Returns:
  - total_reports
  - total_approved
  - total_rejected
  - approval_rate
  - total_refund_amount
  - avg_resolution_time_hours
  - by_niche
  - by_provider (with flagged boolean)
  - by_reason_category (if categories exist per Epic 09)
- Cached TTL 5 minutes
- RBAC + MFA required

### API
`GET /api/v1/admin/reports/bad-leads/metrics?date_from=&date_to=&niche_id=&provider_id=`

### Tasks
- Implement aggregation query
- Cache (key includes filters)
- Tests for correct rollups

---

## Optional Story 10: Report Access Logging (Security)

**As an** admin  
**I want** sensitive report access logged  
**So that** we can audit exposure of billing/provider drilldowns

### Acceptance Criteria
- When admin requests sensitive reports (revenue, provider flags, drilldowns):
  - Write audit_log event `report_accessed`
  - metadata includes report_type + filters
- Queryable via Epic 03 admin activity log

### Tasks
- Emit audit_log entries for configured report types
- Add tests for audit emission

---

# Database Schema (Reporting)

Reporting primarily reads from existing tables. Minimal additions are required for exports.

## export_jobs (if needed)
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

---

# Error Handling (Common)

- **403 Forbidden**: insufficient role
- **401 Unauthorized**: not authenticated
- **404 Not Found**: job/report not found
- **429 Too Many Requests**: provider export daily limit exceeded
- **400 Bad Request**: invalid filters, export too large
- **410 Gone**: export expired

---

# Observability (Epic 12 Integration)

## Metrics
- report_query_duration_ms (by endpoint)
- report_cache_hit_rate
- export_jobs_created_total
- export_jobs_failed_total
- export_jobs_completed_total
- export_row_count
- export_generation_duration_ms

## Alerts (suggested)
- KPI/funnel query p95 > 2s
- Export job failure rate > 10% in 1h
- Export processor lag > 5m
- Cache hit rate < 50% after warm-up

---

# Testing Requirements

## Unit Tests
- KPI formula correctness
- Threshold config parsing (starvation, flagged provider thresholds)
- Export row limit estimation logic
- Cache key generation

## Integration Tests
- KPI dashboard: seeded data produces expected rollups
- Funnel time series: bucketing correctness
- Export job: create → process → completed → download URL generation
- Expiration behavior:
  - download URL TTL enforced
  - file retention 24h enforced → 410 Gone

## Performance Tests
- Admin KPI dashboard < 500ms (warm cache) / < 2s (cold)
- Funnel query < 2s for 30 days range
- Export generation: 5000 rows < 30s

---

## Deferred Items from Other Epics

### Redis Caching for EPIC 04 Data
**Deferred From:** EPIC 04 - Competition Levels & Subscriptions  
**Priority:** P3  
**Description:** Competition levels and provider subscriptions are read frequently but change rarely. Adding Redis caching would improve performance.

**Data to cache:**
- Competition levels per niche (TTL: 1 hour)
  - Key: `cache:competition_levels:niche:{niche_id}`
  - Invalidate on: create/update/delete/reorder level
  
- Provider subscriptions (TTL: 5 minutes)
  - Key: `cache:provider_subscriptions:{provider_id}`
  - Invalidate on: subscribe/unsubscribe
  
- Email templates (TTL: 6 hours)
  - Key: `cache:email_template:{template_key}`
  - Invalidate on: template update

**Expected Impact:**
- Reduce DB queries by ~60% for competition level lookups
- Improve API response time from ~50ms to ~5ms for cached reads

**Implementation Approach:**
1. Add cache layer in API routes (check cache → fetch DB → set cache)
2. Add cache invalidation in write operations
3. Use Redis `GET`/`SET` with TTL
4. Monitor cache hit rate via metrics

**Status:** To be implemented in EPIC 11 caching infrastructure.

---

# Definition of Done

- All report endpoints implemented with RBAC; admin endpoints enforce MFA
- KPI dashboard includes top rejection reasons breakdown
- Funnel endpoint behavior clarified (single niche vs platform aggregate)
- Starvation + flagged provider thresholds configurable via config
- Export job implementation includes:
  - async processing
  - provider daily limits
  - row limit enforcement
  - **24h file retention and 1h signed URL TTL**
  - status endpoint with full schema
  - correct error responses (400/429/404/410)
- Caching enabled (TTL-based) and measured
- Integration verified with:
  - Epic 06 (assignments reflected in provider/admin reports)
  - Epic 07 (ledger/payments totals match)
  - Epic 09 (refund metrics)
  - Epic 12 (queues + metrics + alerting)
- Tests passing: unit, integration, performance baselines
- Documentation complete: KPI definitions + endpoint contracts
