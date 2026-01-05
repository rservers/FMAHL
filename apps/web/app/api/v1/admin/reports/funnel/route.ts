/**
 * GET /api/v1/admin/reports/funnel
 * 
 * Funnel Analytics (Time Series)
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { funnelQuerySchema } from '@/lib/validations/reports'
import { sql } from '@/lib/db'
import { generateCacheKey, getCachedReport, setCachedReport, shouldBypassCache } from '@/lib/services/report-cache'
import { REPORT_CACHE_TTL_SECONDS } from '@/lib/config/report-config'
import type { FunnelSeries } from '@/lib/types/reports'

export async function GET(request: NextRequest) {
  return adminWithMFA(async () => {
    try {
      // Parse query parameters
      const url = new URL(request.url)
      const queryParams = {
        date_from: url.searchParams.get('date_from') || undefined,
        date_to: url.searchParams.get('date_to') || undefined,
        bucket: url.searchParams.get('bucket') || 'day',
        niche_id: url.searchParams.get('niche_id') || undefined,
      }

      // Validate query parameters
      const validationResult = funnelQuerySchema.safeParse(queryParams)
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validationResult.error.issues.map((e) => ({
              field: String(e.path.join('.')),
              message: e.message,
            })),
          },
          { status: 400 }
        )
      }

      const { date_from, date_to, bucket, niche_id } = validationResult.data

      // Default to last 7 days if not specified
      const fromDate = date_from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const toDate = date_to || new Date().toISOString()

      // Check cache
      const cacheKey = generateCacheKey('admin', `funnel:${bucket}`, fromDate, toDate, { niche_id: niche_id || null })
      
      if (!shouldBypassCache(url.searchParams)) {
        const cached = await getCachedReport<FunnelSeries>(cacheKey)
        if (cached) {
          return NextResponse.json(cached)
        }
      }

      // Build time series query based on bucket
      const dateFormat = bucket === 'hour' 
        ? "TO_CHAR(date_bucket, 'YYYY-MM-DD HH24:00:00')"
        : "TO_CHAR(date_bucket, 'YYYY-MM-DD')"

      let seriesQuery
      if (niche_id) {
        // Single niche funnel
        seriesQuery = sql`
          WITH date_series AS (
            SELECT generate_series(
              DATE_TRUNC(${bucket === 'hour' ? 'hour' : 'day'}, ${fromDate}::timestamptz),
              DATE_TRUNC(${bucket === 'hour' ? 'hour' : 'day'}, ${toDate}::timestamptz),
              ${bucket === 'hour' ? "INTERVAL '1 hour'" : "INTERVAL '1 day'"}
            ) as date_bucket
          )
          SELECT 
            ${sql.unsafe(dateFormat)} as date,
            COUNT(*) FILTER (WHERE l.submitted_at IS NOT NULL AND l.submitted_at >= date_bucket AND l.submitted_at < date_bucket + ${bucket === 'hour' ? "INTERVAL '1 hour'" : "INTERVAL '1 day'"}) as submitted,
            COUNT(*) FILTER (WHERE l.confirmed_at IS NOT NULL AND l.confirmed_at >= date_bucket AND l.confirmed_at < date_bucket + ${bucket === 'hour' ? "INTERVAL '1 hour'" : "INTERVAL '1 day'"}) as confirmed,
            COUNT(*) FILTER (WHERE l.approved_at IS NOT NULL AND l.approved_at >= date_bucket AND l.approved_at < date_bucket + ${bucket === 'hour' ? "INTERVAL '1 hour'" : "INTERVAL '1 day'"}) as approved,
            COUNT(*) FILTER (WHERE l.distributed_at IS NOT NULL AND l.distributed_at >= date_bucket AND l.distributed_at < date_bucket + ${bucket === 'hour' ? "INTERVAL '1 hour'" : "INTERVAL '1 day'"}) as distributed
          FROM date_series
          LEFT JOIN leads l ON l.niche_id = ${niche_id} AND l.deleted_at IS NULL
          GROUP BY date_bucket
          ORDER BY date_bucket ASC
        `
      } else {
        // Platform-wide aggregate
        seriesQuery = sql`
          WITH date_series AS (
            SELECT generate_series(
              DATE_TRUNC(${bucket === 'hour' ? 'hour' : 'day'}, ${fromDate}::timestamptz),
              DATE_TRUNC(${bucket === 'hour' ? 'hour' : 'day'}, ${toDate}::timestamptz),
              ${bucket === 'hour' ? "INTERVAL '1 hour'" : "INTERVAL '1 day'"}
            ) as date_bucket
          )
          SELECT 
            ${sql.unsafe(dateFormat)} as date,
            COUNT(*) FILTER (WHERE l.submitted_at IS NOT NULL AND l.submitted_at >= date_bucket AND l.submitted_at < date_bucket + ${bucket === 'hour' ? "INTERVAL '1 hour'" : "INTERVAL '1 day'"}) as submitted,
            COUNT(*) FILTER (WHERE l.confirmed_at IS NOT NULL AND l.confirmed_at >= date_bucket AND l.confirmed_at < date_bucket + ${bucket === 'hour' ? "INTERVAL '1 hour'" : "INTERVAL '1 day'"}) as confirmed,
            COUNT(*) FILTER (WHERE l.approved_at IS NOT NULL AND l.approved_at >= date_bucket AND l.approved_at < date_bucket + ${bucket === 'hour' ? "INTERVAL '1 hour'" : "INTERVAL '1 day'"}) as approved,
            COUNT(*) FILTER (WHERE l.distributed_at IS NOT NULL AND l.distributed_at >= date_bucket AND l.distributed_at < date_bucket + ${bucket === 'hour' ? "INTERVAL '1 hour'" : "INTERVAL '1 day'"}) as distributed
          FROM date_series
          LEFT JOIN leads l ON l.deleted_at IS NULL
          GROUP BY date_bucket
          ORDER BY date_bucket ASC
        `
      }

      const series = await seriesQuery

      const response: FunnelSeries = {
        period: { from: fromDate, to: toDate },
        bucket,
        niche_id: niche_id || null,
        series: series.map((row: any) => ({
          date: row.date,
          submitted: Number(row.submitted) || 0,
          confirmed: Number(row.confirmed) || 0,
          approved: Number(row.approved) || 0,
          distributed: Number(row.distributed) || 0,
        })),
      }

      // Cache response
      await setCachedReport(cacheKey, response, REPORT_CACHE_TTL_SECONDS)

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching funnel analytics:', error)
      return NextResponse.json(
        { error: 'Failed to fetch funnel analytics' },
        { status: 500 }
      )
    }
  })(request)
}

