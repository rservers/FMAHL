/**
 * GET /api/v1/provider/subscriptions
 * 
 * List all subscriptions for the current provider.
 * 
 * Requires: Provider authentication
 * 
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { providerOnly } from '@/lib/middleware/rbac'
import { providerSubscriptionsQuerySchema } from '@/lib/validations/competition-levels'
import { sql } from '@/lib/db'

export const GET = providerOnly(async (request: NextRequest, user: any) => {
  try {
    // Get provider
    const [provider] = await sql`
      SELECT id FROM providers WHERE user_id = ${user.id} LIMIT 1
    `

    if (!provider) {
      return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 })
    }

    // Parse query params
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const validationResult = providerSubscriptionsQuerySchema.safeParse(queryParams)
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

    const { niche_id, is_active, page, limit } = validationResult.data
    const offset = (page - 1) * limit

    // Build WHERE clause
    const conditions: string[] = [`cls.provider_id = $1`, `cls.deleted_at IS NULL`]
    const params: any[] = [provider.id]
    let paramIndex = 2

    if (niche_id) {
      conditions.push(`cl.niche_id = $${paramIndex++}`)
      params.push(niche_id)
    }

    if (is_active !== undefined) {
      conditions.push(`cls.is_active = $${paramIndex++}`)
      params.push(is_active)
    }

    const whereClause = conditions.join(' AND ')

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      WHERE ${whereClause}
    `
    const [countResult] = await sql.unsafe(countQuery, params)
    const total = Number(countResult.total)

    // Get subscriptions with pagination
    const subscriptionsQuery = `
      SELECT 
        cls.id,
        cls.competition_level_id,
        cls.is_active,
        cls.subscribed_at,
        cl.niche_id,
        n.name as niche_name,
        cl.name as level_name,
        cl.price_per_lead_cents,
        cl.max_recipients
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      JOIN niches n ON cl.niche_id = n.id
      WHERE ${whereClause}
      ORDER BY cls.subscribed_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    params.push(limit, offset)

    const subscriptions = await sql.unsafe(subscriptionsQuery, params)

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      subscriptions: subscriptions.map((sub: any) => ({
        id: sub.id,
        niche_id: sub.niche_id,
        niche_name: sub.niche_name,
        level_id: sub.competition_level_id,
        level_name: sub.level_name,
        price_per_lead_cents: sub.price_per_lead_cents,
        max_recipients: sub.max_recipients,
        is_active: sub.is_active,
        subscribed_at: sub.subscribed_at.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    })

  } catch (error: any) {
    console.error('List provider subscriptions error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

