/**
 * Queue Monitoring Service for EPIC 12
 * 
 * Provides queue status and metrics from BullMQ
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { getQueue } from '../queue'
import { sql } from '../db'
import type { QueueStatus } from '../types/observability'

/**
 * Get status for all queues
 */
export async function getQueueStatuses(): Promise<QueueStatus[]> {
  const queueNames = ['distribution', 'email', 'report-export']
  const statuses: QueueStatus[] = []

  for (const queueName of queueNames) {
    try {
      const queue = getQueue(queueName)
      const jobCounts = await queue.getJobCounts()
      
      // Get failed jobs in last hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000
      const failedJobs = await queue.getFailed(0, 100)
      const failedLastHour = failedJobs.filter(
        job => job.failedAt && job.failedAt > oneHourAgo
      ).length

      // Get DLQ size from database
      const [dlqCount] = await sql`
        SELECT COUNT(*) as count
        FROM dead_letter_queue
        WHERE queue_name = ${queueName}
          AND resolved = false
      `

      statuses.push({
        name: queueName,
        depth: jobCounts.waiting + jobCounts.active,
        active: jobCounts.active,
        failed_last_hour: failedLastHour,
        dlq_size: Number(dlqCount.count) || 0,
      })
    } catch (error) {
      // If queue doesn't exist or error, return zero status
      statuses.push({
        name: queueName,
        depth: 0,
        active: 0,
        failed_last_hour: 0,
        dlq_size: 0,
      })
    }
  }

  return statuses
}

