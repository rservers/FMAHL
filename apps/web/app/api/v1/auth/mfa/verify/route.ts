import { NextRequest, NextResponse } from 'next/server'
import { authenticate, getClientIP } from '@/lib/middleware/auth'
import { mfaVerifySchema } from '@/lib/validations/auth'
import { verifyTOTPCode } from '@/lib/mfa'
import { sql } from '@/lib/db'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'
import { setMFASessionCookie } from '@/lib/middleware/mfa'

/**
 * POST /api/v1/auth/mfa/verify
 * 
 * Complete MFA enrollment by verifying a TOTP code.
 * This confirms that the user has successfully set up their authenticator app.
 * 
 * Requires: Admin role
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate - only admins can verify MFA
    const authResult = await authenticate(request, { allowedRoles: ['admin'] })

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Admin access required' },
        { status: authResult.statusCode || 403 }
      )
    }

    const user = authResult.user

    // Validate input
    const body = await request.json()
    const validationResult = mfaVerifySchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid MFA code' },
        { status: 400 }
      )
    }

    const { code } = validationResult.data

    // Get user's MFA secret
    const [userData] = await sql`
      SELECT mfa_secret, mfa_enabled, email FROM users WHERE id = ${user.id}
    `

    if (!userData?.mfa_secret) {
      return NextResponse.json(
        { error: 'MFA enrollment not started. Please start enrollment first.' },
        { status: 400 }
      )
    }

    // Verify the TOTP code
    const isValid = verifyTOTPCode(userData.mfa_secret, code, userData.email)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid MFA code. Please try again.' },
        { status: 400 }
      )
    }

    // Enable MFA for the user
    await sql`
      UPDATE users 
      SET 
        mfa_enabled = true,
        updated_at = NOW()
      WHERE id = ${user.id}
    `

    // Audit log MFA enabled
    const clientIP = getClientIP(request)
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.USER_MFA_ENABLED,
      entity: 'user',
      entityId: user.id,
      ipAddress: clientIP || undefined,
    })

    // Set MFA session cookie
    const response = NextResponse.json({
      message: 'MFA enabled successfully.',
      mfa_enabled: true,
    })

    return setMFASessionCookie(response, user.id)

  } catch (error: any) {
    console.error('MFA verify error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

