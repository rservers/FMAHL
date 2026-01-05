/**
 * GET /api/v1/admin/reports/revenue
 * 
 * Revenue & Deposits Summary
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { revenueQuerySchema } from '@/lib/validations/reports'
import { sql } from '@/lib/db'
import { generateCacheKey, getCachedReport, setCachedReport, shouldBypassCache } from '@/lib/services/report-cache'
import { REPORT_CACHE_TTL_SECONDS } from '@/lib/config/report-config'
import type { RevenueSummary } from '@/lib/types/reports'

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
      const validationResult = revenueQuerySchema.safeParse(queryParams)
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

      // Default to last 30 days if not specified
      const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const toDate = date_to || new Date().toISOString()

      // Check cache
      const cacheKey = generateCacheKey('admin', 'revenue', fromDate, toDate)
      
      if (!shouldBypassCache(url.searchParams)) {
        const cached = await getCachedReport<RevenueSummary>(cacheKey)
        if (cached) {
          return NextResponse.json(cached)
        }
      }

      // Aggregate ledger entries
      const [ledgerStats] = await sql`
        SELECT 
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'deposit' AND created_at >= ${fromDate} AND created_at <= ${toDate}), 0) as total_deposits,
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'lead_purchase' AND created_at >= ${fromDate} AND created_at <= ${toDate}), 0) as total_lead_purchases,
          COALESCE(SUM(amount) FILTER (WHERE entry_type = 'refund' AND created_at >= ${fromDate} AND created_at <= ${toDate}), 0) as total_refunds
        FROM provider_ledger
      `

      // Aggregate payments by status
      const paymentBreakdown = await sql`
        SELECT 
          status,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM payments
        WHERE created_at >= ${fromDate}
          AND created_at <= ${toDate}
        GROUP BY status
        ORDER BY status
      `

      // Count provider topups (deposits)
      const [topupsCount] = await sql`
        SELECT COUNT(DISTINCT provider_id) as count
        FROM provider_ledger
        WHERE entry_type = 'deposit'
          AND created_at >= ${fromDate}
          AND created_at <= ${toDate}
      `

      const totalDeposits = Number(ledgerStats.total_deposits) || 0
      const totalLeadPurchases = Number(ledgerStats.total_lead_purchases) || 0
      const totalRefunds = Number(ledgerStats.total_refunds) || 0
      const netRevenue = totalLeadPurchases - totalRefunds

      const response: RevenueSummary = {
        period: { from: fromDate, to: toDate },
        total_deposits: totalDeposits,
        total_lead_purchases: totalLeadPurchases,
        total_refunds: totalRefunds,
        net_revenue: netRevenue,
        payment_status_breakdown: paymentBreakdown.map((p: any) => ({
          status: p.status,
          count: Number(p.count),
          total_amount: Number(p.total_amount),
        })),
        provider_topups_count: Number(topupsCount.count) || 0,
      }

      // Cache response
      await setCachedReport(cacheKey, response, REPORT_CACHE_TTL_SECONDS)

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching revenue summary:', error)
      return NextResponse.json(
        { error: 'Failed to fetch revenue summary' },
        { status: 500 }
      )
    }
  })(request)
}

