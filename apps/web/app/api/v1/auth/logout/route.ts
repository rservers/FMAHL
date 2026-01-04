import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader } from '@/lib/jwt'
import { revokeToken } from '@/lib/token-revocation'
import { authenticate, getClientIP } from '@/lib/middleware/auth'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'
import { clearMFASessionCookie } from '@/lib/middleware/mfa'

/**
 * POST /api/v1/auth/logout
 * 
 * User logout endpoint per EPIC 01.
 * Revokes the current access token.
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticate(request)

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Not authenticated' },
        { status: 401 }
      )
    }

    const user = authResult.user

    // Get the token to revoke
    const authHeader = request.headers.get('authorization')
    const cookieToken = request.cookies.get('access_token')?.value
    const token = extractTokenFromHeader(authHeader) || cookieToken

    if (token) {
      // Add token to revocation blacklist
      await revokeToken(token)
    }

    // Audit log logout
    const clientIP = getClientIP(request)
    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: AuditActions.USER_LOGOUT,
      entity: 'user',
      entityId: user.id,
      ipAddress: clientIP || undefined,
    })

    const response = NextResponse.json({
      message: 'Logged out successfully',
    })

    // Clear the access token cookie
    response.cookies.delete('access_token')

    // Clear MFA session cookie if present
    clearMFASessionCookie(response)

    return response

  } catch (error: any) {
    console.error('Logout error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

