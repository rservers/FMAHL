
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

## Definition of Done

- All endpoints implemented with schemas
- Metrics emitted & scraped
- Alerts firing and recoverable
- Dashboards visible in Grafana
- DLQ manageable via admin UI
- Integrated with Epics 06–11
