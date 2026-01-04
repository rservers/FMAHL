import jwt from 'jsonwebtoken'

/**
 * JWT utilities for EPIC 01 - Platform Foundation & Access Control
 * 
 * Token structure per EPIC 01:
 * - sub: user_id
 * - email: user email
 * - role: user role (admin, provider, end_user, system)
 * - status: account status (pending, active, suspended, deactivated)
 * - iat: issued at timestamp
 * - exp: expiry timestamp (7 days from iat)
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// Token expiry: 7 days (per EPIC 01)
const TOKEN_EXPIRY = '7d'

// MFA temporary token expiry: 5 minutes (per EPIC 01)
const MFA_TOKEN_EXPIRY = '5m'

// User roles
export type UserRole = 'admin' | 'provider' | 'end_user' | 'system'

// User status
export type UserStatus = 'pending' | 'active' | 'suspended' | 'deactivated'

/**
 * JWT Payload structure per EPIC 01
 */
export interface JWTPayload {
  sub: string        // user_id
  email: string
  role: UserRole
  status: UserStatus
  iat: number
  exp: number
}

/**
 * Legacy payload interface for backwards compatibility
 */
export interface LegacyJWTPayload {
  userId: string
  email: string
  role: 'admin' | 'provider' | 'end_user'
  status?: UserStatus
}

/**
 * MFA temporary token payload
 */
export interface MFATokenPayload {
  sub: string        // user_id
  email: string
  type: 'mfa_challenge'
  iat: number
  exp: number
}

/**
 * Sign a JWT token with user data
 * Returns a 7-day access token per EPIC 01
 */
export function signToken(user: {
  userId: string
  email: string
  role: UserRole
  status: UserStatus
}): string {
  const payload = {
    sub: user.userId,
    email: user.email,
    role: user.role,
    status: user.status,
  }
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
}

/**
 * Sign a temporary MFA challenge token (5 minutes)
 * Used when admin with MFA enabled logs in
 */
export function signMFAToken(user: {
  userId: string
  email: string
}): string {
  const payload = {
    sub: user.userId,
    email: user.email,
    type: 'mfa_challenge',
  }
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MFA_TOKEN_EXPIRY })
}

/**
 * Verify and decode a JWT token
 * Returns the payload if valid, null otherwise
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return decoded
  } catch (error) {
    return null
  }
}

/**
 * Verify an MFA challenge token
 * Returns the payload if valid, null otherwise
 */
export function verifyMFAToken(token: string): MFATokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as MFATokenPayload
    if (decoded.type !== 'mfa_challenge') {
      return null
    }
    return decoded
  } catch (error) {
    return null
  }
}

/**
 * Decode a token without verification (for getting user info from expired tokens)
 * WARNING: Do not use for authorization decisions
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload
  } catch (error) {
    return null
  }
}

/**
 * Hash a token for revocation lookup
 * Uses SHA-256 for fast lookup in Redis
 */
export async function hashTokenForRevocation(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Extract token from Authorization header
 * Supports "Bearer <token>" format
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null
  
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null
  }
  
  return parts[1]
}
