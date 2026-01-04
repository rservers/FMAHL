import { NextRequest, NextResponse } from 'next/server'
import { authenticate, getClientIP } from '@/lib/middleware/auth'
import { checkMFA } from '@/lib/middleware/mfa'
import { mfaVerifySchema } from '@/lib/validations/auth'
import { verifyTOTPCode } from '@/lib/mfa'
import { sql } from '@/lib/db'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'

/**
 * POST /api/v1/auth/mfa/disable
 * 
 * Disable MFA for admin account.
 * Requires current MFA verification to proceed.
 * 
 * Requires: Admin role with MFA verified
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate - only admins can disable MFA
    const authResult = await authenticate(request, { allowedRoles: ['admin'] })

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Admin access required' },
        { status: authResult.statusCode || 403 }
      )
    }

    const user = authResult.user

    // Check if MFA is currently enabled
    const [userData] = await sql`
      SELECT mfa_enabled, mfa_secret, email FROM users WHERE id = ${user.id}
    `

    if (!userData?.mfa_enabled) {
      return NextResponse.json(
        { error: 'MFA is not enabled for this account.' },
        { status: 400 }
      )
    }

    // Require current MFA code to disable
    const body = await request.json()
    const validationResult = mfaVerifySchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'MFA code required to disable MFA.' },
        { status: 400 }
      )
    }

    const { code } = validationResult.data

    // Verify the TOTP code
    const isValid = verifyTOTPCode(userData.mfa_secret, code, userData.email)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid MFA code.' },
        { status: 401 }
      )
    }

    // Disable MFA
    await sql`
      UPDATE users 
      SET 
        mfa_enabled = false,
        mfa_secret = NULL,
        updated_at = NOW()
      WHERE id = ${user.id}
    `

    // Audit log MFA disabled
    const clientIP = getClientIP(request)
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.USER_MFA_DISABLED,
      entity: 'user',
      entityId: user.id,
      adminOnlyMemo: 'MFA disabled by user',
      ipAddress: clientIP || undefined,
    })

    return NextResponse.json({
      message: 'MFA disabled successfully.',
      mfa_enabled: false,
    })

  } catch (error: any) {
    console.error('MFA disable error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

