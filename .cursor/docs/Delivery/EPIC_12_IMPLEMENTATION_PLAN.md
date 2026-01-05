# EPIC 12 - Observability & Ops Implementation Plan

**Epic:** Observability & Operations  
**Created:** Jan 5, 2026  
**Target:** MVP Operations - System Reliability & Operational Control  
**Dependencies:** All epics (01-11) ✅  
**Status:** Planning  
**Estimated Effort:** 24-28 hours (~4 days)

---

## Pre-Implementation Checklist

### ✅ Deferred Items Review
- [x] Checked `DEFERRED_ITEMS_SUMMARY.md` - Found **8 items** assigned to EPIC 12
- [x] Items to incorporate:
  1. **From EPIC 10:** Email Queue Monitoring (P2, 4h)
  2. **From EPIC 04:** Scheduled Job for Subscription Reactivation (P3, 2h)
  3. **From EPIC 06:** Real-time Distribution Status (P3, 3h) - *Deferred to future*
  4. **From EPIC 07:** Balance Reconciliation Job (P3, 0.5h)
  5. **From EPIC 11:** S3 Storage for Report Exports (P2, 3h) - *Deferred to future*
  6. **From EPIC 11:** Enhance Error Logging (P2, 2h)
  7. **From EPIC 11:** Query Performance Monitoring (P2, 3h)
  8. **From EPIC 11:** OpenAPI/Swagger Documentation (P2, 3h) - *Deferred to post-MVP*

**Strategy:** Focus on core observability infrastructure first. S3 storage and WebSockets deferred to post-MVP.

### ✅ Dependencies Verified
| Epic | Dependency | Status | Component |
|------|------------|--------|-----------|
| 01 | Auth/RBAC | ✅ | Admin MFA for queue management |
| 06 | Distribution | ✅ | Distribution metrics |
| 07 | Billing | ✅ | Balance reconciliation |
| 10 | Email | ✅ | Email queue monitoring |
| 11 | Reporting | ✅ | Report export monitoring |

### ✅ Existing Infrastructure Verified
- BullMQ queues - ✅ `distribution`, `email`, `report-export`
- Redis - ✅ Available for metrics
- PostgreSQL - ✅ Available for DLQ table
- Audit logging - ✅ Available for job logging
- Worker process - ✅ Running with three queues

---

## Implementation Phases

### Phase 1: Database Schema & Types
**Effort:** 1 hour  
**Files:**
- `packages/database/schema.sql`
- `packages/database/migrate.ts`
- `apps/web/lib/types/observability.ts` (new)

