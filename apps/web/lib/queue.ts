/**
 * BullMQ Queue Factory for EPIC 12
 * 
 * Creates and manages BullMQ queue instances
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { Queue, ConnectionOptions } from 'bullmq'
import IORedis from 'ioredis'
import { getRedis } from './redis'

// Cache for queue instances
const queueCache = new Map<string, Queue>()

/**
 * Get or create a BullMQ queue instance
 */
export function getQueue(name: string): Queue {
  if (queueCache.has(name)) {
    return queueCache.get(name)!
  }

  // Get Redis connection from existing Redis instance
  const redis = getRedis()
  
  // Create queue with Redis connection
  const queue = new Queue(name, {
    connection: {
      host: redis.options.host,
      port: redis.options.port,
      password: redis.options.password,
    },
  })

  queueCache.set(name, queue)
  return queue
}

/**
 * Close all queues (for graceful shutdown)
 */
export async function closeAllQueues(): Promise<void> {
  await Promise.all(
    Array.from(queueCache.values()).map(queue => queue.close())
  )
  queueCache.clear()
}

