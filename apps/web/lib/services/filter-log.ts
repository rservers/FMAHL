/**
 * Filter Log Service for EPIC 05
 * 
 * Manages filter change logs and admin memos.
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import { sql } from '../db'
import { logAction, AuditActions } from './audit-logger'
import type { FilterRules } from '../types/filter'

/**
 * Log a filter change
 */
export async function logFilterChange(
  subscriptionId: string,
  actorId: string,
  actorRole: 'admin' | 'provider' | 'system',
  oldRules: FilterRules | null,
  newRules: FilterRules | null
): Promise<string> {
  const [logEntry] = await sql`
    INSERT INTO subscription_filter_logs (
      subscription_id,
      actor_id,
      actor_role,
      old_filter_rules,
      new_filter_rules
    ) VALUES (
      ${subscriptionId},
      ${actorId},
      ${actorRole},
      ${oldRules ? JSON.stringify(oldRules) : null},
      ${newRules ? JSON.stringify(newRules) : null}
    )
    RETURNING id
  `

  // Also log to audit_log
  await logAction({
    actorId,
    actorRole,
    action: AuditActions.FILTER_UPDATED,
    entity: 'subscription',
    entityId: subscriptionId,
    metadata: {
      subscription_id: subscriptionId,
      old_rules_count: oldRules?.rules?.length || 0,
      new_rules_count: newRules?.rules?.length || 0,
    },
  })

  return logEntry.id
}

/**
 * Update admin memo on a filter log entry
 */
export async function updateFilterMemo(
  logId: string,
  adminId: string,
  memo: string
): Promise<void> {
  // Get old memo for audit
  const [oldLog] = await sql`
    SELECT admin_only_memo FROM subscription_filter_logs WHERE id = ${logId}
  `

  await sql`
    UPDATE subscription_filter_logs
    SET
      admin_only_memo = ${memo},
      memo_updated_at = NOW(),
      memo_updated_by = ${adminId}
    WHERE id = ${logId}
  `

  // Log memo update to audit_log
  await logAction({
    actorId: adminId,
    actorRole: 'admin',
    action: AuditActions.FILTER_MEMO_UPDATED,
    entity: 'filter_log',
    entityId: logId,
    metadata: {
      log_id: logId,
      old_memo: oldLog?.admin_only_memo || null,
      new_memo: memo,
    },
  })
}

