import { NextRequest, NextResponse } from 'next/server'
import { resendVerificationSchema } from '@/lib/validations/auth'
import { generateSecureToken, hashToken } from '@/lib/password'
import { sql } from '@/lib/db'
import { resendVerificationRateLimit, addRateLimitHeaders } from '@/lib/middleware/rate-limit'
import { emailService } from '@findmeahotlead/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * POST /api/v1/auth/resend-verification
 * 
 * Resend email verification link.
 * 
 * Rate limit: 3 per email per hour
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validationResult = resendVerificationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const email = validationResult.data.email.toLowerCase()

    // Check rate limit
    const rateLimitResult = await resendVerificationRateLimit(email)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Too many resend requests. Please try again later.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Find user
    const [user] = await sql`
      SELECT 
        id,
        email,
        email_verified
      FROM users 
      WHERE email = ${email}
    `

    // Always return success to prevent email enumeration
    if (!user) {
      const response = NextResponse.json({
        message: 'If an account exists with this email, a verification link has been sent.',
      })
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Check if already verified
    if (user.email_verified) {
      const response = NextResponse.json({
        message: 'If an account exists with this email, a verification link has been sent.',
      })
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Generate new verification token
    const verificationToken = generateSecureToken()
    const verificationTokenHash = await hashToken(verificationToken)
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update user with new token
    await sql`
      UPDATE users 
      SET 
        email_verification_token_hash = ${verificationTokenHash},
        email_verification_expires_at = ${verificationExpiresAt},
        updated_at = NOW()
      WHERE id = ${user.id}
    `

    await emailService.sendTemplated({
      template: 'email_verification',
      to: email,
      variables: {
        email,
        verification_link: `${APP_URL}/verify-email?token=${verificationToken}`,
        expires_at: verificationExpiresAt.toISOString(),
      },
      relatedEntity: { type: 'user', id: user.id },
      priority: 'high',
    })

    const response = NextResponse.json({
      message: 'If an account exists with this email, a verification link has been sent.',
    })

    return addRateLimitHeaders(response, rateLimitResult)

  } catch (error: any) {
    console.error('Resend verification error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

