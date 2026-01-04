/**
 * GET /api/v1/admin/niches/:nicheId/invalid-filters
 * 
 * List subscriptions with invalid filters for a niche.
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

    // Get subscriptions with invalid filters
    const subscriptions = await sql`
      SELECT 
        cls.id as subscription_id,
        cls.provider_id,
        cls.filter_rules,
        cls.filter_updated_at,
        p.business_name as provider_name,
        cl.name as level_name,
        cl.id as level_id
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      JOIN providers p ON cls.provider_id = p.id
      WHERE cl.niche_id = ${nicheId}
        AND cls.filter_is_valid = false
        AND cls.deleted_at IS NULL
      ORDER BY cls.filter_updated_at DESC NULLS LAST
    `

    return NextResponse.json({
      niche_id: nicheId,
      invalid_subscriptions: subscriptions.map((sub: any) => ({
        subscription_id: sub.subscription_id,
        provider_id: sub.provider_id,
        provider_name: sub.provider_name,
        level_id: sub.level_id,
        level_name: sub.level_name,
        filter_rules: sub.filter_rules,
        filter_updated_at: sub.filter_updated_at?.toISOString() || null,
      })),
      total: subscriptions.length,
    })

  } catch (error: any) {
    console.error('Get invalid filters error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

