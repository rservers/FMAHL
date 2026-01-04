import { sql } from '../db'
import type { UserRole } from '../jwt'

/**
 * Audit Logging Service for EPIC 01 - Platform Foundation & Access Control
 * 
 * Records all privileged actions for security and compliance.
 * Logs are immutable - no updates or deletes allowed.
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

// System user ID for automated actions
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Audit action types
 */
export const AuditActions = {
  // Authentication
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_LOGOUT: 'user.logout',
  USER_EMAIL_VERIFIED: 'user.email_verified',
  USER_PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_MFA_ENABLED: 'user.mfa_enabled',
  USER_MFA_DISABLED: 'user.mfa_disabled',
  USER_MFA_CHALLENGE_PASSED: 'user.mfa_challenge_passed',
  USER_MFA_CHALLENGE_FAILED: 'user.mfa_challenge_failed',
  
  // Admin actions
  ADMIN_USER_STATUS_CHANGED: 'admin.user_status_changed',
  ADMIN_USER_ROLE_CHANGED: 'admin.user_role_changed',
  ADMIN_USER_CREATED: 'admin.user_created',
  
  // Provider actions
  PROVIDER_REGISTERED: 'provider.registered',
  PROVIDER_STATUS_CHANGED: 'provider.status_changed',
  
  // Lead actions (EPIC 02)
  LEAD_CREATED: 'lead.created',
  LEAD_CONFIRMED: 'lead.confirmed',
  LEAD_CONFIRMATION_RESENT: 'lead.confirmation_resent',
  LEAD_SUBMITTED: 'lead.submitted',
  LEAD_APPROVED: 'lead.approved',
  LEAD_REJECTED: 'lead.rejected',
  LEAD_ASSIGNED: 'lead.assigned',
  LEAD_REFUND_REQUESTED: 'lead.refund_requested',
  LEAD_REFUND_APPROVED: 'lead.refund_approved',
  LEAD_REFUND_REJECTED: 'lead.refund_rejected',
  
  // Billing actions
  BILLING_DEPOSIT: 'billing.deposit',
  BILLING_CHARGE: 'billing.charge',
  BILLING_REFUND: 'billing.refund',
  
  // Competition level actions (EPIC 04)
  COMPETITION_LEVEL_CREATED: 'competition_level.created',
  COMPETITION_LEVEL_UPDATED: 'competition_level.updated',
  COMPETITION_LEVEL_DEACTIVATED: 'competition_level.deactivated',
  COMPETITION_LEVEL_REACTIVATED: 'competition_level.reactivated',
  COMPETITION_LEVEL_REORDERED: 'competition_level.reordered',
  COMPETITION_LEVEL_DELETE_BLOCKED: 'competition_level.delete_blocked',
  
  // Subscription actions (EPIC 04)
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_DEACTIVATED: 'subscription.deactivated',
  SUBSCRIPTION_REACTIVATED: 'subscription.reactivated',
  SUBSCRIPTION_DELETED: 'subscription.deleted',
  
  // Filter actions (EPIC 05)
  FILTER_UPDATED: 'filter.updated',
  FILTER_INVALIDATED: 'filter.invalidated',
  FILTER_MEMO_UPDATED: 'filter.memo_updated',
  
  // Billing actions (EPIC 07)
  DEPOSIT_INITIATED: 'deposit.initiated',
  DEPOSIT_COMPLETED: 'deposit.completed',
  DEPOSIT_FAILED: 'deposit.failed',
  LEAD_CHARGED: 'lead.charged',
  REFUND_PROCESSED: 'refund.processed',
  BALANCE_ADJUSTED: 'balance.adjusted',
  LOW_BALANCE_ALERT_SENT: 'low_balance.alert_sent',
  
  // Distribution actions (EPIC 06)
  DISTRIBUTION_STARTED: 'distribution.started',
  DISTRIBUTION_COMPLETED: 'distribution.completed',
  DISTRIBUTION_FAILED: 'distribution.failed',
  DISTRIBUTION_SKIPPED_PROVIDER: 'distribution.skipped_provider',
  ASSIGNMENT_CREATED: 'assignment.created',
  
  // Provider lead management actions (EPIC 08)
  LEAD_VIEWED: 'lead.viewed',
  LEAD_ACCEPTED: 'lead.accepted',
  LEAD_REJECTED_BY_PROVIDER: 'lead.rejected_by_provider',
  LEAD_EXPORT_REQUESTED: 'lead.export_requested',
  LEAD_EXPORT_COMPLETED: 'lead.export_completed',
} as const

export type AuditAction = typeof AuditActions[keyof typeof AuditActions]

/**
 * Audit log entry input
 */
