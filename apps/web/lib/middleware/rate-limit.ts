import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '../redis'
import { getClientIP } from './auth'

/**
 * Rate Limiting Middleware for EPIC 01 - Platform Foundation & Access Control
 * 
 * Uses Redis-backed sliding window for rate limiting.
 * 
 * Rate Limits per EPIC 01:
 * - Global (authenticated): 100 req/min per user
 * - Global (anonymous): 20 req/min per IP
 * - Login: 5 attempts per email per 15 min
 * - Register: 3 per IP per hour
 * - Forgot password: 3 per email per hour
 * - Verify email: 10 per IP per minute
 * - MFA verify: 5 per MFA token
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
  /** Key prefix for Redis */
  keyPrefix: string
}

/**
 * Predefined rate limit configurations per EPIC 01
 */
export const RateLimits = {
  /** Authenticated user: 100 requests per minute */
  AUTHENTICATED: {
    limit: 100,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:auth',
  } as RateLimitConfig,

  /** Anonymous/IP-based: 20 requests per minute */
  ANONYMOUS: {
    limit: 20,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:anon',
  } as RateLimitConfig,

  /** Login: 5 attempts per email per 15 minutes */
  LOGIN: {
    limit: 5,
    windowSeconds: 15 * 60, // 15 minutes
    keyPrefix: 'ratelimit:login',
  } as RateLimitConfig,

  /** Registration: 3 per IP per hour */
  REGISTER: {
    limit: 3,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'ratelimit:register',
  } as RateLimitConfig,

  /** Forgot password: 3 per email per hour */
  FORGOT_PASSWORD: {
    limit: 3,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'ratelimit:forgot',
  } as RateLimitConfig,

  /** Email verification: 10 per IP per minute */
  VERIFY_EMAIL: {
    limit: 10,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:verify',
  } as RateLimitConfig,

  /** MFA verification: 5 per token */
  MFA_VERIFY: {
    limit: 5,
    windowSeconds: 5 * 60, // 5 minutes (MFA token lifetime)
    keyPrefix: 'ratelimit:mfa',
  } as RateLimitConfig,

  /** Resend verification: 3 per email per hour */
  RESEND_VERIFICATION: {
    limit: 3,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'ratelimit:resend',
  } as RateLimitConfig,

  /** Lead submission: 5 per email per hour (EPIC 02) */
  LEAD_SUBMISSION: {
    limit: 5,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'ratelimit:lead_submit',
  } as RateLimitConfig,

  /** Lead confirmation: 10 per IP per minute (EPIC 02) */
  LEAD_CONFIRMATION: {
    limit: 10,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:lead_confirm',
  } as RateLimitConfig,

  /** Admin competition level create: 100 per user per minute (EPIC 04) */
  ADMIN_COMPETITION_LEVEL_CREATE: {
    limit: 100,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:admin_cl_create',
  } as RateLimitConfig,

  /** Admin competition level update: 100 per user per minute (EPIC 04) */
  ADMIN_COMPETITION_LEVEL_UPDATE: {
    limit: 100,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:admin_cl_update',
  } as RateLimitConfig,

  /** Admin competition level reorder: 50 per user per minute (EPIC 04) */
  ADMIN_COMPETITION_LEVEL_REORDER: {
    limit: 50,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:admin_cl_reorder',
  } as RateLimitConfig,

  /** Provider subscribe: 30 per user per minute (EPIC 04) */
  PROVIDER_SUBSCRIBE: {
    limit: 30,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:provider_subscribe',
  } as RateLimitConfig,

  /** Provider unsubscribe: 30 per user per minute (EPIC 04) */
  PROVIDER_UNSUBSCRIBE: {
    limit: 30,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:provider_unsubscribe',
  } as RateLimitConfig,
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number // Unix timestamp
}

/**
 * Check rate limit using sliding window algorithm
 * 
 * @param identifier - Unique identifier (user ID, email, IP, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedis()
  const now = Date.now()
  const windowStart = now - config.windowSeconds * 1000
  const key = `${config.keyPrefix}:${identifier}`

  try {
    // Use Redis transaction for atomic operations
    const pipeline = redis.pipeline()

    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart)

    // Count current requests in window
    pipeline.zcard(key)

    // Add current request
    pipeline.zadd(key, now, `${now}:${Math.random()}`)

    // Set expiry on the key
    pipeline.expire(key, config.windowSeconds)

    const results = await pipeline.exec()

    if (!results) {
      // Redis error, fail open
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit,
        resetAt: Math.floor((now + config.windowSeconds * 1000) / 1000),
      }
    }

    // Get count from results (second command)
    const count = (results[1]?.[1] as number) || 0
    const remaining = Math.max(0, config.limit - count - 1)
    const allowed = count < config.limit

    return {
      allowed,
      limit: config.limit,
      remaining,
      resetAt: Math.floor((now + config.windowSeconds * 1000) / 1000),
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // Fail open - don't block requests if Redis is down
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit,
      resetAt: Math.floor((now + config.windowSeconds * 1000) / 1000),
    }
  }
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString())
  return response
}

/**
 * Create a rate-limited route handler
 * 
 * Usage:
 * ```ts
 * export const POST = withRateLimit(
 *   RateLimits.LOGIN,
 *   (req) => req.body.email, // Use email as identifier
 *   async (request) => {
 *     // Handle login
 *   }
 * )
 * ```
 */
