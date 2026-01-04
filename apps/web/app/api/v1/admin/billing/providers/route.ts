/**
 * GET /api/v1/admin/billing/providers
 * 
 * List providers with balance information (admin only).
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { adminProvidersQuerySchema } from '@/lib/validations/billing'
import { sql } from '@/lib/db'

export const GET = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Parse query params
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const validationResult = adminProvidersQuerySchema.safeParse(queryParams)
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

    const { page, limit, search, status } = validationResult.data
    const offset = (page - 1) * limit

    // Build WHERE conditions
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (search) {
      conditions.push(`(p.business_name ILIKE $${paramIndex++} OR u.email ILIKE $${paramIndex++})`)
      params.push(`%${search}%`, `%${search}%`)
    }

    if (status) {
      conditions.push(`p.status = $${paramIndex++}`)
      params.push(status)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM providers p
      JOIN users u ON p.user_id = u.id
      ${whereClause}
    `
    const [countResult] = await sql.unsafe(countQuery, params)
    const total = Number(countResult.total)

    // Get providers with balance info
    const providersQuery = `
      SELECT 
        p.id,
        p.business_name,
        p.status,
        p.balance,
        p.low_balance_threshold,
        u.email,
        (
          SELECT COUNT(*) 
          FROM competition_level_subscriptions cls 
          WHERE cls.provider_id = p.id AND cls.deleted_at IS NULL
        ) as subscription_count,
        (
          SELECT MAX(created_at) 
          FROM payments pay 
          WHERE pay.provider_id = p.id AND pay.status = 'completed'
        ) as last_deposit_at
      FROM providers p
      JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    params.push(limit, offset)

    const providers = await sql.unsafe(providersQuery, params)

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      providers: providers.map((p: any) => ({
        id: p.id,
        business_name: p.business_name,
        email: p.email,
        status: p.status,
        balance: parseFloat(p.balance.toString()),
        low_balance_threshold: p.low_balance_threshold ? parseFloat(p.low_balance_threshold.toString()) : null,
        subscription_count: Number(p.subscription_count),
        last_deposit_at: p.last_deposit_at?.toISOString() || null,
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    })
  } catch (error: any) {
    console.error('Admin providers list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

