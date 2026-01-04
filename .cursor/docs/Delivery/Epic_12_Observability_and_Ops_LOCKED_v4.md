
# Epic 12 – Observability & Operations (LOCKED v4)

> Status: Approved with Minor Enhancements (Non‑Blocking for MVP)

---

## Summary
This epic defines the full observability, monitoring, alerting, and operational control plane for Find Me a Hot Lead (FMHL). It ensures system reliability, debuggability, and operational safety across all epics.

---

## Story Structure Overview

1. Queue Infrastructure (BullMQ)
2. Queue Monitoring & Metrics
3. Application Metrics
4. Structured Logging & Correlation
5. Alerting Rules
6. Dead‑Letter Queue (DLQ) Handling
7. Health Checks & Readiness
8. Operational Dashboards
9. Incident Support Tooling (Optional)

---

## API Endpoints

### GET /metrics
- Prometheus scrape endpoint
- No authentication (internal network only)
- Content‑Type: `text/plain; version=0.0.4`
- Exposes all application + queue metrics

---

### GET /api/v1/admin/queues
**RBAC:** Admin + MFA

Response:
```json
{
  "queues": [
    {
      "name": "email_send",
      "depth": 45,
      "active": 8,
      "failed_last_hour": 2,
      "dlq_size": 3
    }
  ]
}
```

---

### GET /api/v1/admin/queues/dlq?page=1&limit=50&queue=email_send
**RBAC:** Admin + MFA

Response:
```json
{
  "entries": [
    {
      "id": "uuid",
      "queue_name": "email_send",
      "job_id": "job-123",
      "error_message": "SMTP timeout",
      "attempts": 3,
      "failed_at": "2026-01-02T14:30:00Z",
      "resolved": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 123,
    "total_pages": 3
  }
}
```

---

### GET /api/v1/admin/queues/dlq/:id
Response:
```json
{
  "id": "uuid",
  "queue_name": "email_send",
  "job_id": "job-123",
  "payload": { "to": "user@example.com", "template": "welcome" },
  "error_message": "SMTP timeout",
  "stack_trace": "Error: SMTP timeout",
  "attempts": 3,
  "failed_at": "2026-01-02T14:30:00Z",
  "resolved": false
}
```

---

### POST /api/v1/admin/queues/dlq/:id/retry
Response:
```json
{ "ok": true, "job_id": "job-456", "message": "Job re‑enqueued successfully" }
```

---

### DELETE /api/v1/admin/queues/dlq/:id
Response:
```json
{ "ok": true, "message": "DLQ entry marked as resolved" }
```

---

## Error Responses (Standard)
```json
{ "error": "Authentication required" }             // 401
{ "error": "Insufficient permissions" }            // 403
{ "error": "Not found" }                            // 404
{ "error": "Bad request" }                          // 400
{ "error": "Internal error", "correlation_id": "" } // 500
```

---

## Database Schema

```sql
CREATE TABLE dead_letter_queue (
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
  resolved_by UUID
);

CREATE INDEX idx_dlq_queue_failed_at
  ON dead_letter_queue(queue_name, failed_at DESC);
```

Retention: 30 days via scheduled cleanup job.

---

## Metrics

### Application Metrics
- fmhl_leads_submitted_total
- fmhl_leads_approved_total
- fmhl_assignments_created_total
- fmhl_assignments_skipped_insufficient_balance_total
- fmhl_bad_leads_reported_total
- fmhl_refunds_approved_total

### Histograms
- fmhl_distribution_duration_ms
- fmhl_inbox_query_duration_ms
- fmhl_billing_operation_duration_ms

### Queue Metrics
Counters:
- fmhl_jobs_enqueued_total{queue}
- fmhl_jobs_completed_total{queue}
- fmhl_jobs_failed_total{queue}

Histograms:
- fmhl_job_duration_ms{queue}

Gauges:
- fmhl_queue_depth{queue}
- fmhl_dlq_size{queue}

---

## Alerts

### Distribution Duration High
- Query: histogram_quantile(0.95, fmhl_distribution_duration_ms) > 2000 for 5m
- Severity: warning
- Channel: Slack

### Billing Failures
- Query: rate(fmhl_billing_failures_total[1m]) > 1
- Severity: critical
- Channel: PagerDuty

### Queue Backlog High
- Query: fmhl_queue_depth > 100 for 10m
- Severity: warning

### High DLQ Size
- Query: fmhl_dlq_size > 100 for 5m
- Severity: critical

### Inbox Query Slow
- Query: histogram_quantile(0.95, fmhl_inbox_query_duration_ms) > 1000 for 5m
- Severity: warning

---

## Dashboards

### Queue Health Dashboard
- Queue Depth (Gauge): fmhl_queue_depth{queue="email_send"}
- Failure Rate: rate(fmhl_jobs_failed_total{queue="email_send"}[5m])
- Job Duration p95: histogram_quantile(0.95, fmhl_job_duration_ms{queue="email_send"})

---

## Logging

Structured JSON logs with correlation_id.

Example:
```json
{
  "level": "info",
  "event": "assignment_created",
  "correlation_id": "uuid",
  "metadata": { "lead_id": "uuid", "provider_id": "uuid" }
}
```

---

## Health Checks

### GET /health/live
- Always returns 200 if process is running

### GET /health/ready
- Checks DB, Redis, Queue connectivity
- Returns 503 if any dependency unavailable

