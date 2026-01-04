import Redis from 'ioredis'

/**
 * Redis client for EPIC 01 - Platform Foundation & Access Control
 * 
 * Used for:
 * - Token revocation (blacklist)
 * - Rate limiting
 * - Session management
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Singleton Redis client
let redis: Redis | null = null

/**
 * Get the Redis client instance (singleton)
 */
export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.error('Redis connection failed after 3 retries')
          return null // Stop retrying
        }
        const delay = Math.min(times * 200, 2000)
        return delay
      },
      lazyConnect: true,
    })

    redis.on('error', (err) => {
      console.error('Redis connection error:', err)
    })

    redis.on('connect', () => {
      console.log('✅ Redis connected')
    })
  }

  return redis
}

/**
 * Check if Redis is connected
 */
export async function isRedisConnected(): Promise<boolean> {
  try {
    const client = getRedis()
    await client.ping()
    return true
  } catch (error) {
    return false
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}

// Export the Redis type for use in other modules
export type { Redis }

