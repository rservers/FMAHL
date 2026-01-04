import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailSchema } from '@/lib/validations/auth'
import { hashToken } from '@/lib/password'
import { sql } from '@/lib/db'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'
import { verifyEmailRateLimit, addRateLimitHeaders } from '@/lib/middleware/rate-limit'
import { getClientIP } from '@/lib/middleware/auth'

/**
 * POST /api/v1/auth/verify-email
 * 
 * Email verification endpoint per EPIC 01.
 * Validates the verification token and activates the account.
 * 
 * Rate limit: 10 per IP per minute
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await verifyEmailRateLimit(request)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Get token from query params or body
    const url = new URL(request.url)
    let token = url.searchParams.get('token')

    if (!token) {
      const body = await request.json().catch(() => ({}))
      token = body.token
    }

    // Validate input
    const validationResult = verifyEmailSchema.safeParse({ token })
    if (!validationResult.success || !token) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      )
    }

    // Hash the token to compare with stored hash
    const tokenHash = await hashToken(token!)

    // Find user with this verification token
    const [user] = await sql`
      SELECT 
        id,
        email,
        role,
        email_verified,
        email_verification_token_hash,
        email_verification_expires_at
      FROM users 
      WHERE email_verification_token_hash = ${tokenHash}
    `

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      )
    }

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json({
        message: 'Email already verified. You can log in.',
        email_verified: true,
      })
    }

    // Check if token is expired
    if (new Date(user.email_verification_expires_at) < new Date()) {
      return NextResponse.json(
        { 
          error: 'Verification token expired',
          resend_available: true,
        },
        { status: 400 }
      )
    }

    // Update user: set email_verified = true, clear token, set status to active
    await sql`
      UPDATE users 
      SET 
        email_verified = true,
        email_verification_token_hash = NULL,
        email_verification_expires_at = NULL,
        status = 'active',
        updated_at = NOW()
      WHERE id = ${user.id}
    `

    // Audit log verification
    const clientIP = getClientIP(request)
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.USER_EMAIL_VERIFIED,
      entity: 'user',
      entityId: user.id,
      ipAddress: clientIP || undefined,
    })

    const response = NextResponse.json({
      message: 'Email verified successfully. You can now log in.',
      email_verified: true,
    })

    return addRateLimitHeaders(response, rateLimitResult)

  } catch (error: any) {
    console.error('Email verification error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

