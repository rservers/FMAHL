import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthenticatedUser } from '@/lib/middleware/auth'
import { sql } from '@/lib/db'

/**
 * GET /api/v1/auth/me
 * 
 * Get current user information.
 * Requires authentication.
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (user: AuthenticatedUser) => {
    // Fetch fresh user data from database
    const [userData] = await sql`
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
        last_login_at
      FROM users 
      WHERE id = ${user.id}
    `

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        status: userData.status,
        email_verified: userData.email_verified,
        mfa_enabled: userData.mfa_enabled,
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone: userData.phone,
        created_at: userData.created_at,
        last_login_at: userData.last_login_at,
      },
    })
  })
}

