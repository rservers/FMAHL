import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { sql } from '@/lib/db'

/**
 * GET /api/v1/admin/users/:id
 * 
 * Get user details by ID.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export const GET = adminWithMFA(async (request: NextRequest) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      )
    }

    const [user] = await sql`
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
      WHERE id = ${id}
    `

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get provider info if user is a provider
    let provider = null
    if (user.role === 'provider') {
      const [providerData] = await sql`
        SELECT 
          id,
          business_name,
          business_phone,
          business_email,
          website_url,
          status as provider_status,
          created_at as provider_created_at
        FROM providers
        WHERE user_id = ${id}
      `
      provider = providerData || null
    }

    return NextResponse.json({
      user: {
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
        provider,
      },
    })

  } catch (error: any) {
    console.error('Get user error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