**Tasks:**
1. Create `dead_letter_queue` table for DLQ tracking
2. Add indexes for queue name and failed_at
3. Create TypeScript types for metrics, health checks, DLQ entries
4. Create Zod validation schemas for DLQ queries

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name VARCHAR(100) NOT NULL,
  job_id VARCHAR(100),
  payload JSONB,
  error_message TEXT,
  stack_trace TEXT,
  attempts INT,
  failed_at TIMESTAMPTZ NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlq_queue_failed_at
  ON dead_letter_queue(queue_name, failed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dlq_resolved
  ON dead_letter_queue(resolved, failed_at DESC);
```

**Acceptance Criteria:**
- [ ] Migration runs successfully
- [ ] Types compile without errors
- [ ] DLQ table created with proper indexes

---

### Phase 2: Structured Logging Infrastructure
**Effort:** 2 hours  
**Files:**
- `apps/web/lib/services/logger.ts` (new)
- `apps/worker/src/lib/logger.ts` (new)

**Tasks:**
1. Create structured logger with Winston/Pino
2. Add correlation ID support
3. Implement log levels (debug, info, warn, error)
4. Add JSON formatting for log aggregation
5. Add request context middleware

**Logger Interface:**
```typescript
interface Logger {
  info(event: string, metadata?: Record<string, any>): void
  warn(event: string, metadata?: Record<string, any>): void
  error(event: string, error: Error, metadata?: Record<string, any>): void
  withCorrelation(correlationId: string): Logger
}
```

**Log Format:**
```json
{
  "level": "info",
  "event": "assignment_created",
  "correlation_id": "uuid",
  "timestamp": "2026-01-05T10:30:00Z",
  "metadata": { "lead_id": "uuid", "provider_id": "uuid" }
}
```

**Deferred Items Addressed:**
- ✅ EPIC 11: Enhance Error Logging with Structured Logging (P2)

**Acceptance Criteria:**
- [ ] Structured JSON logs output
- [ ] Correlation IDs propagated
- [ ] Log levels working correctly

---

### Phase 3: Health Check Endpoints
**Effort:** 1.5 hours  
**Files:**
- `apps/web/app/health/live/route.ts` (new)
- `apps/web/app/health/ready/route.ts` (new)
- `apps/worker/src/health.ts` (new)

**Endpoints:**
- `GET /health/live` - Returns 200 if process running
- `GET /health/ready` - Checks DB, Redis, Queue connectivity

**Tasks:**
1. Implement liveness probe (simple 200 response)
2. Implement readiness probe with dependency checks
3. Add timeout handling for dependency checks
4. Return proper status codes (200/503)

**Readiness Check Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "up", "latency_ms": 5 },
    "redis": { "status": "up", "latency_ms": 2 },
    "queue": { "status": "up", "depth": 10 }
  }
}
```

**Acceptance Criteria:**
- [ ] `/health/live` returns 200
- [ ] `/health/ready` checks all dependencies
- [ ] Returns 503 if any dependency unavailable

---

### Phase 4: Prometheus Metrics Endpoint
**Effort:** 2 hours  
**Files:**
- `apps/web/lib/services/metrics.ts` (new)
- `apps/web/app/metrics/route.ts` (new)
- `apps/worker/src/lib/metrics.ts` (new)

**Tasks:**
1. Set up `prom-client` library
2. Create application metrics registry
3. Implement counter, histogram, and gauge metrics
4. Expose `/metrics` endpoint (internal only)
5. Add queue depth and DLQ size gauges

**Application Metrics:**
```typescript
// Counters
fmhl_leads_submitted_total
fmhl_leads_approved_total
fmhl_assignments_created_total
fmhl_assignments_skipped_insufficient_balance_total
fmhl_bad_leads_reported_total
fmhl_refunds_approved_total

// Histograms
fmhl_distribution_duration_ms
fmhl_inbox_query_duration_ms
fmhl_billing_operation_duration_ms
fmhl_http_request_duration_ms

// Queue Metrics
fmhl_jobs_enqueued_total{queue}
fmhl_jobs_completed_total{queue}
fmhl_jobs_failed_total{queue}
fmhl_job_duration_ms{queue}
fmhl_queue_depth{queue}
fmhl_dlq_size{queue}
```

**Deferred Items Addressed:**
- ✅ EPIC 11: Query Performance Monitoring (P2) - via histograms

**Acceptance Criteria:**
- [ ] `/metrics` returns Prometheus format
- [ ] All counters and histograms emitting
- [ ] Queue metrics populated

---

### Phase 5: Queue Monitoring API
**Effort:** 2 hours  
**Files:**
- `apps/web/app/api/v1/admin/queues/route.ts` (new)
- `apps/web/lib/services/queue-monitor.ts` (new)

**Endpoint:** `GET /api/v1/admin/queues`

**Tasks:**
1. Create queue monitoring service
2. Get queue depth, active jobs, failed jobs from BullMQ
3. Calculate DLQ size from database
4. Return aggregated queue status
5. Add rate limiting for queue stats

**Response:**
```json
{
  "queues": [
    {
      "name": "distribution",
      "depth": 5,
      "active": 2,
      "failed_last_hour": 0,
      "dlq_size": 0
    },
    {
      "name": "email",
      "depth": 45,
      "active": 8,
      "failed_last_hour": 2,
      "dlq_size": 3
    },
    {
      "name": "report-export",
      "depth": 1,
      "active": 0,
      "failed_last_hour": 0,
      "dlq_size": 0
    }
  ]
}
```

**Deferred Items Addressed:**
- ✅ EPIC 10: Email Queue Monitoring (P2)

**Acceptance Criteria:**
- [ ] All three queues monitored
- [ ] DLQ size calculated correctly
- [ ] Admin + MFA required

---

### Phase 6: Dead Letter Queue Management
**Effort:** 2.5 hours  
**Files:**
- `apps/web/app/api/v1/admin/queues/dlq/route.ts` (new)
- `apps/web/app/api/v1/admin/queues/dlq/[id]/route.ts` (new)
- `apps/web/app/api/v1/admin/queues/dlq/[id]/retry/route.ts` (new)
- `apps/web/lib/services/dlq.ts` (new)
- `apps/worker/src/lib/dlq.ts` (new)

**Endpoints:**
- `GET /api/v1/admin/queues/dlq` - List DLQ entries (paginated)
- `GET /api/v1/admin/queues/dlq/:id` - Get DLQ entry details
- `POST /api/v1/admin/queues/dlq/:id/retry` - Retry failed job
- `DELETE /api/v1/admin/queues/dlq/:id` - Mark as resolved

**Tasks:**
1. Create DLQ service for CRUD operations
2. Implement DLQ capture in worker processors
3. Add retry logic that re-enqueues jobs
4. Add resolution tracking with user attribution
5. Add audit logging for DLQ actions

**DLQ Entry Interface:**
```typescript
interface DLQEntry {
  id: string
  queue_name: string
  job_id: string
  payload: Record<string, any>
  error_message: string
  stack_trace: string | null
  attempts: number
  failed_at: string
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
}
```

**Audit Actions:**
- `dlq.entry_viewed`
- `dlq.job_retried`
- `dlq.entry_resolved`

**Acceptance Criteria:**
- [ ] Failed jobs captured in DLQ table
- [ ] Admin can view, retry, resolve entries
- [ ] Retry re-enqueues to correct queue
- [ ] Audit logging working

---

### Phase 7: Scheduled Jobs Infrastructure
**Effort:** 2 hours  
**Files:**
- `apps/worker/src/jobs/subscription-reactivation.ts` (new)
- `apps/worker/src/jobs/balance-reconciliation.ts` (new)
- `apps/worker/src/jobs/dlq-cleanup.ts` (new)
- `apps/worker/src/scheduler.ts` (new)

**Tasks:**
1. Create scheduler using BullMQ repeat jobs
2. Implement subscription reactivation job (every 5 min)
3. Implement balance reconciliation job (nightly 3 AM)
4. Implement DLQ cleanup job (weekly)
5. Add job execution logging and metrics

**Scheduled Jobs:**
| Job | Schedule | Purpose |
|-----|----------|---------|
| subscription-reactivation | */5 * * * * | Reactivate eligible subscriptions |
| balance-reconciliation | 0 3 * * * | Verify balance accuracy |
| dlq-cleanup | 0 0 * * 0 | Remove old resolved DLQ entries |

**Deferred Items Addressed:**
- ✅ EPIC 04: Scheduled Job for Subscription Reactivation (P3)
- ✅ EPIC 07: Balance Reconciliation Job (P3)

**Acceptance Criteria:**
- [ ] Jobs execute on schedule
- [ ] Job execution logged to audit_log
- [ ] Metrics emitted for job duration

---

### Phase 8: Alert Configuration
**Effort:** 1.5 hours  
**Files:**
- `infrastructure/alerts/prometheus-rules.yml` (new)
- `.cursor/docs/Delivery/ALERTS.md` (new)

**Tasks:**
1. Define Prometheus alerting rules
2. Document alert thresholds and channels
3. Create alert notification templates
4. Add runbook links to alerts

**Alert Rules:**
```yaml
groups:
  - name: fmhl-alerts
    rules:
      - alert: DistributionDurationHigh
        expr: histogram_quantile(0.95, fmhl_distribution_duration_ms) > 2000
        for: 5m
        severity: warning
        
      - alert: BillingFailuresHigh
        expr: rate(fmhl_billing_failures_total[1m]) > 1
        for: 1m
        severity: critical
        
      - alert: QueueBacklogHigh
        expr: fmhl_queue_depth > 100
        for: 10m
        severity: warning
        
      - alert: DLQSizeHigh
        expr: fmhl_dlq_size > 100
        for: 5m
        severity: critical
        
      - alert: InboxQuerySlow
        expr: histogram_quantile(0.95, fmhl_inbox_query_duration_ms) > 1000
        for: 5m
        severity: warning
```

**Acceptance Criteria:**
- [ ] Alert rules defined
- [ ] Documentation complete
- [ ] Runbooks linked

---

### Phase 9: DLQ Handler Integration
**Effort:** 1.5 hours  
**Files:**
- `apps/worker/src/processors/distribution.ts` (update)
- `apps/worker/src/processors/email.ts` (update)
- `apps/worker/src/processors/report-export.ts` (update)

**Tasks:**
1. Add DLQ capture to distribution processor
2. Add DLQ capture to email processor
3. Add DLQ capture to report export processor
4. Ensure proper error context captured
5. Increment failure metrics

**DLQ Capture Pattern:**
```typescript
worker.on('failed', async (job, error) => {
  if (job && job.attemptsMade >= job.opts.attempts) {
    await captureToDLQ({
      queue_name: 'distribution',
      job_id: job.id,
      payload: job.data,
      error_message: error.message,
      stack_trace: error.stack,
      attempts: job.attemptsMade,
    })
  }
  metrics.increment('fmhl_jobs_failed_total', { queue: 'distribution' })
})
```

**Acceptance Criteria:**
- [ ] Failed jobs captured after max retries
- [ ] Error context preserved
- [ ] Metrics emitting

---

### Phase 10: Integration Testing
**Effort:** 2 hours  
**Files:**
- `test-epic12.sh` (new)

**Tests:**
1. Health check endpoints
2. Metrics endpoint scrape
3. Queue monitoring API
4. DLQ CRUD operations
5. DLQ retry functionality
6. Scheduled job registration
7. Alert rule syntax validation
8. Logging format validation

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] TypeScript compiles
- [ ] No regressions

