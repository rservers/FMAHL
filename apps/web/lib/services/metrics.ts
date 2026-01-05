/**
 * Prometheus Metrics Service for EPIC 12
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client'

// Create a registry
export const register = new Registry()

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register })

// Application Counters
export const leadsSubmittedTotal = new Counter({
  name: 'fmhl_leads_submitted_total',
  help: 'Total number of leads submitted',
  registers: [register],
})

export const leadsApprovedTotal = new Counter({
  name: 'fmhl_leads_approved_total',
  help: 'Total number of leads approved',
  registers: [register],
})

export const assignmentsCreatedTotal = new Counter({
  name: 'fmhl_assignments_created_total',
  help: 'Total number of lead assignments created',
  registers: [register],
})

export const assignmentsSkippedInsufficientBalanceTotal = new Counter({
  name: 'fmhl_assignments_skipped_insufficient_balance_total',
  help: 'Total number of assignments skipped due to insufficient balance',
  registers: [register],
})

export const badLeadsReportedTotal = new Counter({
  name: 'fmhl_bad_leads_reported_total',
  help: 'Total number of bad leads reported',
  registers: [register],
})

export const refundsApprovedTotal = new Counter({
  name: 'fmhl_refunds_approved_total',
  help: 'Total number of refunds approved',
  registers: [register],
})

// Histograms (latency tracking)
export const distributionDurationMs = new Histogram({
  name: 'fmhl_distribution_duration_ms',
  help: 'Distribution job duration in milliseconds',
  buckets: [100, 500, 1000, 2000, 5000, 10000],
  registers: [register],
})

export const inboxQueryDurationMs = new Histogram({
  name: 'fmhl_inbox_query_duration_ms',
  help: 'Provider inbox query duration in milliseconds',
  buckets: [50, 100, 200, 500, 1000, 2000],
  registers: [register],
})

export const billingOperationDurationMs = new Histogram({
  name: 'fmhl_billing_operation_duration_ms',
  help: 'Billing operation duration in milliseconds',
  buckets: [50, 100, 200, 500, 1000, 2000],
  registers: [register],
})

export const httpRequestDurationMs = new Histogram({
  name: 'fmhl_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [register],
})

// Queue Metrics
export const jobsEnqueuedTotal = new Counter({
  name: 'fmhl_jobs_enqueued_total',
  help: 'Total number of jobs enqueued',
  labelNames: ['queue'],
  registers: [register],
})

export const jobsCompletedTotal = new Counter({
  name: 'fmhl_jobs_completed_total',
  help: 'Total number of jobs completed',
  labelNames: ['queue'],
  registers: [register],
})

export const jobsFailedTotal = new Counter({
  name: 'fmhl_jobs_failed_total',
  help: 'Total number of jobs failed',
  labelNames: ['queue'],
  registers: [register],
})

export const jobDurationMs = new Histogram({
  name: 'fmhl_job_duration_ms',
  help: 'Job duration in milliseconds',
  labelNames: ['queue'],
  buckets: [100, 500, 1000, 2000, 5000, 10000, 30000],
  registers: [register],
})

export const queueDepth = new Gauge({
  name: 'fmhl_queue_depth',
  help: 'Current queue depth',
  labelNames: ['queue'],
  registers: [register],
})

export const dlqSize = new Gauge({
  name: 'fmhl_dlq_size',
  help: 'Current dead letter queue size',
  labelNames: ['queue'],
  registers: [register],
})

