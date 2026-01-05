/**
 * Dead Letter Queue Service for EPIC 12
 * 
 * Manages DLQ entries: create, read, retry, resolve
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { sql } from '../db'
import { getQueue } from '../queue'
import type { DLQEntry, DLQListResponse, DLQDetailResponse } from '../types/observability'

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
 * List DLQ entries with pagination
 */
export async function listDLQEntries(params: {
  queue?: string
  page?: number
  limit?: number
}): Promise<DLQListResponse> {
  const page = params.page || 1
  const limit = params.limit || 50
  const offset = (page - 1) * limit

  let query = sql`
    SELECT 
      id,
      queue_name,
      job_id,
      payload,
      error_message,
      stack_trace,
      attempts,
      failed_at,
      resolved,
      resolved_at,
      resolved_by
    FROM dead_letter_queue
    WHERE resolved = false
  `

  if (params.queue) {
    query = sql`${query} AND queue_name = ${params.queue}`
  }

  query = sql`${query} ORDER BY failed_at DESC LIMIT ${limit} OFFSET ${offset}`

  const entries = await query

  // Get total count
  let countQuery = sql`SELECT COUNT(*) as total FROM dead_letter_queue WHERE resolved = false`
  if (params.queue) {
    countQuery = sql`${countQuery} AND queue_name = ${params.queue}`
  }
  const [countResult] = await countQuery
  const total = Number(countResult.total) || 0

  return {
    entries: entries.map((e: any) => ({
      id: e.id,
      queue_name: e.queue_name,
      job_id: e.job_id,
      payload: e.payload,
      error_message: e.error_message,
      stack_trace: e.stack_trace,
      attempts: e.attempts,
      failed_at: e.failed_at.toISOString(),
      resolved: e.resolved,
      resolved_at: e.resolved_at ? e.resolved_at.toISOString() : null,
      resolved_by: e.resolved_by,
    })),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  }
}

/**
 * Get DLQ entry by ID
 */
export async function getDLQEntry(id: string): Promise<DLQDetailResponse | null> {
  const [entry] = await sql`
    SELECT 
      id,
      queue_name,
      job_id,
      payload,
      error_message,
      stack_trace,
      attempts,
      failed_at,
      resolved,
      resolved_at,
      resolved_by
    FROM dead_letter_queue
    WHERE id = ${id}
  `

  if (!entry) {
    return null
  }

  return {
    id: entry.id,
    queue_name: entry.queue_name,
    job_id: entry.job_id,
    payload: entry.payload,
    error_message: entry.error_message,
    stack_trace: entry.stack_trace,
    attempts: entry.attempts,
    failed_at: entry.failed_at.toISOString(),
    resolved: entry.resolved,
    resolved_at: entry.resolved_at ? entry.resolved_at.toISOString() : null,
    resolved_by: entry.resolved_by,
  }
}

/**
 * Retry a failed job from DLQ
 */
export async function retryDLQJob(id: string): Promise<{ job_id: string }> {
  const entry = await getDLQEntry(id)
  
  if (!entry) {
    throw new Error('DLQ entry not found')
  }

  if (entry.resolved) {
    throw new Error('DLQ entry already resolved')
  }

  // Re-enqueue job to original queue
  const queue = getQueue(entry.queue_name)
  const newJob = await queue.add('retry', entry.payload || {}, {
    attempts: 1, // Fresh attempt
  })

  // Mark as resolved
  await sql`
    UPDATE dead_letter_queue
    SET resolved = true, resolved_at = NOW()
    WHERE id = ${id}
  `

  return { job_id: newJob.id }
}

/**
 * Mark DLQ entry as resolved
 */
export async function resolveDLQEntry(id: string, userId: string): Promise<void> {
  await sql`
    UPDATE dead_letter_queue
    SET resolved = true, resolved_at = NOW(), resolved_by = ${userId}
    WHERE id = ${id}
  `
}

