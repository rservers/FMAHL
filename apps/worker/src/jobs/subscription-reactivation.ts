/**
 * Scheduled Job: Subscription Reactivation (EPIC 12)
 * 
 * Runs every 5 minutes to reactivate subscriptions for providers
 * whose balance has been restored.
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { Job } from 'bullmq'
import { logger } from '../lib/logger'

// Dynamic imports to avoid rootDir issues
async function getServices() {
  const { reactivateEligibleSubscriptions } = await import('../../../web/lib/services/subscription-status')
  const { logAudit, AuditActions } = await import('../../../web/lib/services/audit-logger')
  return { reactivateEligibleSubscriptions, logAudit, AuditActions }
}

export async function processSubscriptionReactivation(job: Job) {
  const startTime = Date.now()
  logger.info('subscription_reactivation_job_started', {
    job_id: job.id,
  })

  try {
    const { reactivateEligibleSubscriptions, logAudit, AuditActions } = await getServices()
    
    await reactivateEligibleSubscriptions()

    const duration = Date.now() - startTime
    logger.info('subscription_reactivation_job_completed', {
      job_id: job.id,
      duration_ms: duration,
    })

    // Log to audit log (system actor)
    await logAudit({
      action: AuditActions.SYSTEM_JOB_COMPLETED,
      actorId: '00000000-0000-0000-0000-000000000000', // System user
      actorRole: 'system',
      entity: 'scheduled_job',
      entityId: job.id,
      metadata: {
        job_type: 'subscription_reactivation',
        duration_ms: duration,
      },
    })

    return { success: true, duration_ms: duration }
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('subscription_reactivation_job_failed', error instanceof Error ? error : new Error(String(error)), {
      job_id: job.id,
      duration_ms: duration,
    })

    throw error
  }
}

