import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { updateUserRoleSchema } from '@/lib/validations/admin'
import { sql } from '@/lib/db'
import { logAdminAction, AuditActions } from '@/lib/services/audit-logger'
import { revokeAllUserTokens } from '@/lib/token-revocation'
import { getClientIP, type AuthenticatedUser } from '@/lib/middleware/auth'

/**
 * PUT /api/v1/admin/users/:id/role
 * 
 * Update user role.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export const PUT = adminWithMFA(async (
  request: NextRequest,
  user: AuthenticatedUser
) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const roleIndex = pathParts.indexOf('role')
    const id = roleIndex > 0 ? pathParts[roleIndex - 1] : null

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate input
    const validationResult = updateUserRoleSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid role value', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { role } = validationResult.data

    // Get current user data
    const [targetUser] = await sql`
      SELECT id, email, role, status FROM users WHERE id = ${id}
    `

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent changing role of system user
    if (targetUser.role === 'system') {
      return NextResponse.json(
        { error: 'Cannot modify system user' },
        { status: 403 }
      )
    }

    // Prevent self-demotion from admin
    if (targetUser.id === user.id && role !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot demote your own admin account' },
        { status: 403 }
      )
    }

    const previousRole = targetUser.role

    // Update user role
    await sql`
      UPDATE users 
      SET 
        role = ${role},
        updated_at = NOW()
      WHERE id = ${id}
    `

    // Revoke all tokens to force re-authentication with new role
    await revokeAllUserTokens(id)

    // Audit log role change
    const clientIP = getClientIP(request)
    await logAdminAction(
      AuditActions.ADMIN_USER_ROLE_CHANGED,
      user.id,
      'user',
      id,
      {
        previous_role: previousRole,
        new_role: role,
        target_email: targetUser.email,
      },
      undefined,
      clientIP || undefined
    )

    return NextResponse.json({
      user_id: id,
      role,
      updated_at: new Date().toISOString(),
      message: 'Role updated. User will need to log in again.',
    })

  } catch (error: any) {
    console.error('Update user role error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

