/**
 * GET /api/v1/provider/niches/:nicheId/competition-levels
 * 
 * View available competition levels for a niche with subscription status.
 * 
 * Requires: Provider authentication
 * 
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { providerOnly } from '@/lib/middleware/rbac'
import { competitionLevelsListQuerySchema } from '@/lib/validations/competition-levels'
import { sql } from '@/lib/db'

export const GET = providerOnly(async (request: NextRequest, user: any) => {
  try {
    // Extract nicheId from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const competitionLevelsIndex = pathParts.indexOf('competition-levels')
    const nicheId = competitionLevelsIndex > 0 ? pathParts[competitionLevelsIndex - 1] : null

    if (!nicheId) {
      return NextResponse.json({ error: 'Niche ID is required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(nicheId)) {
      return NextResponse.json({ error: 'Invalid niche ID format' }, { status: 400 })
    }

    // Get provider ID
    const [provider] = await sql`
      SELECT id FROM providers WHERE user_id = ${user.id} LIMIT 1
    `

    if (!provider) {
      return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 })
    }

    // Parse query params
    const queryParams = Object.fromEntries(url.searchParams)
    const validationResult = competitionLevelsListQuerySchema.safeParse(queryParams)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validationResult.error.issues.map((e) => ({
            field: String(e.path.join('.')),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    const { include_inactive } = validationResult.data

    // Build query
    let levelsQuery = sql`
      SELECT 
        cl.id,
        cl.name,
        cl.description,
        cl.price_per_lead_cents,
        cl.max_recipients,
        cl.order_position,
        cl.is_active,
        COUNT(DISTINCT CASE WHEN cls.is_active = true AND cls.deleted_at IS NULL THEN cls.id END) as active_subscribers_count,
        CASE WHEN my_sub.id IS NOT NULL THEN true ELSE false END as is_subscribed,
        CASE WHEN my_sub.id IS NOT NULL THEN my_sub.is_active ELSE NULL END as subscription_status
      FROM competition_levels cl
      LEFT JOIN competition_level_subscriptions cls ON cl.id = cls.competition_level_id
      LEFT JOIN competition_level_subscriptions my_sub ON cl.id = my_sub.competition_level_id 
        AND my_sub.provider_id = ${provider.id} 
        AND my_sub.deleted_at IS NULL
      WHERE cl.niche_id = ${nicheId} 
        AND cl.deleted_at IS NULL
    `

    if (!include_inactive) {
      levelsQuery = sql`
        ${levelsQuery}
        AND cl.is_active = true
      `
    }

    levelsQuery = sql`
      ${levelsQuery}
      GROUP BY cl.id, my_sub.id, my_sub.is_active
      ORDER BY cl.order_position ASC
    `

    const levels = await levelsQuery

    return NextResponse.json({
      levels: levels.map((level: any) => ({
        id: level.id,
        name: level.name,
        description: level.description,
        price_per_lead_cents: level.price_per_lead_cents,
        max_recipients: level.max_recipients,
        order_position: level.order_position,
        is_active: level.is_active,
        is_subscribed: level.is_subscribed,
        subscription_status: level.subscription_status ? (level.subscription_status ? 'active' : 'inactive') : null,
        active_subscribers_count: Number(level.active_subscribers_count),
      })),
    })

  } catch (error: any) {
    console.error('Provider view competition levels error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