export function withRateLimit(
  config: RateLimitConfig,
  getIdentifier: (request: NextRequest) => string | Promise<string>,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const identifier = await getIdentifier(request)
    const result = await checkRateLimit(identifier, config)

    if (!result.allowed) {
      const response = NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: result.resetAt - Math.floor(Date.now() / 1000),
        },
        { status: 429 }
      )
      return addRateLimitHeaders(response, result)
    }

    const response = await handler(request)
    return addRateLimitHeaders(response, result)
  }
}

/**
 * Global rate limit middleware (IP-based for anonymous, user-based for authenticated)
 */
export async function globalRateLimit(
  request: NextRequest,
  userId?: string
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const config = userId ? RateLimits.AUTHENTICATED : RateLimits.ANONYMOUS
  const identifier = userId || getClientIP(request) || 'unknown'

  const result = await checkRateLimit(identifier, config)

  if (!result.allowed) {
    const response = NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: result.resetAt - Math.floor(Date.now() / 1000),
      },
      { status: 429 }
    )
    return { allowed: false, response: addRateLimitHeaders(response, result) }
  }

  return { allowed: true }
}

/**
 * Rate limit for login attempts by email
 */
export async function loginRateLimit(email: string): Promise<RateLimitResult> {
  return checkRateLimit(email.toLowerCase(), RateLimits.LOGIN)
}

/**
 * Rate limit for registration by IP
 */
export async function registerRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const ip = getClientIP(request) || 'unknown'
  return checkRateLimit(ip, RateLimits.REGISTER)
}

/**
 * Rate limit for forgot password by email
 */
export async function forgotPasswordRateLimit(email: string): Promise<RateLimitResult> {
  return checkRateLimit(email.toLowerCase(), RateLimits.FORGOT_PASSWORD)
}

/**
 * Rate limit for email verification by IP
 */
export async function verifyEmailRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const ip = getClientIP(request) || 'unknown'
  return checkRateLimit(ip, RateLimits.VERIFY_EMAIL)
}

/**
 * Rate limit for MFA verification by token
 */
export async function mfaVerifyRateLimit(mfaToken: string): Promise<RateLimitResult> {
  return checkRateLimit(mfaToken, RateLimits.MFA_VERIFY)
}

/**
 * Rate limit for resend verification by email
 */
export async function resendVerificationRateLimit(email: string): Promise<RateLimitResult> {
  return checkRateLimit(email.toLowerCase(), RateLimits.RESEND_VERIFICATION)
}

/**
 * Rate limit for lead submission by email (EPIC 02)
 */
export async function leadSubmissionRateLimit(email: string): Promise<RateLimitResult> {
  return checkRateLimit(email.toLowerCase(), RateLimits.LEAD_SUBMISSION)
}

/**
 * Rate limit for lead confirmation by IP (EPIC 02)
 */
export async function leadConfirmationRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const ip = getClientIP(request) || 'unknown'
  return checkRateLimit(ip, RateLimits.LEAD_CONFIRMATION)
}

/**
 * Rate limit for admin competition level creation by user ID (EPIC 04)
 */
export async function adminCompetitionLevelCreateRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(userId, RateLimits.ADMIN_COMPETITION_LEVEL_CREATE)
}

/**
 * Rate limit for admin competition level update by user ID (EPIC 04)
 */
export async function adminCompetitionLevelUpdateRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(userId, RateLimits.ADMIN_COMPETITION_LEVEL_UPDATE)
}

/**
 * Rate limit for admin competition level reorder by user ID (EPIC 04)
 */
export async function adminCompetitionLevelReorderRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(userId, RateLimits.ADMIN_COMPETITION_LEVEL_REORDER)
}

/**
 * Rate limit for provider subscribe by user ID (EPIC 04)
 */
export async function providerSubscribeRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(userId, RateLimits.PROVIDER_SUBSCRIBE)
}

/**
 * Rate limit for provider unsubscribe by user ID (EPIC 04)
 */
export async function providerUnsubscribeRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(userId, RateLimits.PROVIDER_UNSUBSCRIBE)
}

