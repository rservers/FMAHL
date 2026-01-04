/**
 * Distribution Job Processor for EPIC 06
 * 
 * BullMQ processor for async lead distribution.
 * 
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */

import { Worker, Processor, Job } from 'bullmq'
import { ConnectionOptions } from 'bullmq'
import { config } from 'dotenv'
import { resolve } from 'path'
// Note: These imports will be resolved at runtime via tsconfig paths
// For now, we'll use dynamic imports or create a separate entry point

// Load environment variables
config({ path: resolve(__dirname, '../../../.env.local') })

export interface DistributionJobData {
  leadId: string
  triggeredBy: {
    actorId: string
    actorRole: 'admin' | 'system'
  }
  requestedAt: string
}

/**
 * Process distribution job
 * 
 * Note: This uses dynamic imports to avoid TypeScript rootDir issues
 * The actual implementation is in apps/web/lib/services/distribution/engine.ts
 */
const distributionProcessor: Processor<DistributionJobData> = async (job: Job<DistributionJobData>) => {
  const { leadId, triggeredBy } = job.data

  console.log(`[Distribution] Processing lead ${leadId} (job ${job.id})`)

  try {
    // Dynamic import to avoid TypeScript rootDir issues
    const { distributeLead } = await import('../../../web/lib/services/distribution/engine')
    const { logAction, AuditActions } = await import('../../../web/lib/services/audit-logger')

    // Log distribution start
    await logAction({
      actorId: triggeredBy.actorId,
      actorRole: triggeredBy.actorRole,
      action: AuditActions.DISTRIBUTION_STARTED,
      entity: 'lead',
      entityId: leadId,
      metadata: {
        job_id: job.id,
        requested_at: job.data.requestedAt,
      },
    })

    // Execute distribution
    const result = await distributeLead(leadId, triggeredBy)

    // Log distribution completion
    await logAction({
      actorId: triggeredBy.actorId,
      actorRole: triggeredBy.actorRole,
      action: AuditActions.DISTRIBUTION_COMPLETED,
      entity: 'lead',
      entityId: leadId,
      metadata: {
        job_id: job.id,
        status: result.status,
        assignments_created: result.assignmentsCreated,
        skipped_count: result.skippedProviders.length,
        duration_ms: result.durationMs,
        start_level_order_position: result.startLevelOrderPosition,
      },
    })

    console.log(
      `[Distribution] Completed lead ${leadId}: ${result.assignmentsCreated} assignments, status: ${result.status}`
    )

    return result
  } catch (error) {
    console.error(`[Distribution] Failed to distribute lead ${leadId}:`, error)

    // Log distribution failure (with dynamic import)
    try {
      const { logAction, AuditActions } = await import('../../../web/lib/services/audit-logger')
      await logAction({
        actorId: triggeredBy.actorId,
        actorRole: triggeredBy.actorRole,
        action: AuditActions.DISTRIBUTION_FAILED,
        entity: 'lead',
        entityId: leadId,
        metadata: {
          job_id: job.id,
          error: error instanceof Error ? error.message : String(error),
        },
      })
    } catch (logError) {
      console.error('Failed to log distribution failure:', logError)
    }

    throw error // Re-throw to trigger retry
  }
}

/**
 * Create distribution worker
 */
export function createDistributionWorker(connection: ConnectionOptions): Worker<DistributionJobData> {
  return new Worker<DistributionJobData>('distribute_lead', distributionProcessor, {
    connection,
    concurrency: 5, // Process up to 5 distributions concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second
    },
  })
}

