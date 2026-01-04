/**
 * GET /api/v1/admin/subscriptions
 * 
 * List all provider subscriptions across all providers.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { adminSubscriptionsQuerySchema } from '@/lib/validations/competition-levels'
import { sql } from '@/lib/db'

export const GET = adminWithMFA(async (request: NextRequest) => {
  try {
    // Parse query params
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const validationResult = adminSubscriptionsQuerySchema.safeParse(queryParams)
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

    const { provider_id, niche_id, competition_level_id, is_active, search, page, limit, sort } = validationResult.data
    const offset = (page - 1) * limit

    // Build WHERE clause
    const conditions: string[] = ['cls.deleted_at IS NULL']
    const params: any[] = []
    let paramIndex = 1

    if (provider_id) {
      conditions.push(`cls.provider_id = $${paramIndex++}`)
      params.push(provider_id)
    }

    if (niche_id) {
      conditions.push(`cl.niche_id = $${paramIndex++}`)
      params.push(niche_id)
    }

    if (competition_level_id) {
      conditions.push(`cls.competition_level_id = $${paramIndex++}`)
      params.push(competition_level_id)
    }

    if (is_active !== undefined) {
      conditions.push(`cls.is_active = $${paramIndex++}`)
      params.push(is_active)
    }

    if (search) {
      conditions.push(`(u.email ILIKE $${paramIndex++} OR p.business_name ILIKE $${paramIndex})`)
      params.push(`%${search}%`, `%${search}%`)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // Determine sort order
    const sortField = sort === 'subscribed_at' ? 'cls.subscribed_at' : 'cls.subscribed_at'
    const sortOrder = sort?.startsWith('-') ? 'DESC' : 'ASC'

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      JOIN providers p ON cls.provider_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE ${whereClause}
    `
    const [countResult] = await sql.unsafe(countQuery, params)
    const total = Number(countResult.total)

    // Get subscriptions with pagination
    const subscriptionsQuery = `
      SELECT 
        cls.id,
        cls.provider_id,
        u.email as provider_email,
        p.business_name as provider_business_name,
        cls.competition_level_id,
        cl.niche_id,
        n.name as niche_name,
        cl.name as level_name,
        cl.price_per_lead_cents,
        cls.is_active,
        cls.subscribed_at
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      JOIN niches n ON cl.niche_id = n.id
      JOIN providers p ON cls.provider_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE ${whereClause}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    params.push(limit, offset)

    const subscriptions = await sql.unsafe(subscriptionsQuery, params)

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      subscriptions: subscriptions.map((sub: any) => ({
        id: sub.id,
        provider_id: sub.provider_id,
        provider_email: sub.provider_email,
        provider_business_name: sub.provider_business_name,
        niche_id: sub.niche_id,
        niche_name: sub.niche_name,
        level_id: sub.competition_level_id,
        level_name: sub.level_name,
        price_per_lead_cents: sub.price_per_lead_cents,
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
    console.error('List admin subscriptions error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

