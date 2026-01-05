/**
 * DLQ Capture Service for Worker (EPIC 12)
 * 
 * Captures failed jobs to dead letter queue
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { Job } from 'bullmq'
import { sql } from '@repo/database'

/**
 * Capture a failed job to DLQ
 */
export async function captureToDLQ(params: {
  queue_name: string
  job_id: string | null
  payload: Record<string, any> | null
  error_message: string
  stack_trace: string | null
  attempts: number
}): Promise<string> {
  const [entry] = await sql`
    INSERT INTO dead_letter_queue (
      queue_name,
      job_id,
      payload,
      error_message,
      stack_trace,
      attempts,
      failed_at
    ) VALUES (
      ${params.queue_name},
      ${params.job_id},
      ${JSON.stringify(params.payload)},
      ${params.error_message},
      ${params.stack_trace},
      ${params.attempts},
      NOW()
    )
    RETURNING id
  `

  return entry.id
}

/**
 * Setup DLQ capture handler for a worker
 */
export function setupDLQCapture(worker: any, queueName: string) {
  worker.on('failed', async (job: Job | undefined, error: Error) => {
    if (!job) {
      return
    }

    // Only capture to DLQ if job has exhausted all retries
    const maxAttempts = job.opts.attempts || 1
    if (job.attemptsMade >= maxAttempts) {
      try {
        await captureToDLQ({
          queue_name: queueName,
          job_id: job.id,
          payload: job.data as Record<string, any>,
          error_message: error.message,
          stack_trace: error.stack || null,
          attempts: job.attemptsMade,
        })
      } catch (dlqError) {
        // Log error but don't throw - we don't want DLQ capture to fail the job
        console.error(`Failed to capture job ${job.id} to DLQ:`, dlqError)
      }
    }
  })
}

