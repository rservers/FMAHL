import { getRedis } from './redis'
import { hashTokenForRevocation } from './jwt'

/**
 * Token Revocation for EPIC 01 - Platform Foundation & Access Control
 * 
 * Uses Redis to maintain a blacklist of revoked tokens.
 * Tokens are stored as hashes with a TTL matching the token expiry (7 days).
 * 
 * Key format: revoked_token:<token_hash>
 * Value: 1
 * TTL: 7 days (604800 seconds)
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

// Token revocation key prefix
const REVOKED_TOKEN_PREFIX = 'revoked_token:'

// TTL for revoked tokens (7 days in seconds, matching JWT expiry)
const REVOKED_TOKEN_TTL = 7 * 24 * 60 * 60 // 604800 seconds

/**
 * Revoke a token by adding it to the Redis blacklist
 * Called on logout to invalidate the token
 */
export async function revokeToken(token: string): Promise<void> {
  const redis = getRedis()
  const tokenHash = await hashTokenForRevocation(token)
  const key = `${REVOKED_TOKEN_PREFIX}${tokenHash}`
  
  await redis.setex(key, REVOKED_TOKEN_TTL, '1')
}

/**
 * Check if a token has been revoked
 * Returns true if the token is in the blacklist
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  const redis = getRedis()
  const tokenHash = await hashTokenForRevocation(token)
  const key = `${REVOKED_TOKEN_PREFIX}${tokenHash}`
  
  const result = await redis.get(key)
  return result === '1'
}

/**
 * Revoke all tokens for a user by storing their user ID
 * This is a more aggressive approach - revokes ALL tokens for the user
 * Used when account is suspended/deactivated or password is changed
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  const redis = getRedis()
  const key = `revoked_user:${userId}`
  
  // Store the timestamp when tokens were revoked
  // Any token issued before this timestamp is invalid
  await redis.setex(key, REVOKED_TOKEN_TTL, Date.now().toString())
}

/**
 * Check if all tokens for a user have been revoked
 * Returns the timestamp when tokens were revoked, or null if not revoked
 */
export async function getUserTokensRevokedAt(userId: string): Promise<number | null> {
  const redis = getRedis()
  const key = `revoked_user:${userId}`
  
  const result = await redis.get(key)
  return result ? parseInt(result, 10) : null
}

/**
 * Check if a token is valid (not individually revoked and not user-revoked)
 * This is the main function to call during authentication
 */
export async function isTokenValid(token: string, userId: string, issuedAt: number): Promise<boolean> {
  // Check if token is individually revoked
  const isRevoked = await isTokenRevoked(token)
  if (isRevoked) {
    return false
  }
  
  // Check if all user tokens are revoked
  const userRevokedAt = await getUserTokensRevokedAt(userId)
  if (userRevokedAt && issuedAt * 1000 < userRevokedAt) {
    return false
  }
  
  return true
}

