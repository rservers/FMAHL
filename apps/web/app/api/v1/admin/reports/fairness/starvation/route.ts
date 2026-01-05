/**
 * GET /api/v1/admin/reports/fairness/starvation
 * 
 * Fairness & Starvation Monitoring
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { starvationQuerySchema } from '@/lib/validations/reports'
import { sql } from '@/lib/db'
import { generateCacheKey, getCachedReport, setCachedReport, shouldBypassCache } from '@/lib/services/report-cache'
import { REPORT_CACHE_TTL_SECONDS, STARVATION_THRESHOLD_DAYS } from '@/lib/config/report-config'
import type { StarvationReport } from '@/lib/types/reports'

export async function GET(request: NextRequest) {
  return adminWithMFA(async () => {
    try {
      // Parse query parameters
      const url = new URL(request.url)
      const queryParams = {
        niche_id: url.searchParams.get('niche_id') || undefined,
        competition_level_id: url.searchParams.get('competition_level_id') || undefined,
      }

      // Validate query parameters
      const validationResult = starvationQuerySchema.safeParse(queryParams)
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

      const { niche_id, competition_level_id } = validationResult.data

      // Calculate threshold date
      const thresholdDate = new Date(Date.now() - STARVATION_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString()

      // Check cache
      const cacheKey = generateCacheKey('admin', 'starvation', thresholdDate, new Date().toISOString(), { niche_id, competition_level_id })
      
      if (!shouldBypassCache(url.searchParams)) {
        const cached = await getCachedReport<StarvationReport>(cacheKey)
        if (cached) {
          return NextResponse.json(cached)
        }
      }

      // Build query for starved subscriptions
      let query = sql`
        SELECT 
          cls.id as subscription_id,
          cls.provider_id,
          u.first_name || ' ' || u.last_name as provider_name,
          cls.niche_id,
          n.name as niche_name,
          cls.competition_level_id,
          cl.name as competition_level_name,
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

      const starvedSubscriptions = await query

      const response: StarvationReport = {
        period: { from: thresholdDate, to: new Date().toISOString() },
        threshold_days: STARVATION_THRESHOLD_DAYS,
        starved_subscriptions: starvedSubscriptions.map((sub: any) => ({
          subscription_id: sub.subscription_id,
          provider_id: sub.provider_id,
          provider_name: sub.provider_name || 'Unknown',
          niche_id: sub.niche_id,
          niche_name: sub.niche_name,
          competition_level_id: sub.competition_level_id,
          competition_level_name: sub.competition_level_name,
          last_received_at: sub.last_received_at ? sub.last_received_at.toISOString() : null,
          days_since_last_lead: sub.days_since_last_lead ? Math.floor(Number(sub.days_since_last_lead)) : null,
        })),
      }

      // Cache response
      await setCachedReport(cacheKey, response, REPORT_CACHE_TTL_SECONDS)

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching starvation report:', error)
      return NextResponse.json(
        { error: 'Failed to fetch starvation report' },
        { status: 500 }
      )
    }
  })(request)
}