---

### Phase 11: Documentation & Review
**Effort:** 1 hour  
**Files:**
- `README.md` (update)
- `.cursor/docs/DEVELOPMENT_GUIDE.md` (update)
- `.cursor/docs/Delivery/EPIC_EXECUTION_PLAN.md` (update)
- `.cursor/docs/Delivery/DEFERRED_ITEMS_SUMMARY.md` (update)

**Tasks:**
1. Update README with observability endpoints
2. Document metrics and their meanings
3. Document alert runbooks
4. Update execution plan status
5. Mark deferred items as complete
6. Create code review document

**Acceptance Criteria:**
- [ ] README updated
- [ ] Runbooks documented
- [ ] Execution plan updated
- [ ] Deferred items marked complete

---

## Summary

### APIs to Implement (6 endpoints)
1. `GET /health/live` - Liveness probe
2. `GET /health/ready` - Readiness probe
3. `GET /metrics` - Prometheus metrics
4. `GET /api/v1/admin/queues` - Queue status
5. `GET /api/v1/admin/queues/dlq` - DLQ list
6. `GET /api/v1/admin/queues/dlq/:id` - DLQ detail
7. `POST /api/v1/admin/queues/dlq/:id/retry` - Retry job
8. `DELETE /api/v1/admin/queues/dlq/:id` - Resolve entry

