/**
 * Scheduled Job: DLQ Cleanup (EPIC 12)
 * 
 * Runs weekly to remove old resolved DLQ entries (30-day retention).
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { Job } from 'bullmq'
import { sql } from '@repo/database'
import { logger } from '../lib/logger'

// Dynamic imports to avoid rootDir issues
async function getServices() {
  const { logAudit, AuditActions } = await import('../../../web/lib/services/audit-logger')
  return { logAudit, AuditActions }
}

const RETENTION_DAYS = 30

export async function processDLQCleanup(job: Job) {
  const startTime = Date.now()
  logger.info('dlq_cleanup_job_started', {
    job_id: job.id,
  })

  try {
    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

    // Delete old resolved entries
    const result = await sql`
      DELETE FROM dead_letter_queue
      WHERE resolved = true
        AND resolved_at < ${cutoffDate.toISOString()}
    `

    const deletedCount = result.count || 0

    const duration = Date.now() - startTime
    logger.info('dlq_cleanup_job_completed', {
      job_id: job.id,
      duration_ms: duration,
      entries_deleted: deletedCount,
      cutoff_date: cutoffDate.toISOString(),
    })

    // Log to audit log
    const { logAudit, AuditActions } = await getServices()
    await logAudit({
      action: AuditActions.SYSTEM_JOB_COMPLETED,
      actorId: '00000000-0000-0000-0000-000000000000', // System user
      actorRole: 'system',
      entity: 'scheduled_job',
      entityId: job.id,
      metadata: {
        job_type: 'dlq_cleanup',
        duration_ms: duration,
        entries_deleted: deletedCount,
      },
    })

    return {
      success: true,
      duration_ms: duration,
      entries_deleted: deletedCount,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('dlq_cleanup_job_failed', error instanceof Error ? error : new Error(String(error)), {
      job_id: job.id,
      duration_ms: duration,
    })

    throw error
  }
}

