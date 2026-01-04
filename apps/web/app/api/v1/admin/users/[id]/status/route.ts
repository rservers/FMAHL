import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { updateUserStatusSchema } from '@/lib/validations/admin'
import { sql } from '@/lib/db'
import { logAdminAction, AuditActions } from '@/lib/services/audit-logger'
import { revokeAllUserTokens } from '@/lib/token-revocation'
import { getClientIP, type AuthenticatedUser } from '@/lib/middleware/auth'

/**
 * PUT /api/v1/admin/users/:id/status
 * 
 * Update user account status.
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
    const statusIndex = pathParts.indexOf('status')
    const id = statusIndex > 0 ? pathParts[statusIndex - 1] : null

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
    const validationResult = updateUserStatusSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid status value', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { status, reason } = validationResult.data

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

    // Prevent changing status of system user
    if (targetUser.role === 'system') {
      return NextResponse.json(
        { error: 'Cannot modify system user' },
        { status: 403 }
      )
    }

    // Prevent self-suspension/deactivation
    if (targetUser.id === user.id && (status === 'suspended' || status === 'deactivated')) {
      return NextResponse.json(
        { error: 'Cannot suspend or deactivate your own account' },
        { status: 403 }
      )
    }

    const previousStatus = targetUser.status

    // Update user status
    await sql`
      UPDATE users 
      SET 
        status = ${status},
        updated_at = NOW()
      WHERE id = ${id}
    `

    // If suspending or deactivating, revoke all tokens
    if (status === 'suspended' || status === 'deactivated') {
      await revokeAllUserTokens(id)
    }

    // Audit log status change
    const clientIP = getClientIP(request)
    await logAdminAction(
      AuditActions.ADMIN_USER_STATUS_CHANGED,
      user.id,
      'user',
      id,
      {
        previous_status: previousStatus,
        new_status: status,
        target_email: targetUser.email,
      },
      reason,
      clientIP || undefined
    )

    // TODO: Send status change email notification (Epic 10)

    return NextResponse.json({
      user_id: id,
      status,
      updated_at: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Update user status error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

