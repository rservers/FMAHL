/**
 * Confirmation token generation and validation for EPIC 02
 * 
 * Tokens are:
 * - 32-byte random strings
 * - URL-safe base64 encoded
 * - Stored as SHA-256 hash
 * - Single-use
 * - 24-hour expiry
 * 
 * @see .cursor/docs/Delivery/Epic_02_Lead_Intake_Confirmation.md
 */

import crypto from 'crypto'

/**
 * Generate a cryptographically secure confirmation token
 * Returns the plaintext token (to be sent to user) and its hash (to be stored)
 */
export function generateConfirmationToken(): {
  token: string
  tokenHash: string
} {
  // Generate 32 random bytes
  const randomBytes = crypto.randomBytes(32)
  
  // Encode as URL-safe base64
  const token = randomBytes.toString('base64url')
  
  // Hash with SHA-256 for storage
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  
  return { token, tokenHash }
}

/**
 * Hash a token for comparison with stored hash
 */
export function hashConfirmationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Validate token format (URL-safe base64, reasonable length)
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false
  }
  
  // URL-safe base64: A-Z, a-z, 0-9, -, _
  // 32 bytes = 43 characters in base64url
  const base64UrlRegex = /^[A-Za-z0-9_-]{32,}$/
  
  return base64UrlRegex.test(token) && token.length <= 100 // Reasonable max length
}

/**
 * Calculate token expiry (24 hours from now)
 */
export function getTokenExpiry(): Date {
  const expiry = new Date()
  expiry.setHours(expiry.getHours() + 24)
  return expiry
}

