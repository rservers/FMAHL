import { NextRequest, NextResponse } from 'next/server'
import { mfaChallengeSchema } from '@/lib/validations/auth'
import { verifyMFAToken, signToken } from '@/lib/jwt'
import { verifyTOTPCode } from '@/lib/mfa'
import { sql } from '@/lib/db'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'
import { mfaVerifyRateLimit, addRateLimitHeaders } from '@/lib/middleware/rate-limit'
import { getClientIP } from '@/lib/middleware/auth'
import { setMFASessionCookie } from '@/lib/middleware/mfa'

/**
 * POST /api/v1/auth/mfa/challenge
 * 
 * Verify MFA code during login for admin accounts.
 * Called after successful password authentication.
 * Returns full access token if MFA verification passes.
 * 
 * Rate limit: 5 attempts per MFA token
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validationResult = mfaChallengeSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      )
    }

    const { mfa_token, code } = validationResult.data

    // Check rate limit
    const rateLimitResult = await mfaVerifyRateLimit(mfa_token)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Too many MFA attempts. Please log in again.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Verify the MFA token
    const mfaPayload = verifyMFAToken(mfa_token)
    if (!mfaPayload) {
      return NextResponse.json(
        { error: 'MFA token expired. Please log in again.' },
        { status: 401 }
      )
    }

    // Get user data
    const [user] = await sql`
      SELECT 
        id,
        email,
        role,
        status,
        mfa_secret,
        mfa_enabled
      FROM users 
      WHERE id = ${mfaPayload.sub}
    `

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }

    if (!user.mfa_enabled || !user.mfa_secret) {
      return NextResponse.json(
        { error: 'MFA not enabled for this account' },
        { status: 400 }
      )
    }

    const clientIP = getClientIP(request)

    // Verify the TOTP code
    const isValid = verifyTOTPCode(user.mfa_secret, code, user.email)

    if (!isValid) {
      // Log failed MFA attempt
      await logAudit({
        actorId: user.id,
        actorRole: user.role,
        action: AuditActions.USER_MFA_CHALLENGE_FAILED,
        entity: 'user',
        entityId: user.id,
        ipAddress: clientIP || undefined,
      })

      const response = NextResponse.json(
        { error: 'Invalid MFA code' },
        { status: 401 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Update last login timestamp
    await sql`
      UPDATE users 
      SET last_login_at = NOW() 
      WHERE id = ${user.id}
    `

    // Generate full access token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    })

    // Log successful MFA challenge
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.USER_MFA_CHALLENGE_PASSED,
      entity: 'user',
      entityId: user.id,
      ipAddress: clientIP || undefined,
    })

    // Also log the login
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.USER_LOGIN,
      entity: 'user',
      entityId: user.id,
      metadata: { mfa_verified: true },
      ipAddress: clientIP || undefined,
    })

    const response = NextResponse.json({
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        mfa_enabled: user.mfa_enabled,
      },
    })

    // Set HTTP-only cookie for web clients
    response.cookies.set('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })

    // Set MFA session cookie
    setMFASessionCookie(response, user.id)

    return addRateLimitHeaders(response, rateLimitResult)

  } catch (error: any) {
    console.error('MFA challenge error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