---

## Testing Requirements

### Unit
- Metric emission correctness
- Logger schema validation
- Queue config parsing

### Integration
- Queue → DLQ → Retry flow
- Health check dependency failures
- Metrics scrape success

### Performance
- Metric emission overhead < 5%
- Queue throughput under load

---

## Deferred Items from Other Epics

### Scheduled Job: Subscription Status Reactivation (EPIC 04)
**Deferred From:** EPIC 04 - Competition Levels & Subscriptions  
**Priority:** P3  
**Description:** The `reactivateEligibleSubscriptions()` function needs to run periodically to check for providers whose balance has been restored and reactivate their subscriptions.

**Job Details:**
- **Function:** `reactivateEligibleSubscriptions()` in `apps/web/lib/services/subscription-status.ts`
- **Schedule:** Every 5 minutes (cron: `*/5 * * * *`)
- **Purpose:** Check all inactive subscriptions with `deactivation_reason = 'insufficient_balance'` and reactivate if balance is now sufficient
- **Dependencies:** EPIC 07 (Billing) must be complete for actual balance checks

**Implementation Approach:**
1. Add BullMQ scheduled job in worker
2. Create job handler that calls `reactivateEligibleSubscriptions()`
3. Add job monitoring and alerting
4. Log job execution to audit log (system actor)

**Expected Behavior:**
- Runs every 5 minutes
- Queries for inactive subscriptions
- Checks balance via EPIC 07 service
- Reactivates eligible subscriptions
- Sends email notifications
- Logs all reactivations

**Monitoring:**
- Track job execution time (should be < 30s)
- Track number of reactivations per run
- Alert if job fails 3 times in a row

---

### Email Queue Monitoring (EPIC 10)
**Deferred From:** EPIC 10 - Email Infrastructure  
**Priority:** P2 (Important for Production)  
**Description:** The email queue (BullMQ) needs monitoring for production operations. Admins should be alerted to queue depth, failures, and delays.

**Monitoring Requirements:**
- **Queue depth monitoring:** Alert if >1000 emails queued
- **DLQ monitoring:** Alert if dead letter queue has >10 emails
- **Send rate tracking:** Track emails/minute for SES limit compliance
- **Failed job alerts:** Alert on repeated failures for same email

**Implementation Approach:**
1. Expose BullMQ metrics endpoint
2. Integrate with Prometheus/Grafana
3. Add alerting rules
4. Create dashboard for email operations

**Expected Impact:**
- Early detection of email delivery issues
- Compliance with SES sending limits
- Reduced email delivery failures

---

### Balance Reconciliation Job (EPIC 07)
**Deferred From:** EPIC 07 - Billing & Payments  
**Priority:** P3  
**Description:** Provider cached balance should be periodically reconciled against the immutable ledger to detect any discrepancies.

**Job Details:**
- **Function:** `calculateBalance()` in `apps/web/lib/services/ledger.ts`
- **Schedule:** Nightly at 3 AM (cron: `0 3 * * *`)
- **Purpose:** Compare `providers.balance` vs `SUM(provider_ledger.amount)` for all providers
- **Tolerance:** 0.01 USD for floating point comparison

**Implementation Approach:**
1. Create job in `apps/worker/src/jobs/balance-reconciliation.ts`
2. Use `calculateBalance()` from ledger service
3. Schedule via BullMQ repeat jobs
4. Add monitoring metrics

**Expected Behavior:**
- Runs nightly at 3 AM
- Queries all providers
- Calculates ledger balance
- Compares to cached balance
- Logs discrepancies with severity: warning
- Alerts if discrepancies > 1.00 USD
- Auto-corrects if within tolerance

**Monitoring:**
- Track job execution time
- Track number of discrepancies found
- Track number of auto-corrections
- Alert on large discrepancies (>1.00 USD)

**Expected Impact:**
- Early detection of balance calculation bugs
- Increased confidence in billing accuracy
- Compliance for financial audits

**Status:** To be implemented in EPIC 12 scheduled jobs infrastructure.

---

### Email Queue Monitoring (P2)
**Deferred From:** EPIC 10 - Email Infrastructure  
**Priority:** P2  
**Description:** The email queue (BullMQ) needs monitoring for production operations to ensure email delivery reliability.

**Metrics to Track:**
- **Queue depth:** Alert if >1000 emails queued
- **Dead letter queue size:** Alert if >10 emails in DLQ
- **Email send rate:** Track emails/minute for SES limit compliance
- **Failed job count:** Alert on repeated failures for same email
- **Job processing time:** Track P50/P95/P99 latency

**Implementation Guidance:**
- Expose BullMQ metrics endpoint in worker (`/metrics`)
- Integrate with Prometheus/Grafana
- Add alerting rules:
  - Queue depth > 1000 for 5 minutes
  - DLQ size > 10
  - Failed job rate > 5% over 10 minutes
- Create dashboard for email operations
- Monitor job retry counts and backoff behavior

**Expected Dashboards:**
- Email queue depth over time
- Email send rate (emails/min)
- Job success/failure rate
- Processing time distribution
- DLQ size over time

**Status:** To be implemented in EPIC 12 monitoring infrastructure.

---

## Definition of Done

- All endpoints implemented with schemas
- Metrics emitted & scraped
- Alerts firing and recoverable
- Dashboards visible in Grafana
- DLQ manageable via admin UI
- Integrated with Epics 06–11
