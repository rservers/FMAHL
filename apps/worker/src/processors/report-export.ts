/**
 * Report Export Job Processor for EPIC 11
 * 
 * Handles async export of reports to CSV/XLSX format
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { Job } from 'bullmq'
import { sql } from '@repo/database'
import { getRedis } from '../lib/redis'
import { EXPORT_MAX_ROWS, EXPORT_FILE_RETENTION_HOURS, EXPORT_URL_TTL_HOURS } from '../lib/config'

interface ReportExportJobData {
  job_id: string
  requested_by: string
  actor_role: 'admin' | 'provider'
  scope: 'admin' | 'provider'
  type: string
  filters: Record<string, any>
  format: 'csv' | 'xlsx'
}

export async function processReportExport(job: Job<ReportExportJobData>) {
  const { job_id, requested_by, actor_role, scope, type, filters, format } = job.data

  console.log(`[ReportExport] Processing job ${job_id} - type: ${type}, scope: ${scope}`)

  try {
    // Update job status to processing
    await sql`
      UPDATE report_export_jobs
      SET status = 'processing', updated_at = NOW()
      WHERE id = ${job_id}
    `

    // Generate report data based on type
    let data: any[]
    let headers: string[]

    switch (type) {
      case 'kpis':
        ({ data, headers } = await exportKPIs(scope, filters))
        break
      case 'funnel':
        ({ data, headers } = await exportFunnel(filters))
        break
      case 'revenue':
        ({ data, headers } = await exportRevenue(filters))
        break
      case 'fairness':
        ({ data, headers } = await exportFairness(filters))
        break
      case 'bad_leads':
        ({ data, headers } = await exportBadLeads(scope, filters))
        break
      case 'assigned_leads':
        ({ data, headers } = await exportAssignedLeads(requested_by, filters))
        break
      case 'distribution_metrics':
        ({ data, headers } = await exportDistributionMetrics(filters))
        break
      default:
        throw new Error(`Unknown export type: ${type}`)
    }

    // Check row limit
    if (data.length > EXPORT_MAX_ROWS) {
      throw new Error(`Export exceeds maximum row limit of ${EXPORT_MAX_ROWS}`)
    }

    // Generate CSV (XLSX support can be added later)
    const csv = generateCSV(headers, data)

    // Store in S3 or local storage (simplified for MVP)
    const artifactPath = await storeExportFile(job_id, csv, format)

    // Generate signed URL (simplified - using Redis for now)
    const downloadUrl = await generateDownloadUrl(job_id, artifactPath)

    // Calculate expiration times
    const downloadExpiresAt = new Date(Date.now() + EXPORT_URL_TTL_HOURS * 60 * 60 * 1000)
    const fileExpiresAt = new Date(Date.now() + EXPORT_FILE_RETENTION_HOURS * 60 * 60 * 1000)

    // Update job status to completed
    await sql`
      UPDATE report_export_jobs
      SET 
        status = 'completed',
        row_count = ${data.length},
        artifact_path = ${artifactPath},
        download_expires_at = ${downloadExpiresAt.toISOString()},
        file_expires_at = ${fileExpiresAt.toISOString()},
        updated_at = NOW()
      WHERE id = ${job_id}
    `

    console.log(`[ReportExport] Completed job ${job_id} - ${data.length} rows exported`)

    return { success: true, row_count: data.length, download_url: downloadUrl }
  } catch (error) {
    console.error(`[ReportExport] Failed job ${job_id}:`, error)

    // Update job status to failed
    await sql`
      UPDATE report_export_jobs
      SET 
        status = 'failed',
        error = ${error instanceof Error ? error.message : 'Unknown error'},
        updated_at = NOW()
      WHERE id = ${job_id}
    `

    throw error
  }
}

// Export functions for each report type

async function exportKPIs(scope: string, filters: Record<string, any>) {
  const { date_from, date_to } = filters
  const fromDate = date_from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const toDate = date_to || new Date().toISOString()

  // Simplified KPI export - returns aggregated metrics
  const headers = ['metric', 'value']
  const data = [
    { metric: 'period_from', value: fromDate },
    { metric: 'period_to', value: toDate },
    // Add actual KPI calculations here
  ]

  return { data, headers }
}

async function exportFunnel(filters: Record<string, any>) {
  const { date_from, date_to, bucket, niche_id } = filters
  const fromDate = date_from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const toDate = date_to || new Date().toISOString()

  const headers = ['date', 'submitted', 'confirmed', 'approved', 'distributed']
  
  // Query funnel data (simplified)
  const data = await sql`
    SELECT 
      DATE(submitted_at) as date,
      COUNT(*) as submitted,
      COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL) as confirmed,
      COUNT(*) FILTER (WHERE approved_at IS NOT NULL) as approved,
      COUNT(*) FILTER (WHERE distributed_at IS NOT NULL) as distributed
    FROM leads
    WHERE submitted_at >= ${fromDate}
      AND submitted_at <= ${toDate}
      AND deleted_at IS NULL
      ${niche_id ? sql`AND niche_id = ${niche_id}` : sql``}
    GROUP BY DATE(submitted_at)
    ORDER BY DATE(submitted_at)
  `

  return { data, headers }
}

async function exportRevenue(filters: Record<string, any>) {
  const { date_from, date_to } = filters
  const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const toDate = date_to || new Date().toISOString()

  const headers = ['date', 'deposits', 'lead_purchases', 'refunds', 'net_revenue']
  
  const data = await sql`
    SELECT 
      DATE(created_at) as date,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'deposit'), 0) as deposits,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'lead_purchase'), 0) as lead_purchases,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'refund'), 0) as refunds,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'lead_purchase'), 0) - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'refund'), 0) as net_revenue
    FROM provider_ledger
    WHERE created_at >= ${fromDate}
      AND created_at <= ${toDate}
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  `

  return { data, headers }
}

async function exportFairness(filters: Record<string, any>) {
  const { niche_id, competition_level_id } = filters
  const thresholdDays = 7
  const thresholdDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString()

  const headers = ['provider_id', 'provider_name', 'niche', 'competition_level', 'last_received_at', 'days_since_last_lead']
  
  let query = sql`
    SELECT 
      cls.provider_id,
      u.first_name || ' ' || u.last_name as provider_name,
      n.name as niche,
      cl.name as competition_level,
      cls.last_received_at,
      CASE 
        WHEN cls.last_received_at IS NULL THEN NULL
        ELSE EXTRACT(EPOCH FROM (NOW() - cls.last_received_at)) / 86400
      END as days_since_last_lead
    FROM competition_level_subscriptions cls
    JOIN providers p ON cls.provider_id = p.id
    JOIN users u ON p.user_id = u.id
    JOIN niches n ON cls.niche_id = n.id
    JOIN competition_levels cl ON cls.competition_level_id = cl.id
    WHERE cls.deleted_at IS NULL
      AND cls.is_active = true
      AND (cls.last_received_at IS NULL OR cls.last_received_at < ${thresholdDate})
  `

  if (niche_id) {
    query = sql`${query} AND cls.niche_id = ${niche_id}`
  }

  if (competition_level_id) {
    query = sql`${query} AND cls.competition_level_id = ${competition_level_id}`
  }

  const data = await query

  return { data, headers }
}

async function exportBadLeads(scope: string, filters: Record<string, any>) {
  const { date_from, date_to, provider_id } = filters
  const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const toDate = date_to || new Date().toISOString()

  const headers = ['lead_id', 'provider_id', 'provider_name', 'reported_at', 'reason_category', 'status', 'refund_amount']
  
  let query = sql`
    SELECT 
      la.lead_id,
      la.provider_id,
      u.first_name || ' ' || u.last_name as provider_name,
      la.bad_lead_reported_at as reported_at,
      la.bad_lead_reason_category as reason_category,
      la.bad_lead_status as status,
      la.refund_amount
    FROM lead_assignments la
    JOIN providers p ON la.provider_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE la.bad_lead_reported_at IS NOT NULL
      AND la.bad_lead_reported_at >= ${fromDate}
      AND la.bad_lead_reported_at <= ${toDate}
  `

  if (scope === 'provider' && provider_id) {
    query = sql`${query} AND la.provider_id = ${provider_id}`
  }

  query = sql`${query} ORDER BY la.bad_lead_reported_at DESC`

  const data = await query

  return { data, headers }
}

async function exportAssignedLeads(requested_by: string, filters: Record<string, any>) {
  const { date_from, date_to, status } = filters
  const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const toDate = date_to || new Date().toISOString()

  // Get provider ID
  const [provider] = await sql`
    SELECT id FROM providers WHERE user_id = ${requested_by}
  `

  if (!provider) {
    throw new Error('Provider not found')
  }

  const headers = ['lead_id', 'assigned_at', 'status', 'viewed_at', 'accepted_at', 'rejected_at', 'price']
  
  let query = sql`
    SELECT 
      la.lead_id,
      la.assigned_at,
      CASE 
        WHEN la.accepted_at IS NOT NULL THEN 'accepted'
        WHEN la.rejected_at IS NOT NULL THEN 'rejected'
        ELSE 'pending'
      END as status,
      la.viewed_at,
      la.accepted_at,
      la.rejected_at,
      la.price
    FROM lead_assignments la
    WHERE la.provider_id = ${provider.id}
      AND la.assigned_at >= ${fromDate}
      AND la.assigned_at <= ${toDate}
  `

  if (status) {
    if (status === 'accepted') {
      query = sql`${query} AND la.accepted_at IS NOT NULL`
    } else if (status === 'rejected') {
      query = sql`${query} AND la.rejected_at IS NOT NULL`
    } else if (status === 'pending') {
      query = sql`${query} AND la.accepted_at IS NULL AND la.rejected_at IS NULL`
    }
  }

  query = sql`${query} ORDER BY la.assigned_at DESC`

  const data = await query

  return { data, headers }
}

async function exportDistributionMetrics(filters: Record<string, any>) {
  const { date_from, date_to, niche_id } = filters
  const fromDate = date_from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const toDate = date_to || new Date().toISOString()

  const headers = ['date', 'total_distributed', 'avg_providers_per_lead', 'avg_distribution_time_seconds']
  
  let query = sql`
    SELECT 
      DATE(l.distributed_at) as date,
      COUNT(DISTINCT l.id) as total_distributed,
      AVG(provider_count) as avg_providers_per_lead,
      AVG(EXTRACT(EPOCH FROM (l.distributed_at - l.approved_at))) as avg_distribution_time_seconds
    FROM leads l
    LEFT JOIN (
      SELECT lead_id, COUNT(*) as provider_count
      FROM lead_assignments
      GROUP BY lead_id
    ) la ON l.id = la.lead_id
    WHERE l.distributed_at >= ${fromDate}
      AND l.distributed_at <= ${toDate}
      AND l.deleted_at IS NULL
  `

  if (niche_id) {
    query = sql`${query} AND l.niche_id = ${niche_id}`
  }

  query = sql`${query} GROUP BY DATE(l.distributed_at) ORDER BY DATE(l.distributed_at)`

  const data = await query

  return { data, headers }
}

// Utility functions

function generateCSV(headers: string[], data: any[]): string {
  const rows = [headers.join(',')]
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]
      if (value === null || value === undefined) return ''
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return String(value)
    })
    rows.push(values.join(','))
  }
  
  return rows.join('\n')
}

async function storeExportFile(jobId: string, content: string, format: string): Promise<string> {
  // For MVP, store in Redis with expiration
  // In production, use S3 or similar object storage
  const redis = getRedis()
  const key = `export:file:${jobId}`
  
  await redis.setex(key, EXPORT_FILE_RETENTION_HOURS * 60 * 60, content)
  
  return key
}

async function generateDownloadUrl(jobId: string, artifactPath: string): Promise<string> {
  // For MVP, return a simple URL
  // In production, generate signed S3 URL
  return `/api/v1/exports/${jobId}/download`
}

