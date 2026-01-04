/**
 * Distribution Job Queue Configuration for EPIC 06
 * 
 * BullMQ queue setup for async lead distribution.
 * 
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */

import { Queue, QueueOptions } from 'bullmq'
import { ConnectionOptions } from 'bullmq'

export interface DistributionJobData {
  leadId: string
  triggeredBy: {
    actorId: string
    actorRole: 'admin' | 'system'
  }
  requestedAt: string // ISO 8601
}

export function createDistributionQueue(connection: ConnectionOptions): Queue<DistributionJobData> {
  const queueOptions: QueueOptions = {
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
  }

  return new Queue<DistributionJobData>('distribute_lead', {
    connection,
    ...queueOptions,
  })
}

