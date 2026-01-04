/**
 * GET /api/v1/admin/payments
 * 
 * Query payments by status, provider, date range (admin only).
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { adminPaymentsQuerySchema } from '@/lib/validations/billing'
import { sql } from '@/lib/db'

export const GET = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Parse query params
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const validationResult = adminPaymentsQuerySchema.safeParse(queryParams)
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

    const { page, limit, status, provider_id, date_from, date_to } = validationResult.data
    const offset = (page - 1) * limit

    // Build WHERE conditions
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      conditions.push(`pay.status = $${paramIndex++}`)
      params.push(status)
    }

    if (provider_id) {
      conditions.push(`pay.provider_id = $${paramIndex++}`)
      params.push(provider_id)
    }

    if (date_from) {
      conditions.push(`pay.created_at >= $${paramIndex++}`)
      params.push(date_from)
    }

    if (date_to) {
      conditions.push(`pay.created_at <= $${paramIndex++}`)
      params.push(date_to)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM payments pay
      ${whereClause}
    `
    const [countResult] = await sql.unsafe(countQuery, params)
    const total = Number(countResult.total)

    // Get payments
    const paymentsQuery = `
      SELECT 
        pay.id,
        pay.provider_id,
        pay.provider_name,
        pay.external_payment_id,
        pay.amount,
        pay.currency,
        pay.status,
        pay.metadata,
        pay.created_at,
        pay.updated_at,
        p.business_name,
        u.email as provider_email
      FROM payments pay
      JOIN providers p ON pay.provider_id = p.id
      JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY pay.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    params.push(limit, offset)

    const payments = await sql.unsafe(paymentsQuery, params)

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      payments: payments.map((pay: any) => ({
        id: pay.id,
        provider_id: pay.provider_id,
        provider_name: pay.provider_name,
        provider_email: pay.provider_email,
        business_name: pay.business_name,
        external_payment_id: pay.external_payment_id,
        amount: parseFloat(pay.amount.toString()),
        currency: pay.currency,
        status: pay.status,
        metadata: pay.metadata,
        created_at: pay.created_at.toISOString(),
        updated_at: pay.updated_at.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    })
  } catch (error: any) {
    console.error('Admin payments query error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

