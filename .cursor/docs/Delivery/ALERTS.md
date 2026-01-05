# Alert Configuration & Runbooks

**Last Updated:** Jan 5, 2026  
**Status:** Active

---

## Overview

This document describes all Prometheus alerting rules configured for Find Me A Hot Lead platform monitoring.

**Alert Configuration File:** `infrastructure/alerts/prometheus-rules.yml`

---

## Alert Rules

### 1. DistributionDurationHigh

**Severity:** Warning  
**Component:** Distribution Engine  
**Threshold:** P95 duration > 2000ms for 5 minutes

**Query:**
```promql
histogram_quantile(0.95, fmhl_distribution_duration_ms) > 2000
```

**What It Means:**
Distribution jobs are taking longer than expected. This could indicate:
- Database performance issues
- High lead volume
- Complex filter evaluation

**Actions:**
1. Check database query performance
2. Review distribution logs for errors
3. Check queue depth
4. Verify filter complexity

**Runbook:** [Distribution Slow](https://docs.findmeahotlead.com/runbooks/distribution-slow)

---

### 2. BillingFailuresHigh

**Severity:** Critical  
**Component:** Billing & Payments  
**Threshold:** >1 failure/minute for 1 minute

**Query:**
```promql
rate(fmhl_billing_failures_total[1m]) > 1
```

**What It Means:**
Billing operations are failing at a high rate. This is critical as it affects provider balances and payments.

**Actions:**
1. Check billing service logs immediately
2. Verify database connectivity
3. Check payment processor status
4. Review recent ledger entries for errors
5. Escalate to on-call engineer

**Runbook:** [Billing Failures](https://docs.findmeahotlead.com/runbooks/billing-failures)

---

### 3. QueueBacklogHigh

**Severity:** Warning  
**Component:** Queue System  
**Threshold:** Queue depth > 100 for 10 minutes

**Query:**
```promql
fmhl_queue_depth > 100
```

**What It Means:**
Jobs are backing up in the queue faster than workers can process them.

**Actions:**
1. Check worker process status
2. Review job processing times
3. Scale up workers if needed
4. Check for stuck jobs
5. Review queue monitoring dashboard

**Runbook:** [Queue Backlog](https://docs.findmeahotlead.com/runbooks/queue-backlog)

---

### 4. DLQSizeHigh

**Severity:** Critical  
**Component:** Queue System  
**Threshold:** DLQ size > 100 for 5 minutes

**Query:**
```promql
fmhl_dlq_size > 100
```

**What It Means:**
Many jobs are failing and ending up in the dead letter queue. This indicates a systemic issue.

**Actions:**
1. Review DLQ entries immediately
2. Check error patterns
3. Identify root cause
4. Retry jobs if issue is resolved
5. Escalate to on-call engineer

**Runbook:** [DLQ Size](https://docs.findmeahotlead.com/runbooks/dlq-size)

---

### 5. InboxQuerySlow

**Severity:** Warning  
**Component:** Provider Dashboard  
**Threshold:** P95 duration > 1000ms for 5 minutes

**Query:**
```promql
histogram_quantile(0.95, fmhl_inbox_query_duration_ms) > 1000
```

**What It Means:**
Provider inbox queries are slow, affecting user experience.

**Actions:**
1. Check database query performance
2. Review query execution plans
3. Check for missing indexes
4. Review query complexity
5. Consider caching

**Runbook:** [Inbox Slow](https://docs.findmeahotlead.com/runbooks/inbox-slow)

---

### 6. JobFailureRateHigh

**Severity:** Warning  
**Component:** Queue System  
**Threshold:** Failure rate > 5% for 10 minutes

**Query:**
```promql
rate(fmhl_jobs_failed_total[5m]) / rate(fmhl_jobs_enqueued_total[5m]) > 0.05
```

**What It Means:**
A significant portion of jobs are failing, indicating a problem with job processing.

**Actions:**
1. Review failed job logs
2. Check DLQ for patterns
3. Verify dependencies (DB, Redis, external APIs)
4. Review recent code deployments
5. Check worker health

**Runbook:** [Job Failures](https://docs.findmeahotlead.com/runbooks/job-failures)

---

### 7. HealthCheckFailing

**Severity:** Critical  
**Component:** Infrastructure  
**Threshold:** Health check down for 2 minutes

**Query:**
```promql
up{job="web"} == 0
```

**What It Means:**
The application health check endpoint is not responding, indicating the service may be down.

**Actions:**
1. Check application process status
2. Verify database connectivity
3. Check Redis connectivity
4. Review application logs
5. Escalate to on-call engineer immediately

**Runbook:** [Health Check](https://docs.findmeahotlead.com/runbooks/health-check)

---

## Alert Channels

### Warning Alerts
- **Channel:** Slack (#alerts-warning)
- **Notification:** Immediate
- **Escalation:** None

### Critical Alerts
- **Channel:** PagerDuty
- **Notification:** Immediate
- **Escalation:** On-call engineer rotation

---

## Alert Suppression

Alerts can be temporarily suppressed via Prometheus alertmanager configuration for:
- Planned maintenance windows
- Known issues being worked on
- False positives

---

## Alert Testing

To test alerts:
1. Use Prometheus alert testing endpoint
2. Manually trigger alert conditions
3. Verify alert delivery to channels
4. Confirm runbook accessibility

---

**Maintained By:** DevOps Team  
**Review Frequency:** Monthly

