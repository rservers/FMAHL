import { NextRequest, NextResponse } from 'next/server'
import { registerSchema } from '@/lib/validations/auth'
import { hashPassword, generateSecureToken, hashToken, validatePassword } from '@/lib/password'
import { sql } from '@/lib/db'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'
import { registerRateLimit, addRateLimitHeaders } from '@/lib/middleware/rate-limit'
import { getClientIP } from '@/lib/middleware/auth'
import { emailService } from '@findmeahotlead/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * POST /api/v1/auth/register
 * 
 * Provider registration endpoint per EPIC 01.
 * Creates a new provider account with pending status.
 * Sends email verification link.
 * 
 * Rate limit: 3 registrations per IP per hour
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await registerRateLimit(request)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }

    const body = await request.json()

    // Validate input
    const validationResult = registerSchema.safeParse(body)
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

    const { email, password, company_name, role } = validationResult.data

    // Additional password validation (email check)
    const passwordValidation = validatePassword(password, email)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: passwordValidation.errors.map(msg => ({
            field: 'password',
            message: msg,
          }))
        },
        { status: 400 }
      )
    }

    // Check if email already exists
    const [existingUser] = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()}
    `

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // Hash password (bcrypt cost 12)
    const passwordHash = await hashPassword(password)

    // Generate email verification token
    const verificationToken = generateSecureToken()
    const verificationTokenHash = await hashToken(verificationToken)
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create user with pending status
    const [user] = await sql`
      INSERT INTO users (
        email,
        password_hash,
        role,
        status,
        email_verified,
        email_verification_token_hash,
        email_verification_expires_at,
        first_name
      ) VALUES (
        ${email.toLowerCase()},
        ${passwordHash},
        ${role},
        'pending',
        false,
        ${verificationTokenHash},
        ${verificationExpiresAt},
        ${company_name || null}
      )
      RETURNING id, email, role, status, email_verified
    `

    // If registering as provider, create provider record
    // Note: This is a simplified version - full provider setup may require additional fields
    if (role === 'provider' && company_name) {
      // Provider profile will be created in a separate step or during onboarding
      // For now, we just create the user account
    }

    // Audit log registration
    const clientIP = getClientIP(request)
    await logAudit({
      actorId: user.id,
      actorRole: role,
      action: AuditActions.USER_REGISTERED,
      entity: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
      },
      ipAddress: clientIP || undefined,
    })

    // Queue verification email
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

    const response = NextResponse.json(
      {
        user_id: user.id,
        email: user.email,
        status: user.status,
        email_verified: user.email_verified,
        message: 'Registration successful. Please check your email to verify your account.',
      },
      { status: 201 }
    )

    return addRateLimitHeaders(response, rateLimitResult)

  } catch (error: any) {
    console.error('Registration error:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

