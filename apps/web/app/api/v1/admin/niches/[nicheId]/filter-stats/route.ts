/**
 * GET /api/v1/admin/niches/:nicheId/filter-stats
 * 
 * View filter statistics for a niche.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { sql } from '@/lib/db'

export const GET = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract niche ID from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const nicheIdIndex = pathParts.indexOf('niches')
    const nicheId = nicheIdIndex >= 0 && pathParts[nicheIdIndex + 1]
      ? pathParts[nicheIdIndex + 1]
      : null

    if (!nicheId) {
      return NextResponse.json({ error: 'Niche ID is required' }, { status: 400 })
    }

    // Verify niche exists
    const [niche] = await sql`
      SELECT id FROM niches WHERE id = ${nicheId}
    `

    if (!niche) {
      return NextResponse.json({ error: 'Niche not found' }, { status: 404 })
    }

    // Get subscription counts
    const [stats] = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE cls.filter_rules IS NOT NULL) as subscriptions_with_filters,
        COUNT(*) FILTER (WHERE cls.filter_is_valid = false) as invalid_filter_count,
        COUNT(*) as total_subscriptions,
        AVG(
          CASE 
            WHEN cls.filter_rules IS NOT NULL 
            THEN jsonb_array_length(cls.filter_rules->'rules')
            ELSE 0
          END
        ) as avg_rule_count
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      WHERE cl.niche_id = ${nicheId}
        AND cls.deleted_at IS NULL
    `

    // Get most common fields (from filter_rules)
    const fieldCounts = await sql`
      SELECT 
        jsonb_array_elements(cls.filter_rules->'rules')->>'field_key' as field_key,
        COUNT(*) as usage_count
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      WHERE cl.niche_id = ${nicheId}
        AND cls.filter_rules IS NOT NULL
        AND cls.deleted_at IS NULL
      GROUP BY field_key
      ORDER BY usage_count DESC
      LIMIT 10
    `

    return NextResponse.json({
      niche_id: nicheId,
      subscriptions_with_filters: Number(stats.subscriptions_with_filters),
      invalid_filter_count: Number(stats.invalid_filter_count),
      total_subscriptions: Number(stats.total_subscriptions),
      avg_rule_count: stats.avg_rule_count ? Number(stats.avg_rule_count) : 0,
      most_common_fields: fieldCounts.map((fc: any) => ({
        field_key: fc.field_key,
        usage_count: Number(fc.usage_count),
      })),
    })

  } catch (error: any) {
    console.error('Get filter stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

