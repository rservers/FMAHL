import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { listUsersQuerySchema } from '@/lib/validations/admin'
import { sql } from '@/lib/db'

/**
 * GET /api/v1/admin/users
 * 
 * List users with pagination and filters.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export const GET = adminWithMFA(async (request: NextRequest) => {
  try {
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)

    // Validate query params
    const validationResult = listUsersQuerySchema.safeParse(queryParams)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { page, limit, role, status, search, sort_by, sort_order } = validationResult.data
    const offset = (page - 1) * limit

    // Build dynamic query
    let whereConditions: string[] = []
    let params: any[] = []
    let paramIndex = 1

    if (role) {
      whereConditions.push(`role = $${paramIndex++}`)
      params.push(role)
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex++}`)
      params.push(status)
    }

    if (search) {
      whereConditions.push(`(email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex++})`)
      params.push(`%${search}%`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`
    const [countResult] = await sql.unsafe(countQuery, params)
    const total = parseInt(countResult.total, 10)

    // Get paginated results
    const usersQuery = `
      SELECT 
        id,
        email,
        role,
        status,
        email_verified,
        mfa_enabled,
        first_name,
        last_name,
        phone,
        created_at,
        updated_at,
        last_login_at
      FROM users
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order.toUpperCase()}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    params.push(limit, offset)

    const users = await sql.unsafe(usersQuery, params)

    return NextResponse.json({
      users: users.map((user: any) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        email_verified: user.email_verified,
        mfa_enabled: user.mfa_enabled,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login_at: user.last_login_at,
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    })

  } catch (error: any) {
    console.error('List users error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

