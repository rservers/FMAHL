/**
 * Scheduled Job: Balance Reconciliation (EPIC 12)
 * 
 * Runs nightly at 3 AM to verify provider balances match ledger totals.
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { Job } from 'bullmq'
import { sql } from '@repo/database'
import { logger } from '../lib/logger'

// Dynamic imports to avoid rootDir issues
async function getServices() {
  const { calculateBalance } = await import('../../../web/lib/services/ledger')
  const { logAudit, AuditActions } = await import('../../../web/lib/services/audit-logger')
  return { calculateBalance, logAudit, AuditActions }
}

const TOLERANCE = 0.01 // 1 cent tolerance for floating point comparison
const ALERT_THRESHOLD = 1.00 // Alert if discrepancy > $1.00

export async function processBalanceReconciliation(job: Job) {
  const startTime = Date.now()
  logger.info('balance_reconciliation_job_started', {
    job_id: job.id,
  })

  try {
    // Get all providers
    const providers = await sql`
      SELECT id, balance FROM providers WHERE deleted_at IS NULL
    `

    let discrepanciesFound = 0
    let autoCorrected = 0
    let alertsNeeded = 0

    const { calculateBalance, logAudit, AuditActions } = await getServices()

    for (const provider of providers) {
      const cachedBalance = parseFloat(provider.balance.toString())
      const calculatedBalance = await calculateBalance(provider.id)
      const discrepancy = Math.abs(cachedBalance - calculatedBalance)

      if (discrepancy > TOLERANCE) {
        discrepanciesFound++

        logger.warn('balance_discrepancy_found', {
          provider_id: provider.id,
          cached_balance: cachedBalance,
          calculated_balance: calculatedBalance,
          discrepancy: discrepancy,
        })

        // Auto-correct if within tolerance
        if (discrepancy <= TOLERANCE) {
          await sql`
            UPDATE providers
            SET balance = ${calculatedBalance}
            WHERE id = ${provider.id}
          `
          autoCorrected++
        }

        // Alert if discrepancy is large
        if (discrepancy > ALERT_THRESHOLD) {
          alertsNeeded++
          logger.error('balance_discrepancy_alert', new Error(`Large balance discrepancy: $${discrepancy}`), {
            provider_id: provider.id,
            cached_balance: cachedBalance,
            calculated_balance: calculatedBalance,
            discrepancy: discrepancy,
          })
        }
      }
    }

    const duration = Date.now() - startTime
    logger.info('balance_reconciliation_job_completed', {
      job_id: job.id,
      duration_ms: duration,
      providers_checked: providers.length,
      discrepancies_found: discrepanciesFound,
      auto_corrected: autoCorrected,
      alerts_needed: alertsNeeded,
    })

    // Log to audit log
    await logAudit({
      action: AuditActions.SYSTEM_JOB_COMPLETED,
      actorId: '00000000-0000-0000-0000-000000000000', // System user
      actorRole: 'system',
      entity: 'scheduled_job',
      entityId: job.id,
      metadata: {
        job_type: 'balance_reconciliation',
        duration_ms: duration,
        providers_checked: providers.length,
        discrepancies_found: discrepanciesFound,
        auto_corrected: autoCorrected,
        alerts_needed: alertsNeeded,
      },
    })

    return {
      success: true,
      duration_ms: duration,
      providers_checked: providers.length,
      discrepancies_found: discrepanciesFound,
      auto_corrected: autoCorrected,
      alerts_needed: alertsNeeded,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('balance_reconciliation_job_failed', error instanceof Error ? error : new Error(String(error)), {
      job_id: job.id,
      duration_ms: duration,
    })

    throw error
  }
}

