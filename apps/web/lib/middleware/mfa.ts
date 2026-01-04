import { NextRequest, NextResponse } from 'next/server'
import { authenticate, type AuthenticatedUser, type AuthOptions } from './auth'
import { sql } from '../db'

/**
 * MFA Middleware for EPIC 01 - Platform Foundation & Access Control
 * 
 * Provides:
 * - MFA enforcement for admin routes
 * - MFA session tracking
 * - MFA challenge verification
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

/**
 * MFA session cookie name
 */
const MFA_SESSION_COOKIE = 'mfa_session'

/**
 * MFA session expiry (matches JWT expiry: 7 days)
 */
const MFA_SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

/**
 * Check if MFA is enabled for a user
 */
export async function isMFAEnabled(userId: string): Promise<boolean> {
  const [user] = await sql`
    SELECT mfa_enabled FROM users WHERE id = ${userId}
  `
  return user?.mfa_enabled || false
}

/**
 * Check if user has completed MFA for this session
 * Uses a signed cookie to track MFA session
 */
export function hasMFASession(request: NextRequest, userId: string): boolean {
  const mfaSession = request.cookies.get(MFA_SESSION_COOKIE)?.value
  if (!mfaSession) return false

  try {
    // MFA session format: userId:timestamp:signature
    const [sessionUserId, timestamp] = mfaSession.split(':')
    
    // Check if session is for the current user
    if (sessionUserId !== userId) return false

    // Check if session is expired
    const sessionTime = parseInt(timestamp, 10)
    if (Date.now() - sessionTime > MFA_SESSION_EXPIRY) return false

    // TODO: Verify signature with HMAC
    return true
  } catch {
    return false
  }
}

/**
 * Create an MFA session cookie
 */
export function createMFASessionCookie(userId: string): string {
  const timestamp = Date.now()
  // TODO: Add HMAC signature for security
  return `${userId}:${timestamp}`
}

/**
 * Set MFA session cookie on response
 */
export function setMFASessionCookie(response: NextResponse, userId: string): NextResponse {
  const sessionValue = createMFASessionCookie(userId)
  
  response.cookies.set(MFA_SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MFA_SESSION_EXPIRY / 1000, // Convert to seconds
    path: '/',
  })

  return response
}

/**
 * Clear MFA session cookie
 */
export function clearMFASessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(MFA_SESSION_COOKIE)
  return response
}

/**
 * MFA enforcement result
 */
export interface MFAResult {
  success: boolean
  mfaRequired?: boolean
  error?: string
  statusCode?: number
  user?: AuthenticatedUser
}

/**
 * Check if MFA is required and completed for an admin user
 */
export async function checkMFA(
  request: NextRequest,
  user: AuthenticatedUser
): Promise<MFAResult> {
  // Only admin users require MFA
  if (user.role !== 'admin') {
    return { success: true, user }
  }

  // Check if MFA is enabled for this user
  const mfaEnabled = await isMFAEnabled(user.id)
  
  if (!mfaEnabled) {
    // MFA not enabled - admin must enroll
    return {
      success: false,
      mfaRequired: true,
      error: 'MFA enrollment required. Please enable MFA for your admin account.',
      statusCode: 403,
    }
  }

  // Check if MFA session exists
  if (!hasMFASession(request, user.id)) {
    return {
      success: false,
      mfaRequired: true,
      error: 'MFA verification required',
      statusCode: 403,
    }
  }

  return { success: true, user }
}

/**
 * Middleware that requires MFA for admin routes
 * 
 * Usage:
 * ```ts
 * export const GET = requireMFA(async (request, user) => {
 *   return NextResponse.json({ adminData: {} })
 * })
 * ```
 */
export function requireMFA(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  authOptions: Omit<AuthOptions, 'requireMFA'> = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // First, authenticate the user
    const authResult = await authenticate(request, { ...authOptions, allowedRoles: ['admin'] })

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.statusCode || 401 }
      )
    }

    // Then check MFA
    const mfaResult = await checkMFA(request, authResult.user!)

    if (!mfaResult.success) {
      return NextResponse.json(
        { 
          error: mfaResult.error,
          mfa_required: mfaResult.mfaRequired,
        },
        { status: mfaResult.statusCode || 403 }
      )
    }

    return handler(request, mfaResult.user!)
  }
}

/**
 * Create an admin route handler that requires both auth and MFA
 * 
 * Usage:
 * ```ts
 * export const GET = adminWithMFA(async (request, user) => {
 *   return NextResponse.json({ sensitiveData: {} })
 * })
 * ```
 */
export function adminWithMFA(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return requireMFA(handler, { allowedRoles: ['admin'] })
}

