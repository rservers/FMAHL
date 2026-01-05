/**
 * GET /api/v1/admin/reports/kpis
 * 
 * Admin Platform KPI Dashboard
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { adminKPIDashboardQuerySchema } from '@/lib/validations/reports'
import { sql } from '@/lib/db'
import { generateCacheKey, getCachedReport, setCachedReport, shouldBypassCache } from '@/lib/services/report-cache'
import { REPORT_CACHE_TTL_SECONDS } from '@/lib/config/report-config'
import type { AdminKPIDashboard } from '@/lib/types/reports'

export async function GET(request: NextRequest) {
  return adminWithMFA(async () => {
    try {
      // Parse query parameters
      const url = new URL(request.url)
      const queryParams = {
        date_from: url.searchParams.get('date_from') || undefined,
        date_to: url.searchParams.get('date_to') || undefined,
      }

      // Validate query parameters
      const validationResult = adminKPIDashboardQuerySchema.safeParse(queryParams)
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

      const { date_from, date_to } = validationResult.data

      // Default to last 7 days if not specified
      const fromDate = date_from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const toDate = date_to || new Date().toISOString()

      // Check cache
      const cacheKey = generateCacheKey('admin', 'kpis', fromDate, toDate)
      
      if (!shouldBypassCache(url.searchParams)) {
        const cached = await getCachedReport<AdminKPIDashboard>(cacheKey)
        if (cached) {
          return NextResponse.json(cached)
        }
      }

      // Get KPI aggregations
      const [leadsStats] = await sql`
        SELECT 
          COUNT(*) FILTER (WHERE submitted_at >= ${fromDate} AND submitted_at <= ${toDate}) as total_submitted,
          COUNT(*) FILTER (WHERE confirmed_at >= ${fromDate} AND confirmed_at <= ${toDate}) as total_confirmed,
          COUNT(*) FILTER (WHERE approved_at >= ${fromDate} AND approved_at <= ${toDate}) as total_approved,
          COUNT(*) FILTER (WHERE rejected_at >= ${fromDate} AND rejected_at <= ${toDate}) as total_rejected,
          AVG(EXTRACT(EPOCH FROM (confirmed_at - submitted_at)) / 60) FILTER (WHERE confirmed_at >= ${fromDate} AND confirmed_at <= ${toDate}) as avg_confirmation_minutes,
          AVG(EXTRACT(EPOCH FROM (approved_at - confirmed_at)) / 3600) FILTER (WHERE approved_at >= ${fromDate} AND approved_at <= ${toDate}) as avg_approval_hours
        FROM leads
        WHERE deleted_at IS NULL
      `

      const [distributionStats] = await sql`
        SELECT 
          COUNT(*) FILTER (WHERE distributed_at >= ${fromDate} AND distributed_at <= ${toDate}) as total_distributed,
          AVG(EXTRACT(EPOCH FROM (distributed_at - approved_at)) / 60) FILTER (WHERE distributed_at >= ${fromDate} AND distributed_at <= ${toDate}) as avg_distribution_minutes
        FROM leads
        WHERE deleted_at IS NULL
          AND approved_at IS NOT NULL
      `

      const [revenueStats] = await sql`
        SELECT 
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'lead_purchase' AND created_at >= ${fromDate} AND created_at <= ${toDate}), 0) as total_revenue,
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'refund' AND created_at >= ${fromDate} AND created_at <= ${toDate}), 0) as total_refunds
        FROM provider_ledger
      `

      const [badLeadStats] = await sql`
        SELECT 
          COUNT(*) FILTER (WHERE bad_lead_reported_at >= ${fromDate} AND bad_lead_reported_at <= ${toDate}) as total_reports,
          COUNT(*) FILTER (WHERE bad_lead_status = 'approved' AND bad_lead_reported_at >= ${fromDate} AND bad_lead_reported_at <= ${toDate}) as total_approved
        FROM lead_assignments
        WHERE bad_lead_reported_at IS NOT NULL
      `

      const [rejectionReasons] = await sql`
        SELECT 
          rejection_reason,
          COUNT(*) as count
        FROM leads
        WHERE rejected_at >= ${fromDate}
          AND rejected_at <= ${toDate}
          AND rejection_reason IS NOT NULL
        GROUP BY rejection_reason
        ORDER BY count DESC
        LIMIT 10
      `

      const totalSubmitted = Number(leadsStats.total_submitted) || 0
      const totalConfirmed = Number(leadsStats.total_confirmed) || 0
      const totalApproved = Number(leadsStats.total_approved) || 0
      const totalRejected = Number(leadsStats.total_rejected) || 0
      const totalDistributed = Number(distributionStats.total_distributed) || 0
      const totalAssignments = await sql`
        SELECT COUNT(*) as count
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        WHERE l.distributed_at >= ${fromDate}
          AND l.distributed_at <= ${toDate}
      `.then(([r]) => Number(r.count) || 0)

      const confirmationRate = totalSubmitted > 0 ? totalConfirmed / totalSubmitted : 0
      const approvalRate = totalConfirmed > 0 ? totalApproved / totalConfirmed : 0
      const distributionRate = totalApproved > 0 ? totalDistributed / totalApproved : 0
      const badLeadReportRate = totalAssignments > 0 ? Number(badLeadStats.total_reports) / totalAssignments : 0
      const badLeadApprovalRate = Number(badLeadStats.total_reports) > 0 
        ? Number(badLeadStats.total_approved) / Number(badLeadStats.total_reports) 
        : 0

      const response: AdminKPIDashboard = {
        period: { from: fromDate, to: toDate },
        kpis: {
          total_leads_submitted: totalSubmitted,
          total_leads_confirmed: totalConfirmed,
          total_leads_approved: totalApproved,
          total_leads_rejected: totalRejected,
          total_leads_distributed: totalDistributed,
          confirmation_rate: confirmationRate,
          approval_rate: approvalRate,
          distribution_rate: distributionRate,
          avg_time_to_confirmation_minutes: Number(leadsStats.avg_confirmation_minutes) || 0,
          avg_time_to_approval_hours: Number(leadsStats.avg_approval_hours) || 0,
          avg_time_to_distribution_minutes: Number(distributionStats.avg_distribution_minutes) || 0,
          total_revenue: Number(revenueStats.total_revenue) || 0,
          total_refunds: Number(revenueStats.total_refunds) || 0,
          net_revenue: (Number(revenueStats.total_revenue) || 0) - (Number(revenueStats.total_refunds) || 0),
          bad_lead_report_rate: badLeadReportRate,
          bad_lead_approval_rate: badLeadApprovalRate,
          top_rejection_reasons: rejectionReasons.map((r: any) => ({
            reason: r.rejection_reason,
            count: Number(r.count),
          })),
        },
      }

      // Cache response
      await setCachedReport(cacheKey, response, REPORT_CACHE_TTL_SECONDS)

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching KPI dashboard:', error)
      return NextResponse.json(
        { error: 'Failed to fetch KPI dashboard' },
        { status: 500 }
      )
    }
  })(request)
}

