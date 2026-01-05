/**
 * GET /api/v1/provider/reports/kpis
 * 
 * Provider KPI Dashboard
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { providerKPIDashboardQuerySchema } from '@/lib/validations/reports'
import { sql } from '@/lib/db'
import { generateCacheKey, getCachedReport, setCachedReport, shouldBypassCache } from '@/lib/services/report-cache'
import { REPORT_CACHE_TTL_SECONDS } from '@/lib/config/report-config'
import type { ProviderKPIDashboard } from '@/lib/types/reports'

export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      // Parse query parameters
      const url = new URL(request.url)
      const queryParams = {
        date_from: url.searchParams.get('date_from') || undefined,
        date_to: url.searchParams.get('date_to') || undefined,
        group_by: url.searchParams.get('group_by') || 'none',
      }

      // Validate query parameters
      const validationResult = providerKPIDashboardQuerySchema.safeParse(queryParams)
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

      const { date_from, date_to, group_by } = validationResult.data

      // Get provider ID
      const [provider] = await sql`
        SELECT id FROM providers WHERE user_id = ${user.id}
      `

      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }

      const providerId = provider.id

      // Default to last 30 days if not specified
      const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const toDate = date_to || new Date().toISOString()

      // Check cache
      const cacheKey = generateCacheKey('provider', `kpis:${group_by}`, fromDate, toDate, { provider_id: providerId })
      
      if (!shouldBypassCache(url.searchParams)) {
        const cached = await getCachedReport<ProviderKPIDashboard>(cacheKey)
        if (cached) {
          return NextResponse.json(cached)
        }
      }

      // Build query based on group_by
      let kpisQuery
      if (group_by === 'niche') {
        // Group by niche
        kpisQuery = sql`
          SELECT 
            l.niche_id,
            n.name as niche_name,
            COUNT(DISTINCT la.id) as assignments_received,
            COUNT(*) FILTER (WHERE la.accepted_at IS NOT NULL) as accepted_count,
            COUNT(*) FILTER (WHERE la.rejected_at IS NOT NULL) as rejected_count,
            AVG(EXTRACT(EPOCH FROM (la.viewed_at - la.assigned_at)) / 60) FILTER (WHERE la.viewed_at IS NOT NULL) as avg_time_to_view_minutes,
            AVG(EXTRACT(EPOCH FROM (la.accepted_at - la.assigned_at)) / 60) FILTER (WHERE la.accepted_at IS NOT NULL) as avg_time_to_accept_minutes,
            COUNT(*) FILTER (WHERE la.bad_lead_reported_at IS NOT NULL) as bad_lead_reports_count,
            COUNT(*) FILTER (WHERE la.bad_lead_status = 'approved') as bad_lead_approved_count,
            COALESCE(SUM(la.refund_amount), 0) as refunds_amount,
            COALESCE(SUM(pl.amount) FILTER (WHERE pl.entry_type = 'lead_purchase'), 0) as lead_purchases,
            COALESCE(SUM(la.refund_amount), 0) as refunds_total
          FROM lead_assignments la
          JOIN leads l ON la.lead_id = l.id
          JOIN niches n ON l.niche_id = n.id
          LEFT JOIN provider_ledger pl ON pl.provider_id = la.provider_id 
            AND pl.related_lead_id = la.lead_id
            AND pl.created_at >= ${fromDate}
            AND pl.created_at <= ${toDate}
          WHERE la.provider_id = ${providerId}
            AND la.assigned_at >= ${fromDate}
            AND la.assigned_at <= ${toDate}
            AND l.deleted_at IS NULL
          GROUP BY l.niche_id, n.name
          ORDER BY n.name
        `
      } else {
        // Aggregate across all niches
        kpisQuery = sql`
          SELECT 
            COUNT(DISTINCT la.id) as assignments_received,
            COUNT(*) FILTER (WHERE la.accepted_at IS NOT NULL) as accepted_count,
            COUNT(*) FILTER (WHERE la.rejected_at IS NOT NULL) as rejected_count,
            AVG(EXTRACT(EPOCH FROM (la.viewed_at - la.assigned_at)) / 60) FILTER (WHERE la.viewed_at IS NOT NULL) as avg_time_to_view_minutes,
            AVG(EXTRACT(EPOCH FROM (la.accepted_at - la.assigned_at)) / 60) FILTER (WHERE la.accepted_at IS NOT NULL) as avg_time_to_accept_minutes,
            COUNT(*) FILTER (WHERE la.bad_lead_reported_at IS NOT NULL) as bad_lead_reports_count,
            COUNT(*) FILTER (WHERE la.bad_lead_status = 'approved') as bad_lead_approved_count,
            COALESCE(SUM(la.refund_amount), 0) as refunds_amount,
            COALESCE(SUM(pl.amount) FILTER (WHERE pl.entry_type = 'lead_purchase'), 0) as lead_purchases,
            COALESCE(SUM(la.refund_amount), 0) as refunds_total
          FROM lead_assignments la
          JOIN leads l ON la.lead_id = l.id
          LEFT JOIN provider_ledger pl ON pl.provider_id = la.provider_id 
            AND pl.related_lead_id = la.lead_id
            AND pl.created_at >= ${fromDate}
            AND pl.created_at <= ${toDate}
          WHERE la.provider_id = ${providerId}
            AND la.assigned_at >= ${fromDate}
            AND la.assigned_at <= ${toDate}
            AND l.deleted_at IS NULL
        `
      }

      const kpis = await kpisQuery

      const processKpiRow = (kpi: any) => {
        const assignmentsReceived = Number(kpi.assignments_received) || 0
        const acceptedCount = Number(kpi.accepted_count) || 0
        const rejectedCount = Number(kpi.rejected_count) || 0
        const acceptanceRate = assignmentsReceived > 0 ? acceptedCount / assignmentsReceived : 0
        const rejectionRate = assignmentsReceived > 0 ? rejectedCount / assignmentsReceived : 0
        const leadPurchases = Number(kpi.lead_purchases) || 0
        const refundsTotal = Number(kpi.refunds_total) || 0
        const netSpend = leadPurchases - refundsTotal

        return {
          niche_id: kpi.niche_id,
          niche_name: kpi.niche_name,
          assignments_received: assignmentsReceived,
          acceptance_rate: acceptanceRate,
          rejection_rate: rejectionRate,
          avg_time_to_view_minutes: Number(kpi.avg_time_to_view_minutes) || 0,
          avg_time_to_accept_minutes: Number(kpi.avg_time_to_accept_minutes) || 0,
          bad_lead_reports_count: Number(kpi.bad_lead_reports_count) || 0,
          bad_lead_approved_count: Number(kpi.bad_lead_approved_count) || 0,
          refunds_amount: refundsTotal,
          net_spend: netSpend,
        }
      }

      const response: ProviderKPIDashboard = {
        period: { from: fromDate, to: toDate },
        group_by,
        kpis: Array.isArray(kpis) 
          ? kpis.map(processKpiRow)
          : [processKpiRow(kpis)],
      }

      // Cache response
      await setCachedReport(cacheKey, response, REPORT_CACHE_TTL_SECONDS)

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching provider KPIs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch provider KPIs' },
        { status: 500 }
      )
    }
  }, { allowedRoles: ['provider'] })
}

