/**
 * POST /api/v1/admin/niches/:nicheId/competition-levels
 * GET /api/v1/admin/niches/:nicheId/competition-levels
 * 
 * Create and list competition levels for a niche.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { createCompetitionLevelSchema, competitionLevelsListQuerySchema } from '@/lib/validations/competition-levels'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'

export const POST = adminWithMFA(async (request: NextRequest, user: any) => {
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

    const body = await request.json()

    // Validate request body
    const validationResult = createCompetitionLevelSchema.safeParse(body)
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

    const { name, description, price_per_lead_cents, max_recipients, order_position, is_active } = validationResult.data

    // Check niche exists
    const [niche] = await sql`SELECT id FROM niches WHERE id = ${nicheId}`
    if (!niche) {
      return NextResponse.json({ error: 'Niche not found' }, { status: 404 })
    }

    // Check name uniqueness within niche
    const [existingName] = await sql`
      SELECT id FROM competition_levels 
      WHERE niche_id = ${nicheId} 
        AND name = ${name} 
        AND deleted_at IS NULL
    `
    if (existingName) {
      return NextResponse.json(
        { error: 'A competition level with this name already exists for this niche' },
        { status: 409 }
      )
    }

    // Auto-assign order_position if not provided
    let finalOrderPosition = order_position
    if (!finalOrderPosition) {
      const [maxOrder] = await sql`
        SELECT COALESCE(MAX(order_position), 0) as max_order
        FROM competition_levels
        WHERE niche_id = ${nicheId} AND deleted_at IS NULL
      `
      finalOrderPosition = Number(maxOrder.max_order) + 1
    } else {
      // Check order_position uniqueness
      const [existingOrder] = await sql`
        SELECT id FROM competition_levels 
        WHERE niche_id = ${nicheId} 
          AND order_position = ${finalOrderPosition}
          AND deleted_at IS NULL
      `
      if (existingOrder) {
        return NextResponse.json(
          { error: 'A competition level with this order position already exists for this niche' },
          { status: 409 }
        )
      }
    }

    // Create competition level
    const [level] = await sql`
      INSERT INTO competition_levels (
        niche_id,
        name,
        description,
        price_per_lead_cents,
        max_recipients,
        order_position,
        is_active
      ) VALUES (
        ${nicheId},
        ${name},
        ${description || null},
        ${price_per_lead_cents},
        ${max_recipients},
        ${finalOrderPosition},
        ${is_active ?? true}
      )
      RETURNING *
    `

    // Audit log
    await logAction({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.COMPETITION_LEVEL_CREATED,
      entity: 'competition_level',
      entityId: level.id,
      metadata: {
        niche_id: nicheId,
        name,
        price_per_lead_cents,
        max_recipients,
        order_position: finalOrderPosition,
      },
    })

    return NextResponse.json({
      id: level.id,
      niche_id: level.niche_id,
      name: level.name,
      description: level.description,
      price_per_lead_cents: level.price_per_lead_cents,
      max_recipients: level.max_recipients,
      order_position: level.order_position,
      is_active: level.is_active,
      created_at: level.created_at.toISOString(),
    }, { status: 201 })

  } catch (error: any) {
    console.error('Create competition level error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const GET = adminWithMFA(async (request: NextRequest) => {
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

    // Check niche exists
    const [niche] = await sql`SELECT id FROM niches WHERE id = ${nicheId}`
    if (!niche) {
      return NextResponse.json({ error: 'Niche not found' }, { status: 404 })
    }

    // Get all levels for niche (ordered by order_position)
    const levels = await sql`
      SELECT 
        cl.*,
        COUNT(DISTINCT CASE WHEN cls.is_active = true AND cls.deleted_at IS NULL THEN cls.id END) as active_subscribers_count,
        COUNT(DISTINCT CASE WHEN cls.deleted_at IS NULL THEN cls.id END) as total_subscribers_count
      FROM competition_levels cl
      LEFT JOIN competition_level_subscriptions cls ON cl.id = cls.competition_level_id
      WHERE cl.niche_id = ${nicheId} AND cl.deleted_at IS NULL
      GROUP BY cl.id
      ORDER BY cl.order_position ASC
    `

    return NextResponse.json({
      levels: levels.map((level: any) => ({
        id: level.id,
        name: level.name,
        description: level.description,
        price_per_lead_cents: level.price_per_lead_cents,
        max_recipients: level.max_recipients,
        order_position: level.order_position,
        is_active: level.is_active,
        active_subscribers_count: Number(level.active_subscribers_count),
        total_subscribers_count: Number(level.total_subscribers_count),
        created_at: level.created_at.toISOString(),
      })),
      total: levels.length,
    })

  } catch (error: any) {
    console.error('List competition levels error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

