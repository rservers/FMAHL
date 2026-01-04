/**
 * POST /api/v1/admin/niches/:nicheId/competition-levels/reorder
 * 
 * Reorder competition levels within a niche atomically.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { reorderCompetitionLevelsSchema } from '@/lib/validations/competition-levels'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'

export const POST = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract nicheId from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const reorderIndex = pathParts.indexOf('reorder')
    const nicheId = reorderIndex > 0 ? pathParts[reorderIndex - 2] : null

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
    const validationResult = reorderCompetitionLevelsSchema.safeParse(body)
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

    const { ordered_level_ids } = validationResult.data

    // Check niche exists
    const [niche] = await sql`SELECT id FROM niches WHERE id = ${nicheId}`
    if (!niche) {
      return NextResponse.json({ error: 'Niche not found' }, { status: 404 })
    }

    // Get all levels for this niche (non-deleted)
    const allLevels = await sql`
      SELECT id, order_position
      FROM competition_levels
      WHERE niche_id = ${nicheId} AND deleted_at IS NULL
      ORDER BY order_position ASC
    `

    // Validate all provided IDs belong to the niche
    const providedIds = new Set(ordered_level_ids)
    const nicheLevelIds = new Set(allLevels.map((l: any) => l.id))

    for (const id of ordered_level_ids) {
      if (!nicheLevelIds.has(id)) {
        return NextResponse.json(
          { error: `Level ${id} does not belong to this niche` },
          { status: 400 }
        )
      }
    }

    // Validate all levels are included (completeness check)
    if (providedIds.size !== nicheLevelIds.size) {
      return NextResponse.json(
        {
          error: 'All competition levels for this niche must be included in the reorder',
          expected_count: nicheLevelIds.size,
          provided_count: providedIds.size,
        },
        { status: 400 }
      )
    }

    // Get old order for audit log
    const oldOrder = allLevels.map((l: any) => ({
      id: l.id,
      order_position: l.order_position,
    }))

    // Update order positions atomically (1..N)
    // Use a transaction-like approach with individual updates
    for (let i = 0; i < ordered_level_ids.length; i++) {
      const levelId = ordered_level_ids[i]
      const newOrderPosition = i + 1

      await sql`
        UPDATE competition_levels
        SET order_position = ${newOrderPosition}, updated_at = NOW()
        WHERE id = ${levelId}
      `
    }

    // Get updated levels for response
    const updatedLevels = await sql`
      SELECT 
        cl.*,
        COUNT(DISTINCT CASE WHEN cls.is_active = true AND cls.deleted_at IS NULL THEN cls.id END) as active_subscribers_count
      FROM competition_levels cl
      LEFT JOIN competition_level_subscriptions cls ON cl.id = cls.competition_level_id
      WHERE cl.niche_id = ${nicheId} AND cl.deleted_at IS NULL
      GROUP BY cl.id
      ORDER BY cl.order_position ASC
    `

    // Audit log
    await logAction({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.COMPETITION_LEVEL_REORDERED,
      entity: 'competition_level',
      entityId: nicheId, // Using niche_id as entity since we're reordering multiple levels
      metadata: {
        niche_id: nicheId,
        old_order: oldOrder,
        new_order: ordered_level_ids.map((id, index) => ({
          id,
          order_position: index + 1,
        })),
      },
    })

    return NextResponse.json({
      levels: updatedLevels.map((level: any) => ({
        id: level.id,
        name: level.name,
        price_per_lead_cents: level.price_per_lead_cents,
        max_recipients: level.max_recipients,
        order_position: level.order_position,
        is_active: level.is_active,
        active_subscribers_count: Number(level.active_subscribers_count),
      })),
      total: updatedLevels.length,
    })

  } catch (error: any) {
    console.error('Reorder competition levels error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

