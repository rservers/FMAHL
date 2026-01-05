/**
 * GET /api/v1/admin/reports/providers/flags
 * 
 * Flagged Provider Metrics (Bad Lead Patterns)
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { flaggedProvidersQuerySchema } from '@/lib/validations/reports'
import { sql } from '@/lib/db'
import { generateCacheKey, getCachedReport, setCachedReport, shouldBypassCache } from '@/lib/services/report-cache'
import { REPORT_CACHE_TTL_SECONDS, BAD_LEAD_APPROVAL_RATE_THRESHOLD, BAD_LEAD_REFUND_RATE_THRESHOLD } from '@/lib/config/report-config'
import type { FlaggedProvider } from '@/lib/types/reports'

export async function GET(request: NextRequest) {
  return adminWithMFA(async () => {
    try {
      // Parse query parameters
      const url = new URL(request.url)
      const queryParams = {
        date_from: url.searchParams.get('date_from') || undefined,
        date_to: url.searchParams.get('date_to') || undefined,
        provider_id: url.searchParams.get('provider_id') || undefined,
      }

      // Validate query parameters
      const validationResult = flaggedProvidersQuerySchema.safeParse(queryParams)
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

      const { date_from, date_to, provider_id } = validationResult.data

      // Default to last 30 days if not specified
      const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const toDate = date_to || new Date().toISOString()

      // Check cache
      const cacheKey = generateCacheKey('admin', 'flagged_providers', fromDate, toDate, { provider_id })
      
      if (!shouldBypassCache(url.searchParams)) {
        const cached = await getCachedReport<FlaggedProvider[]>(cacheKey)
        if (cached) {
          return NextResponse.json({ providers: cached })
        }
      }

      // Build query for provider metrics
      let query = sql`
        SELECT 
          la.provider_id,
          u.first_name || ' ' || u.last_name as provider_name,
          COUNT(DISTINCT la.id) as total_assignments,
          COUNT(*) FILTER (WHERE la.bad_lead_reported_at >= ${fromDate} AND la.bad_lead_reported_at <= ${toDate}) as total_bad_lead_reports,
          COUNT(*) FILTER (WHERE la.bad_lead_status = 'approved' AND la.bad_lead_reported_at >= ${fromDate} AND la.bad_lead_reported_at <= ${toDate}) as total_bad_lead_approved
        FROM lead_assignments la
        JOIN providers p ON la.provider_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE la.assigned_at >= ${fromDate}
          AND la.assigned_at <= ${toDate}
      `

      if (provider_id) {
        query = sql`${query} AND la.provider_id = ${provider_id}`
      }

      query = sql`${query} GROUP BY la.provider_id, u.first_name, u.last_name`

      const providers = await query

      // Calculate flags
      const flaggedProviders: FlaggedProvider[] = providers.map((p: any) => {
        const totalAssignments = Number(p.total_assignments) || 0
        const totalReports = Number(p.total_bad_lead_reports) || 0
        const totalApproved = Number(p.total_bad_lead_approved) || 0
        
        const approvalRate = totalReports > 0 ? totalApproved / totalReports : 0
        const refundRate = totalAssignments > 0 ? totalReports / totalAssignments : 0
        
        const flagged = approvalRate > BAD_LEAD_APPROVAL_RATE_THRESHOLD || refundRate > BAD_LEAD_REFUND_RATE_THRESHOLD
        
        const flaggedReasons: string[] = []
        if (approvalRate > BAD_LEAD_APPROVAL_RATE_THRESHOLD) {
          flaggedReasons.push('high_approval_rate')
        }
        if (refundRate > BAD_LEAD_REFUND_RATE_THRESHOLD) {
          flaggedReasons.push('high_refund_rate')
        }

        return {
          provider_id: p.provider_id,
          provider_name: p.provider_name || 'Unknown',
          total_assignments: totalAssignments,
          total_bad_lead_reports: totalReports,
          total_bad_lead_approved: totalApproved,
          approval_rate: approvalRate,
          refund_rate: refundRate,
          flagged,
          flagged_reasons: flaggedReasons,
        }
      })

      // Cache response
      await setCachedReport(cacheKey, flaggedProviders, REPORT_CACHE_TTL_SECONDS)

      return NextResponse.json({ providers: flaggedProviders })
    } catch (error) {
      console.error('Error fetching flagged providers:', error)
      return NextResponse.json(
        { error: 'Failed to fetch flagged providers' },
        { status: 500 }
      )
    }
  })(request)
}

