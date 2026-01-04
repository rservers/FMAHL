import { NextRequest, NextResponse } from 'next/server'
import { forgotPasswordSchema } from '@/lib/validations/auth'
import { generateSecureToken, hashToken } from '@/lib/password'
import { sql } from '@/lib/db'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'
import { forgotPasswordRateLimit, addRateLimitHeaders } from '@/lib/middleware/rate-limit'
import { getClientIP } from '@/lib/middleware/auth'
import { emailService } from '@findmeahotlead/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * POST /api/v1/auth/forgot-password
 * 
 * Request password reset link.
 * Always returns success to prevent email enumeration.
 * 
 * Rate limit: 3 per email per hour
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validationResult = forgotPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const email = validationResult.data.email.toLowerCase()

    // Check rate limit
    const rateLimitResult = await forgotPasswordRateLimit(email)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Too many password reset requests. Please try again later.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Always return the same response to prevent email enumeration
    const successResponse = {
      message: 'If an account exists with this email, a password reset link has been sent.',
    }

    // Find user
    const [user] = await sql`
      SELECT 
        id,
        email,
        role,
        status
      FROM users 
      WHERE email = ${email}
    `

    if (!user) {
      const response = NextResponse.json(successResponse)
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Don't send reset link to suspended/deactivated accounts
    if (user.status === 'suspended' || user.status === 'deactivated') {
      const response = NextResponse.json(successResponse)
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Generate reset token
    const resetToken = generateSecureToken()
    const resetTokenHash = await hashToken(resetToken)
    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Update user with reset token
    await sql`
      UPDATE users 
      SET 
        password_reset_token_hash = ${resetTokenHash},
        password_reset_expires_at = ${resetExpiresAt},
        updated_at = NOW()
      WHERE id = ${user.id}
    `

    // Audit log password reset request
    const clientIP = getClientIP(request)
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.USER_PASSWORD_RESET_REQUESTED,
      entity: 'user',
      entityId: user.id,
      ipAddress: clientIP || undefined,
    })

    await emailService.sendTemplated({
      template: 'password_reset',
      to: email,
      variables: {
        email,
        reset_link: `${APP_URL}/reset-password?token=${resetToken}`,
        expires_at: resetExpiresAt.toISOString(),
      },
      relatedEntity: { type: 'user', id: user.id },
      priority: 'high',
    })

    const response = NextResponse.json(successResponse)
    return addRateLimitHeaders(response, rateLimitResult)

  } catch (error: any) {
    console.error('Forgot password error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

