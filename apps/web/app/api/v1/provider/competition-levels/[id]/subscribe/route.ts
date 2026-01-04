/**
 * POST /api/v1/provider/competition-levels/:id/subscribe
 * 
 * Subscribe to a competition level.
 * 
 * Requires: Provider authentication
 * 
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { providerOnly } from '@/lib/middleware/rbac'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { providerSubscribeRateLimit, addRateLimitHeaders } from '@/lib/middleware/rate-limit'

export const POST = providerOnly(async (request: NextRequest, user: any) => {
  try {
    // Check rate limit
    const rateLimitResult = await providerSubscribeRateLimit(user.id)
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
    const subscribeIndex = pathParts.indexOf('subscribe')
    const id = subscribeIndex > 0 ? pathParts[subscribeIndex - 1] : null

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
      SELECT p.id, p.status, u.status as user_status
      FROM providers p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ${user.id}
      LIMIT 1
    `

    if (!provider) {
      return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 })
    }

    // Check provider account is not suspended
    if (provider.user_status === 'suspended' || provider.status === 'suspended') {
      return NextResponse.json(
        { error: 'Cannot subscribe: provider account is suspended' },
        { status: 403 }
      )
    }

    // Get competition level
    const [level] = await sql`
      SELECT * FROM competition_levels WHERE id = ${id} AND deleted_at IS NULL
    `

    if (!level) {
      return NextResponse.json({ error: 'Competition level not found' }, { status: 404 })
    }

    // Check level is active
    if (!level.is_active) {
      return NextResponse.json(
        { error: 'Cannot subscribe to an inactive competition level' },
        { status: 400 }
      )
    }

    // Check not already subscribed (non-deleted)
    const [existingSubscription] = await sql`
      SELECT id FROM competition_level_subscriptions
      WHERE provider_id = ${provider.id}
        AND competition_level_id = ${id}
        AND deleted_at IS NULL
    `

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'Already subscribed to this competition level' },
        { status: 409 }
      )
    }

    // Check balance (EPIC 07 integration point - stub for now, always assume sufficient)
    // TODO: Integrate with EPIC 07 balance check
    const hasSufficientBalance = true // Stub: always true for now
    const isActive = hasSufficientBalance

    // Create subscription
    const [subscription] = await sql`
      INSERT INTO competition_level_subscriptions (
        provider_id,
        competition_level_id,
        is_active
      ) VALUES (
        ${provider.id},
        ${id},
        ${isActive}
      )
      RETURNING *
    `

    // Audit log
    await logAction({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.SUBSCRIPTION_CREATED,
      entity: 'competition_level_subscription',
      entityId: subscription.id,
      metadata: {
        competition_level_id: id,
        competition_level_name: level.name,
        is_active: isActive,
        balance_sufficient: hasSufficientBalance,
      },
    })

    const response = NextResponse.json({
      id: subscription.id,
      competition_level_id: id,
      competition_level_name: level.name,
      is_active: subscription.is_active,
      subscribed_at: subscription.subscribed_at.toISOString(),
    }, { status: 201 })

    return addRateLimitHeaders(response, rateLimitResult)

  } catch (error: any) {
    console.error('Subscribe to competition level error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

