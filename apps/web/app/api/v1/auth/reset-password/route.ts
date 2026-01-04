import { NextRequest, NextResponse } from 'next/server'
import { resetPasswordSchema } from '@/lib/validations/auth'
import { hashPassword, hashToken, validatePassword } from '@/lib/password'
import { sql } from '@/lib/db'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'
import { revokeAllUserTokens } from '@/lib/token-revocation'
import { getClientIP } from '@/lib/middleware/auth'

/**
 * POST /api/v1/auth/reset-password
 * 
 * Reset password with token.
 * Invalidates all existing sessions.
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validationResult = resetPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.issues.map((e) => ({
            field: String(e.path.join('.')),
            message: e.message,
          }))
        },
        { status: 400 }
      )
    }

    const { token, new_password } = validationResult.data

    // Hash the token to compare with stored hash
    const tokenHash = await hashToken(token)

    // Find user with this reset token
    const [user] = await sql`
      SELECT 
        id,
        email,
        role,
        password_reset_token_hash,
        password_reset_expires_at
      FROM users 
      WHERE password_reset_token_hash = ${tokenHash}
    `

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid reset token' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date(user.password_reset_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Reset token expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Validate new password (including email check)
    const passwordValidation = validatePassword(new_password, user.email)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: passwordValidation.errors.map(msg => ({
            field: 'new_password',
            message: msg,
          }))
        },
        { status: 400 }
      )
    }

    // Hash new password
    const passwordHash = await hashPassword(new_password)

    // Update user password and clear reset token
    await sql`
      UPDATE users 
      SET 
        password_hash = ${passwordHash},
        password_reset_token_hash = NULL,
        password_reset_expires_at = NULL,
        updated_at = NOW()
      WHERE id = ${user.id}
    `

    // Revoke all existing tokens for this user
    await revokeAllUserTokens(user.id)

    // Audit log password reset
    const clientIP = getClientIP(request)
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.USER_PASSWORD_RESET,
      entity: 'user',
      entityId: user.id,
      ipAddress: clientIP || undefined,
    })

    return NextResponse.json({
      message: 'Password reset successfully. You can now log in.',
    })

  } catch (error: any) {
    console.error('Reset password error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

