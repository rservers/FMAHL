import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, extractTokenFromHeader, type JWTPayload, type UserRole, type UserStatus } from '../jwt'
import { isTokenValid } from '../token-revocation'
import { sql } from '../db'

/**
 * Authentication Middleware for EPIC 01 - Platform Foundation & Access Control
 * 
 * Provides:
 * - JWT verification
 * - Token revocation check (Redis)
 * - Account status enforcement
 * - Email verification check (for providers)
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

/**
 * Authenticated user context attached to requests
 */
export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
  status: UserStatus
}

/**
 * Options for authentication middleware
 */
export interface AuthOptions {
  /** Roles allowed to access this route */
  allowedRoles?: UserRole[]
  /** Whether to require email verification (default: true for providers) */
  requireEmailVerified?: boolean
  /** Whether to require MFA for this route (for admin routes) */
  requireMFA?: boolean
}

/**
 * Result of authentication check
 */
export interface AuthResult {
  success: boolean
  user?: AuthenticatedUser
  error?: string
  statusCode?: number
}

/**
 * Authenticate a request and return the user if valid
 */
export async function authenticate(
  request: NextRequest,
  options: AuthOptions = {}
): Promise<AuthResult> {
  // Extract token from Authorization header or cookie
  const authHeader = request.headers.get('authorization')
  const cookieToken = request.cookies.get('access_token')?.value
  const token = extractTokenFromHeader(authHeader) || cookieToken

  if (!token) {
    return {
      success: false,
      error: 'Authentication required',
      statusCode: 401,
    }
  }

  // Verify JWT signature and expiry
  const payload = verifyToken(token)
  if (!payload) {
    return {
      success: false,
      error: 'Invalid or expired token',
      statusCode: 401,
    }
  }

  // Check token revocation (Redis)
  try {
    const isValid = await isTokenValid(token, payload.sub, payload.iat)
    if (!isValid) {
      return {
        success: false,
        error: 'Token has been revoked',
        statusCode: 401,
      }
    }
  } catch (error) {
    // If Redis is down, fail open but log the error
    console.error('Token revocation check failed:', error)
    // Continue with authentication - Redis being down shouldn't lock out users
  }

  // Check account status
  if (payload.status === 'suspended') {
    return {
      success: false,
      error: 'Your account has been suspended. Please contact support.',
      statusCode: 403,
    }
  }

  if (payload.status === 'deactivated') {
    return {
      success: false,
      error: 'Your account has been deactivated.',
      statusCode: 403,
    }
  }

  if (payload.status === 'pending') {
    return {
      success: false,
      error: 'Your account is pending activation.',
      statusCode: 403,
    }
  }

  // Check role authorization
  if (options.allowedRoles && options.allowedRoles.length > 0) {
    if (!options.allowedRoles.includes(payload.role)) {
      return {
        success: false,
        error: 'You do not have permission to access this resource',
        statusCode: 403,
      }
    }
  }

  // Check email verification for providers (default: required)
  const requireEmailVerified = options.requireEmailVerified ?? (payload.role === 'provider')
  if (requireEmailVerified && payload.role === 'provider') {
    // Fetch current email_verified status from database
    const [user] = await sql`
      SELECT email_verified FROM users WHERE id = ${payload.sub}
    `
    if (user && !user.email_verified) {
      return {
        success: false,
        error: 'Please verify your email before accessing this resource',
        statusCode: 403,
      }
    }
  }

  return {
    success: true,
    user: {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    },
  }
}

/**
 * Create an authenticated response wrapper for API routes
 * 
 * Usage:
 * ```ts
 * export async function GET(request: NextRequest) {
 *   return withAuth(request, async (user) => {
 *     // user is guaranteed to be authenticated
 *     return NextResponse.json({ userId: user.id })
 *   })
 * }
 * ```
 */
export async function withAuth(
  request: NextRequest,
  handler: (user: AuthenticatedUser) => Promise<NextResponse>,
  options: AuthOptions = {}
): Promise<NextResponse> {
  const result = await authenticate(request, options)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.statusCode || 401 }
    )
  }

  return handler(result.user!)
}

/**
 * Higher-order function to create an authenticated route handler
 * 
 * Usage:
 * ```ts
 * export const GET = createAuthHandler(async (request, user) => {
 *   return NextResponse.json({ userId: user.id })
 * }, { allowedRoles: ['admin'] })
 * ```
 */
export function createAuthHandler(
  handler: (request: NextRequest, user: AuthenticatedUser, context?: any) => Promise<NextResponse>,
  options: AuthOptions = {}
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    return withAuth(request, (user) => handler(request, user, context), options)
  }
}

/**
 * Get the current user from a request (without failing if not authenticated)
 * Returns null if not authenticated
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const result = await authenticate(request)
  return result.success ? result.user! : null
}

/**
 * Check if a user has one of the specified roles
 */
export function hasRole(user: AuthenticatedUser, ...roles: UserRole[]): boolean {
  return roles.includes(user.role)
}

/**
 * Check if a user is an admin
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'admin'
}

/**
 * Check if a user is a provider
 */
export function isProvider(user: AuthenticatedUser): boolean {
  return user.role === 'provider'
}

/**
 * Get the client IP address from a request
 */
export function getClientIP(request: NextRequest): string | null {
  // Check X-Forwarded-For header (for proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  // Check X-Real-IP header
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  return null
}