### Scheduled Jobs (3 jobs)
1. Subscription reactivation (every 5 min)
2. Balance reconciliation (nightly)
3. DLQ cleanup (weekly)

### Metrics (15+ metrics)
- 6 application counters
- 4 histograms (latency tracking)
- 5 queue metrics (depth, job counts)

### Deferred Items Addressed (5/8)
- ✅ EPIC 10: Email Queue Monitoring
- ✅ EPIC 04: Subscription Reactivation Job
- ✅ EPIC 07: Balance Reconciliation Job
- ✅ EPIC 11: Structured Logging
- ✅ EPIC 11: Query Performance Monitoring

### Deferred to Post-MVP (3 items)
- ❌ EPIC 06: Real-time Distribution Status (WebSockets)
- ❌ EPIC 11: S3 Storage for Exports
- ❌ EPIC 11: OpenAPI/Swagger Documentation

---

## Risk Assessment

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Prometheus not available | Metrics still logged, can aggregate later |
| DLQ table growth | Weekly cleanup job, 30-day retention |
| Job scheduler complexity | Use proven BullMQ repeat jobs |

### Dependencies
- Prometheus/Grafana for metrics visualization (optional)
- Alerting system (PagerDuty, Slack) for notifications (optional)

---

## Configuration

### Environment Variables
```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090

# Scheduled Jobs
SUBSCRIPTION_REACTIVATION_ENABLED=true
BALANCE_RECONCILIATION_ENABLED=true
DLQ_CLEANUP_ENABLED=true

# Alert Thresholds
QUEUE_DEPTH_ALERT_THRESHOLD=100
DLQ_SIZE_ALERT_THRESHOLD=100
DISTRIBUTION_DURATION_P95_THRESHOLD_MS=2000
INBOX_QUERY_P95_THRESHOLD_MS=1000
```

---

## Effort Breakdown

| Phase | Component | Effort |
|-------|-----------|--------|
| 1 | Database Schema & Types | 1h |
| 2 | Structured Logging | 2h |
| 3 | Health Checks | 1.5h |
| 4 | Prometheus Metrics | 2h |
| 5 | Queue Monitoring API | 2h |
| 6 | DLQ Management | 2.5h |
| 7 | Scheduled Jobs | 2h |
| 8 | Alert Configuration | 1.5h |
| 9 | DLQ Handler Integration | 1.5h |
| 10 | Integration Testing | 2h |
| 11 | Documentation | 1h |
| **Total** | | **19h** |

**Buffer:** 5-9 hours for debugging and edge cases  
**Total Estimate:** 24-28 hours

---

## Definition of Done

- [ ] All endpoints implemented with proper schemas
- [ ] Metrics emitting and scrapeable
- [ ] Health checks functioning
- [ ] DLQ capture and management working
- [ ] Scheduled jobs running
- [ ] Alert rules defined
- [ ] TypeScript compiling
- [ ] Integration tests passing
- [ ] Documentation complete
- [ ] Deferred items marked complete

---

**Created By:** AI Assistant  
**Date:** Jan 5, 2026  
**Status:** Ready to Implement

