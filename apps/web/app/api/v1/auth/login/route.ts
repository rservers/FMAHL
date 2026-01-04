import { NextRequest, NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validations/auth'
import { verifyPassword } from '@/lib/password'
import { signToken, signMFAToken } from '@/lib/jwt'
import { sql } from '@/lib/db'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'
import { loginRateLimit, addRateLimitHeaders } from '@/lib/middleware/rate-limit'
import { getClientIP } from '@/lib/middleware/auth'

/**
 * POST /api/v1/auth/login
 * 
 * User login endpoint per EPIC 01.
 * Returns JWT access token or MFA challenge for admin accounts.
 * 
 * Rate limit: 5 attempts per email per 15 minutes
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  let email = ''
  
  try {
    const body = await request.json()

    // Validate input
    const validationResult = loginSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    email = validationResult.data.email.toLowerCase()
    const { password } = validationResult.data

    // Check rate limit by email
    const rateLimitResult = await loginRateLimit(email)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Find user
    const [user] = await sql`
      SELECT 
        id,
        email,
        password_hash,
        role,
        status,
        email_verified,
        mfa_enabled,
        first_name,
        last_name
      FROM users 
      WHERE email = ${email}
    `

    const clientIP = getClientIP(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check account status
    if (user.status === 'suspended') {
      await logAudit({
        actorId: user.id,
        actorRole: user.role,
        action: AuditActions.USER_LOGIN_FAILED,
        entity: 'user',
        entityId: user.id,
        metadata: { reason: 'account_suspended' },
        ipAddress: clientIP || undefined,
      })

      return NextResponse.json(
        { error: 'Your account has been suspended. Please contact support.' },
        { status: 403 }
      )
    }

    if (user.status === 'deactivated') {
      await logAudit({
        actorId: user.id,
        actorRole: user.role,
        action: AuditActions.USER_LOGIN_FAILED,
        entity: 'user',
        entityId: user.id,
        metadata: { reason: 'account_deactivated' },
        ipAddress: clientIP || undefined,
      })

      return NextResponse.json(
        { error: 'Your account has been deactivated.' },
        { status: 403 }
      )
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash)

    if (!isValidPassword) {
      await logAudit({
        actorId: user.id,
        actorRole: user.role,
        action: AuditActions.USER_LOGIN_FAILED,
        entity: 'user',
        entityId: user.id,
        metadata: { reason: 'invalid_password' },
        ipAddress: clientIP || undefined,
      })

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check email verification for providers
    if (user.role === 'provider' && !user.email_verified) {
      return NextResponse.json(
        { error: 'Please verify your email before logging in' },
        { status: 403 }
      )
    }

    // Handle MFA for admin accounts
    if (user.role === 'admin' && user.mfa_enabled) {
      // Generate temporary MFA challenge token (5 min expiry)
      const mfaToken = signMFAToken({
        userId: user.id,
        email: user.email,
      })

      return NextResponse.json({
        mfa_required: true,
        mfa_token: mfaToken,
      })
    }

    // Update last login timestamp
    await sql`
      UPDATE users 
      SET last_login_at = NOW() 
      WHERE id = ${user.id}
    `

    // Generate JWT token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    })

    // Audit log successful login
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.USER_LOGIN,
      entity: 'user',
      entityId: user.id,
      ipAddress: clientIP || undefined,
    })

    const response = NextResponse.json({
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        email_verified: user.email_verified,
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

    return addRateLimitHeaders(response, rateLimitResult)

  } catch (error: any) {
    console.error('Login error:', error)

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

