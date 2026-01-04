/**
 * GET /api/v1/admin/subscriptions/:subscriptionId/filter-logs
 * 
 * View filter change logs for a subscription (admin only).
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { z } from 'zod'
import { sql } from '@/lib/db'

const filterLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const GET = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract subscription ID from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const subscriptionIdIndex = pathParts.indexOf('subscriptions')
    const subscriptionId = subscriptionIdIndex >= 0 && pathParts[subscriptionIdIndex + 1]
      ? pathParts[subscriptionIdIndex + 1]
      : null

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 })
    }

    // Verify subscription exists
    const [subscription] = await sql`
      SELECT id FROM competition_level_subscriptions
      WHERE id = ${subscriptionId} AND deleted_at IS NULL
    `

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Parse query params
    const queryParams = Object.fromEntries(url.searchParams)
    const validationResult = filterLogsQuerySchema.safeParse(queryParams)
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

    const { page, limit } = validationResult.data
    const offset = (page - 1) * limit

    // Get total count
    const [countResult] = await sql`
      SELECT COUNT(*) as total
      FROM subscription_filter_logs
      WHERE subscription_id = ${subscriptionId}
    `
    const total = Number(countResult.total)

    // Get logs with pagination
    const logs = await sql`
      SELECT 
        sfl.id,
        sfl.subscription_id,
        sfl.actor_id,
        sfl.actor_role,
        sfl.old_filter_rules,
        sfl.new_filter_rules,
        sfl.admin_only_memo,
        sfl.memo_updated_at,
        sfl.memo_updated_by,
        sfl.created_at,
        u.email as actor_email
      FROM subscription_filter_logs sfl
      LEFT JOIN users u ON sfl.actor_id = u.id
      WHERE sfl.subscription_id = ${subscriptionId}
      ORDER BY sfl.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      logs: logs.map((log: any) => ({
        id: log.id,
        subscription_id: log.subscription_id,
        actor_id: log.actor_id,
        actor_role: log.actor_role,
        actor_email: log.actor_email,
        old_filter_rules: log.old_filter_rules,
        new_filter_rules: log.new_filter_rules,
        admin_only_memo: log.admin_only_memo,
        memo_updated_at: log.memo_updated_at?.toISOString() || null,
        memo_updated_by: log.memo_updated_by,
        created_at: log.created_at.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    })

  } catch (error: any) {
    console.error('Get filter logs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

