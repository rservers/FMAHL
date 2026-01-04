/**
 * Distribution Queue Helper for EPIC 06
 * 
 * Creates BullMQ queue instance for distribution jobs.
 * 
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */

import { Queue, QueueOptions, ConnectionOptions } from 'bullmq'
import IORedis from 'ioredis'

export interface DistributionJobData {
  leadId: string
  triggeredBy: {
    actorId: string
    actorRole: 'admin' | 'system'
  }
  requestedAt: string // ISO 8601
}

let distributionQueue: Queue<DistributionJobData> | null = null

export function createDistributionQueue(): Queue<DistributionJobData> {
  if (distributionQueue) {
    return distributionQueue
  }

  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
  const redisUrl = new URL(REDIS_URL)
  const connection: ConnectionOptions = {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port || '6379', 10),
    password: redisUrl.password || undefined,
  }

  distributionQueue = new Queue<DistributionJobData>('distribute_lead', {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000, // Start with 5 seconds
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  })

  return distributionQueue
}

