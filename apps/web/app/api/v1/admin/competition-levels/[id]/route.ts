/**
 * GET /api/v1/admin/competition-levels/:id
 * PATCH /api/v1/admin/competition-levels/:id
 * DELETE /api/v1/admin/competition-levels/:id
 * 
 * Get, update, or delete a competition level.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { updateCompetitionLevelSchema } from '@/lib/validations/competition-levels'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { adminCompetitionLevelUpdateRateLimit, addRateLimitHeaders } from '@/lib/middleware/rate-limit'

export const GET = adminWithMFA(async (request: NextRequest) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const idIndex = pathParts.indexOf('competition-levels')
    const id = idIndex >= 0 && pathParts[idIndex + 1] ? pathParts[idIndex + 1] : null

    if (!id) {
      return NextResponse.json({ error: 'Competition level ID is required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid competition level ID format' }, { status: 400 })
    }

    // Get competition level
    const [level] = await sql`
      SELECT 
        cl.*,
        COUNT(DISTINCT CASE WHEN cls.is_active = true AND cls.deleted_at IS NULL THEN cls.id END) as active_subscribers_count,
        COUNT(DISTINCT CASE WHEN cls.deleted_at IS NULL THEN cls.id END) as total_subscribers_count
      FROM competition_levels cl
      LEFT JOIN competition_level_subscriptions cls ON cl.id = cls.competition_level_id
      WHERE cl.id = ${id} AND cl.deleted_at IS NULL
      GROUP BY cl.id
    `

    if (!level) {
      return NextResponse.json({ error: 'Competition level not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: level.id,
      niche_id: level.niche_id,
      name: level.name,
      description: level.description,
      price_per_lead_cents: level.price_per_lead_cents,
      max_recipients: level.max_recipients,
      order_position: level.order_position,
      is_active: level.is_active,
      active_subscribers_count: Number(level.active_subscribers_count),
      total_subscribers_count: Number(level.total_subscribers_count),
      created_at: level.created_at.toISOString(),
      updated_at: level.updated_at.toISOString(),
    })

  } catch (error: any) {
    console.error('Get competition level error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const PATCH = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Check rate limit
    const rateLimitResult = await adminCompetitionLevelUpdateRateLimit(user.id)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const idIndex = pathParts.indexOf('competition-levels')
    const id = idIndex >= 0 && pathParts[idIndex + 1] ? pathParts[idIndex + 1] : null

    if (!id) {
      return NextResponse.json({ error: 'Competition level ID is required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid competition level ID format' }, { status: 400 })
    }

    const body = await request.json()

    // Validate request body
    const validationResult = updateCompetitionLevelSchema.safeParse(body)
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

    // Get current level
    const [currentLevel] = await sql`
      SELECT * FROM competition_levels WHERE id = ${id} AND deleted_at IS NULL
    `

    if (!currentLevel) {
      return NextResponse.json({ error: 'Competition level not found' }, { status: 404 })
    }

    const updates: any = {}
    const oldValues: any = {}

    // Validate name uniqueness if changing
    if (validationResult.data.name !== undefined && validationResult.data.name !== currentLevel.name) {
      const [existingName] = await sql`
        SELECT id FROM competition_levels 
        WHERE niche_id = ${currentLevel.niche_id} 
          AND name = ${validationResult.data.name} 
          AND id != ${id}
          AND deleted_at IS NULL
      `
      if (existingName) {
        return NextResponse.json(
          { error: 'A competition level with this name already exists for this niche' },
          { status: 409 }
        )
      }
      updates.name = validationResult.data.name
      oldValues.name = currentLevel.name
    }

    // Validate order_position uniqueness if changing
    if (validationResult.data.order_position !== undefined && validationResult.data.order_position !== currentLevel.order_position) {
      const [existingOrder] = await sql`
        SELECT id FROM competition_levels 
        WHERE niche_id = ${currentLevel.niche_id} 
          AND order_position = ${validationResult.data.order_position}
          AND id != ${id}
          AND deleted_at IS NULL
      `
      if (existingOrder) {
        return NextResponse.json(
          { error: 'A competition level with this order position already exists for this niche' },
          { status: 409 }
        )
      }
      updates.order_position = validationResult.data.order_position
      oldValues.order_position = currentLevel.order_position
    }

    // Validate max_recipients not below active subscriber count
    if (validationResult.data.max_recipients !== undefined) {
      const [activeCount] = await sql`
        SELECT COUNT(*) as count
        FROM competition_level_subscriptions
        WHERE competition_level_id = ${id}
          AND is_active = true
          AND deleted_at IS NULL
      `
      if (validationResult.data.max_recipients < Number(activeCount.count)) {
        return NextResponse.json(
          {
            error: 'Cannot set max_recipients below current active subscriber count',
            current_active_subscribers: Number(activeCount.count),
          },
          { status: 400 }
        )
      }
      updates.max_recipients = validationResult.data.max_recipients
      oldValues.max_recipients = currentLevel.max_recipients
    }

    // Check if deactivating the only active level
    if (validationResult.data.is_active === false && currentLevel.is_active === true) {
      const [activeCount] = await sql`
        SELECT COUNT(*) as count
        FROM competition_levels
        WHERE niche_id = ${currentLevel.niche_id}
          AND is_active = true
          AND deleted_at IS NULL
      `
      if (Number(activeCount.count) === 1) {
        return NextResponse.json(
          { error: 'Cannot deactivate the only active competition level for this niche' },
          { status: 400 }
        )
      }
    }

    // Apply updates
    if (validationResult.data.description !== undefined) {
      updates.description = validationResult.data.description
      oldValues.description = currentLevel.description
    }
    if (validationResult.data.price_per_lead_cents !== undefined) {
      updates.price_per_lead_cents = validationResult.data.price_per_lead_cents
      oldValues.price_per_lead_cents = currentLevel.price_per_lead_cents
    }
    if (validationResult.data.is_active !== undefined) {
      updates.is_active = validationResult.data.is_active
      oldValues.is_active = currentLevel.is_active
    }

    // Build dynamic update query
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Build update parts with proper typing
    const updateParts: string[] = []
    const updateParams: (string | number | boolean | null)[] = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(updates)) {
      updateParts.push(`${key} = $${paramIndex++}`)
      updateParams.push(value as string | number | boolean | null)
    }
    updateParts.push(`updated_at = NOW()`)
    
    const updateFields = updateParts.join(', ')
    updateParams.push(id)

    const [updatedLevel] = await sql.unsafe(
      `UPDATE competition_levels SET ${updateFields} WHERE id = $${paramIndex} RETURNING *`,
      updateParams
    )

    // Audit log
    const action = validationResult.data.is_active === false && currentLevel.is_active === true
      ? AuditActions.COMPETITION_LEVEL_DEACTIVATED
      : validationResult.data.is_active === true && currentLevel.is_active === false
      ? AuditActions.COMPETITION_LEVEL_REACTIVATED
      : AuditActions.COMPETITION_LEVEL_UPDATED

    await logAction({
      actorId: user.id,
      actorRole: user.role,
      action,
      entity: 'competition_level',
      entityId: id,
      metadata: {
        old_values: oldValues,
        new_values: updates,
      },
    })

    const response = NextResponse.json({
      id: updatedLevel.id,
      niche_id: updatedLevel.niche_id,
      name: updatedLevel.name,
      description: updatedLevel.description,
      price_per_lead_cents: updatedLevel.price_per_lead_cents,
      max_recipients: updatedLevel.max_recipients,
      order_position: updatedLevel.order_position,
      is_active: updatedLevel.is_active,
      updated_at: updatedLevel.updated_at.toISOString(),
    })

    return addRateLimitHeaders(response, rateLimitResult)

  } catch (error: any) {
    console.error('Update competition level error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const DELETE = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const idIndex = pathParts.indexOf('competition-levels')
    const id = idIndex >= 0 && pathParts[idIndex + 1] ? pathParts[idIndex + 1] : null

    if (!id) {
      return NextResponse.json({ error: 'Competition level ID is required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid competition level ID format' }, { status: 400 })
    }

    // Check level exists
    const [level] = await sql`
      SELECT * FROM competition_levels WHERE id = ${id} AND deleted_at IS NULL
    `

    if (!level) {
      return NextResponse.json({ error: 'Competition level not found' }, { status: 404 })
    }

    // Check for active subscriptions
    const [activeSubscriptions] = await sql`
      SELECT COUNT(*) as count
      FROM competition_level_subscriptions
      WHERE competition_level_id = ${id}
        AND deleted_at IS NULL
    `

    if (Number(activeSubscriptions.count) > 0) {
      // Audit log blocked delete
      await logAction({
        actorId: user.id,
        actorRole: user.role,
        action: AuditActions.COMPETITION_LEVEL_DELETE_BLOCKED,
        entity: 'competition_level',
        entityId: id,
        metadata: {
          reason: 'Has active subscriptions',
          active_subscriptions: Number(activeSubscriptions.count),
        },
      })

      return NextResponse.json(
        {
          error: 'Cannot delete competition level with active subscriptions',
          suggestion: 'Deactivate the level instead',
          active_subscriptions: Number(activeSubscriptions.count),
        },
        { status: 409 }
      )
    }

    // Check for historical lead assignments (EPIC 06 - stub for now)
    // For now, we'll allow deletion if no subscriptions

    // Soft delete
    await sql`
      UPDATE competition_levels
      SET deleted_at = NOW()
      WHERE id = ${id}
    `

    // Audit log
    await logAction({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.COMPETITION_LEVEL_DELETE_BLOCKED, // Using same action for now
      entity: 'competition_level',
      entityId: id,
      metadata: {
        deleted: true,
      },
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Delete competition level error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