export interface AuditLogEntry {
  actorId: string | null      // User performing the action (null for anonymous)
  actorRole: UserRole | null  // Role of the actor
  action: AuditAction | string // Action being performed
  entity?: string             // Entity type (e.g., 'user', 'lead', 'provider')
  entityId?: string           // Entity ID
  metadata?: Record<string, any> // Additional context
  adminOnlyMemo?: string      // Admin-only notes (not visible to non-admins)
  ipAddress?: string          // Request IP address
}

/**
 * Log an audit entry
 * 
 * @param entry - The audit log entry
 * @returns The created audit log ID
 */
export async function logAudit(entry: AuditLogEntry): Promise<string> {
  const [result] = await sql`
    INSERT INTO audit_log (
      actor_id,
      actor_role,
      action,
      entity,
      entity_id,
      metadata,
      admin_only_memo,
      ip_address
    ) VALUES (
      ${entry.actorId},
      ${entry.actorRole},
      ${entry.action},
      ${entry.entity || null},
      ${entry.entityId || null},
      ${entry.metadata ? JSON.stringify(entry.metadata) : null},
      ${entry.adminOnlyMemo || null},
      ${entry.ipAddress || null}
    )
    RETURNING id
  `
  
  return result.id
}

/**
 * Convenience alias for logAudit
 */
export const logAction = logAudit

/**
 * Log a system action (performed by background jobs, etc.)
 */
export async function logSystemAction(
  action: AuditAction | string,
  entity?: string,
  entityId?: string,
  metadata?: Record<string, any>
): Promise<string> {
  return logAudit({
    actorId: SYSTEM_USER_ID,
    actorRole: 'system',
    action,
    entity,
    entityId,
    metadata,
  })
}

/**
 * Log a user authentication event
 */
export async function logAuthEvent(
  action: AuditAction,
  userId: string,
  role: UserRole,
  ipAddress?: string,
  metadata?: Record<string, any>
): Promise<string> {
  return logAudit({
    actorId: userId,
    actorRole: role,
    action,
    entity: 'user',
    entityId: userId,
    ipAddress,
    metadata,
  })
}

/**
 * Log an admin action
 */
export async function logAdminAction(
  action: AuditAction,
  adminId: string,
  entity: string,
  entityId: string,
  metadata?: Record<string, any>,
  adminOnlyMemo?: string,
  ipAddress?: string
): Promise<string> {
  return logAudit({
    actorId: adminId,
    actorRole: 'admin',
    action,
    entity,
    entityId,
    metadata,
    adminOnlyMemo,
    ipAddress,
  })
}

/**
 * Query audit logs with filters
 */
export interface AuditLogQuery {
  actorId?: string
  action?: string
  entity?: string
  entityId?: string
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}

export interface AuditLogResult {
  id: string
  actor_id: string | null
  actor_role: string | null
  action: string
  entity: string | null
  entity_id: string | null
  metadata: Record<string, any> | null
  admin_only_memo: string | null
  ip_address: string | null
  created_at: Date
}

export interface PaginatedAuditLogs {
  logs: AuditLogResult[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export async function queryAuditLogs(query: AuditLogQuery): Promise<PaginatedAuditLogs> {
  const page = query.page || 1
  const limit = Math.min(query.limit || 50, 100) // Max 100 per page
  const offset = (page - 1) * limit
  
  // Build dynamic query conditions
  const conditions: string[] = []
  const values: any[] = []
  let paramIndex = 1
  
  if (query.actorId) {
    conditions.push(`actor_id = $${paramIndex++}`)
    values.push(query.actorId)
  }
  
  if (query.action) {
    conditions.push(`action = $${paramIndex++}`)
    values.push(query.action)
  }
  
  if (query.entity) {
    conditions.push(`entity = $${paramIndex++}`)
    values.push(query.entity)
  }
  
  if (query.entityId) {
    conditions.push(`entity_id = $${paramIndex++}`)
    values.push(query.entityId)
  }
  
  if (query.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`)
    values.push(query.startDate)
  }
  
  if (query.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`)
    values.push(query.endDate)
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  
  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM audit_log ${whereClause}`
  const [countResult] = await sql.unsafe(countQuery, values)
  const total = parseInt(countResult.total, 10)
  
  // Get paginated results
  const logsQuery = `
    SELECT 
      id,
      actor_id,
      actor_role,
      action,
      entity,
      entity_id,
      metadata,
      admin_only_memo,
      ip_address,
      created_at
    FROM audit_log
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `
  values.push(limit, offset)
  
  const logs = await sql.unsafe(logsQuery, values)
  
  return {
    logs: logs as unknown as AuditLogResult[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

