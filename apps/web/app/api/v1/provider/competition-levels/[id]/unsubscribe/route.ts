/**
 * POST /api/v1/provider/competition-levels/:id/unsubscribe
 * 
 * Unsubscribe from a competition level (soft delete).
 * 
 * Requires: Provider authentication
 * 
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { providerOnly } from '@/lib/middleware/rbac'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'

export const POST = providerOnly(async (request: NextRequest, user: any) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const unsubscribeIndex = pathParts.indexOf('unsubscribe')
    const id = unsubscribeIndex > 0 ? pathParts[unsubscribeIndex - 1] : null

    if (!id) {
      return NextResponse.json({ error: 'Competition level ID is required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid competition level ID format' }, { status: 400 })
    }

    // Get provider
    const [provider] = await sql`
      SELECT id FROM providers WHERE user_id = ${user.id} LIMIT 1
    `

    if (!provider) {
      return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 })
    }

    // Get subscription
    const [subscription] = await sql`
      SELECT * FROM competition_level_subscriptions
      WHERE provider_id = ${provider.id}
        AND competition_level_id = ${id}
        AND deleted_at IS NULL
    `

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Check for pending lead assignments (EPIC 06 integration point - stub for now)
    // TODO: Integrate with EPIC 06 to check pending assignments
    const hasPendingAssignments = false // Stub: always false for now

    if (hasPendingAssignments) {
      return NextResponse.json(
        { error: 'Cannot unsubscribe: there are pending lead assignments' },
        { status: 400 }
      )
    }

    // Soft delete subscription
    await sql`
      UPDATE competition_level_subscriptions
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${subscription.id}
    `

    // Audit log
    await logAction({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.SUBSCRIPTION_DELETED,
      entity: 'competition_level_subscription',
      entityId: subscription.id,
      metadata: {
        competition_level_id: id,
      },
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Unsubscribe from competition level error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

