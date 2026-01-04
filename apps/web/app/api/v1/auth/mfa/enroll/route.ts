import { NextRequest, NextResponse } from 'next/server'
import { authenticate, getClientIP } from '@/lib/middleware/auth'
import { createMFAEnrollment } from '@/lib/mfa'
import { hashToken } from '@/lib/password'
import { sql } from '@/lib/db'

/**
 * POST /api/v1/auth/mfa/enroll
 * 
 * Start MFA enrollment for admin accounts.
 * Generates a new TOTP secret and returns QR code data.
 * 
 * Requires: Admin role
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate - only admins can enroll in MFA
    const authResult = await authenticate(request, { allowedRoles: ['admin'] })

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Admin access required' },
        { status: authResult.statusCode || 403 }
      )
    }

    const user = authResult.user

    // Check if MFA is already enabled
    const [userData] = await sql`
      SELECT mfa_enabled, mfa_secret FROM users WHERE id = ${user.id}
    `

    if (userData?.mfa_enabled) {
      return NextResponse.json(
        { error: 'MFA is already enabled. Disable it first to re-enroll.' },
        { status: 400 }
      )
    }

    // Generate new MFA enrollment data
    const enrollment = createMFAEnrollment(user.email)

    // Store the secret (hashed) temporarily - will be confirmed when user verifies
    // For enrollment, we store unhashed since we need it for verification
    // The secret will be properly secured once enrollment is confirmed
    await sql`
      UPDATE users 
      SET 
        mfa_secret = ${enrollment.secret},
        updated_at = NOW()
      WHERE id = ${user.id}
    `

    return NextResponse.json({
      message: 'MFA enrollment started. Scan the QR code with your authenticator app.',
      enrollment: {
        secret: enrollment.secret, // User may need to enter this manually
        uri: enrollment.uri,       // For QR code generation
        issuer: enrollment.issuer,
      },
      // Note: In production, generate QR code server-side or use a library client-side
      qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(enrollment.uri)}`,
    })

  } catch (error: any) {
    console.error('MFA enrollment error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

