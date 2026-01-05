/**
 * Report Caching Service for EPIC 11 - Reporting & Analytics
 * 
 * TTL-based caching for report endpoints to reduce database load.
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { getRedis } from '../redis'

const DEFAULT_TTL_SECONDS = 300 // 5 minutes

/**
 * Generate cache key for report endpoint
 */
export function generateCacheKey(
  scope: 'admin' | 'provider',
  type: string,
  from: string,
  to: string,
  filters?: Record<string, any>
): string {
  const filtersHash = filters ? JSON.stringify(filters) : 'none'
  // Simple hash - in production, use crypto.createHash
  const hash = Buffer.from(filtersHash).toString('base64').slice(0, 16)
  return `reports:${scope}:${type}:${from}:${to}:${hash}`
}

/**
 * Get cached report data
 */
export async function getCachedReport<T>(cacheKey: string): Promise<T | null> {
  const redis = getRedis()
  const cached = await redis.get(cacheKey)
  
  if (!cached) {
    return null
  }
  
  try {
    return JSON.parse(cached) as T
  } catch (error) {
    console.error('Failed to parse cached report:', error)
    return null
  }
}

/**
 * Set cached report data
 */
export async function setCachedReport<T>(
  cacheKey: string,
  data: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const redis = getRedis()
  await redis.setex(cacheKey, ttlSeconds, JSON.stringify(data))
}

/**
 * Invalidate cache for a report type (optional, for future use)
 */
export async function invalidateReportCache(
  scope: 'admin' | 'provider',
  type: string
): Promise<void> {
  const redis = getRedis()
  const pattern = `reports:${scope}:${type}:*`
  
  // Note: Redis KEYS is expensive, use SCAN in production
  const keys = await redis.keys(pattern)
  
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}

/**
 * Check if cache should be bypassed
 */
export function shouldBypassCache(searchParams: URLSearchParams): boolean {
  return searchParams.get('no_cache') === 'true'
}

