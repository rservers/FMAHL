import Redis from 'ioredis';
/**
 * Get the Redis client instance (singleton)
 */
export declare function getRedis(): Redis;
/**
 * Check if Redis is connected
 */
export declare function isRedisConnected(): Promise<boolean>;
/**
 * Gracefully close Redis connection
 */
export declare function closeRedis(): Promise<void>;
export type { Redis };
//# sourceMappingURL=redis.d.ts.map