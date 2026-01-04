/**
 * GET /api/v1/admin/bad-leads/metrics
 * 
 * Admin metrics for bad lead reporting and refunds
 * 
 * @see .cursor/docs/Delivery/Epic_09_Bad_Lead_Refunds.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { adminMetricsQuerySchema } from '@/lib/validations/bad-leads'
import { sql } from '@/lib/db'
import { getRedis } from '@/lib/redis'
import type { BadLeadMetrics } from '@/lib/types/bad-leads'

export async function GET(request: NextRequest) {
  return adminWithMFA(async () => {
    try {
      // Parse query parameters
      const url = new URL(request.url)
      const queryParams = {
        date_from: url.searchParams.get('date_from') || undefined,
        date_to: url.searchParams.get('date_to') || undefined,
        niche_id: url.searchParams.get('niche_id') || undefined,
        provider_id: url.searchParams.get('provider_id') || undefined,
      }

      // Validate query parameters
      const validationResult = adminMetricsQuerySchema.safeParse(queryParams)
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

      const { date_from, date_to, niche_id, provider_id } = validationResult.data

      // Default to last 30 days if not specified
      const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const toDate = date_to || new Date().toISOString()

      // Check cache
      const redis = getRedis()
      const cacheKey = `bad_lead_metrics:${fromDate}:${toDate}:${niche_id || 'all'}:${provider_id || 'all'}`
      const cached = await redis.get(cacheKey)
      
      if (cached) {
        return NextResponse.json(JSON.parse(cached))
      }

      // Build base WHERE conditions
      let whereConditions = sql`
        WHERE la.bad_lead_reported_at >= ${fromDate}
          AND la.bad_lead_reported_at <= ${toDate}
      `

      if (niche_id) {
        whereConditions = sql`${whereConditions} AND l.niche_id = ${niche_id}`
      }

      if (provider_id) {
        whereConditions = sql`${whereConditions} AND la.provider_id = ${provider_id}`
      }

      // Get summary metrics
      const [summary] = await sql`
        SELECT 
          COUNT(*) as total_reports,
          COUNT(*) FILTER (WHERE la.bad_lead_status = 'approved') as total_approved,
          COUNT(*) FILTER (WHERE la.bad_lead_status = 'rejected') as total_rejected,
          COALESCE(SUM(la.refund_amount), 0) as total_refund_amount,
          AVG(EXTRACT(EPOCH FROM (COALESCE(la.refunded_at, la.updated_at) - la.bad_lead_reported_at)) / 3600) FILTER (WHERE la.bad_lead_status IN ('approved', 'rejected')) as avg_resolution_time_hours
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        ${whereConditions}
      `

      const totalReports = Number(summary.total_reports)
      const totalApproved = Number(summary.total_approved)
      const totalRejected = Number(summary.total_rejected)
      const approvalRate = totalReports > 0 ? totalApproved / totalReports : 0

      // Get breakdown by reason category
      const byReason = await sql`
        SELECT 
          la.bad_lead_reason_category,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE la.bad_lead_status = 'approved') as approved_count
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        ${whereConditions}
          AND la.bad_lead_reason_category IS NOT NULL
        GROUP BY la.bad_lead_reason_category
        ORDER BY count DESC
      `

      // Get breakdown by provider with abuse flags
      const byProvider = await sql`
        SELECT 
          la.provider_id,
          u.first_name || ' ' || u.last_name as provider_name,
          COUNT(*) as total_reports,
          COUNT(*) FILTER (WHERE la.bad_lead_status = 'approved') as approved_count,
          COALESCE(SUM(la.refund_amount), 0) as total_refund_amount
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        JOIN providers p ON la.provider_id = p.id
        JOIN users u ON p.user_id = u.id
        ${whereConditions}
        GROUP BY la.provider_id, u.first_name, u.last_name
        ORDER BY total_reports DESC
        LIMIT 50
      `

      const metrics: BadLeadMetrics = {
        period: { from: fromDate, to: toDate },
        summary: {
          total_reports: totalReports,
          total_approved: totalApproved,
          total_rejected: totalRejected,
          approval_rate: approvalRate,
          total_refund_amount: Number(summary.total_refund_amount),
          avg_resolution_time_hours: summary.avg_resolution_time_hours ? Number(summary.avg_resolution_time_hours) : 0,
        },
        by_reason: byReason.map((row: any) => ({
          reason_category: row.bad_lead_reason_category,
          count: Number(row.count),
          approval_rate: Number(row.count) > 0 ? Number(row.approved_count) / Number(row.count) : 0,
        })),
        by_provider: byProvider.map((row: any) => {
          const providerReports = Number(row.total_reports)
          const providerApproved = Number(row.approved_count)
          const providerApprovalRate = providerReports > 0 ? providerApproved / providerReports : 0
          
          // Abuse flag: >50% approval rate over 30 days OR >20% of assignments refunded
          const flagged = providerApprovalRate > 0.5 || (providerReports / totalReports) > 0.2

          return {
            provider_id: row.provider_id,
            provider_name: row.provider_name || 'Unknown',
            total_reports: providerReports,
            approval_rate: providerApprovalRate,
            total_refund_amount: Number(row.total_refund_amount),
            flagged,
          }
        }),
      }

      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(metrics))

      return NextResponse.json(metrics)
    } catch (error) {
      console.error('Error fetching bad lead metrics:', error)
      return NextResponse.json(
        { error: 'Failed to fetch metrics' },
        { status: 500 }
      )
    }
  })(request)
}

