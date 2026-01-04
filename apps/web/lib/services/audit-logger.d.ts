import type { UserRole } from '../jwt';
/**
 * Audit Logging Service for EPIC 01 - Platform Foundation & Access Control
 *
 * Records all privileged actions for security and compliance.
 * Logs are immutable - no updates or deletes allowed.
 *
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export declare const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
/**
 * Audit action types
 */
export declare const AuditActions: {
    readonly USER_REGISTERED: "user.registered";
    readonly USER_LOGIN: "user.login";
    readonly USER_LOGIN_FAILED: "user.login_failed";
    readonly USER_LOGOUT: "user.logout";
    readonly USER_EMAIL_VERIFIED: "user.email_verified";
    readonly USER_PASSWORD_RESET_REQUESTED: "user.password_reset_requested";
    readonly USER_PASSWORD_RESET: "user.password_reset";
    readonly USER_MFA_ENABLED: "user.mfa_enabled";
    readonly USER_MFA_DISABLED: "user.mfa_disabled";
    readonly USER_MFA_CHALLENGE_PASSED: "user.mfa_challenge_passed";
    readonly USER_MFA_CHALLENGE_FAILED: "user.mfa_challenge_failed";
    readonly ADMIN_USER_STATUS_CHANGED: "admin.user_status_changed";
    readonly ADMIN_USER_ROLE_CHANGED: "admin.user_role_changed";
    readonly ADMIN_USER_CREATED: "admin.user_created";
    readonly PROVIDER_REGISTERED: "provider.registered";
    readonly PROVIDER_STATUS_CHANGED: "provider.status_changed";
    readonly LEAD_CREATED: "lead.created";
    readonly LEAD_CONFIRMED: "lead.confirmed";
    readonly LEAD_CONFIRMATION_RESENT: "lead.confirmation_resent";
    readonly LEAD_SUBMITTED: "lead.submitted";
    readonly LEAD_APPROVED: "lead.approved";
    readonly LEAD_REJECTED: "lead.rejected";
    readonly LEAD_ASSIGNED: "lead.assigned";
    readonly LEAD_REFUND_REQUESTED: "lead.refund_requested";
    readonly LEAD_REFUND_APPROVED: "lead.refund_approved";
    readonly LEAD_REFUND_REJECTED: "lead.refund_rejected";
    readonly BILLING_DEPOSIT: "billing.deposit";
    readonly BILLING_CHARGE: "billing.charge";
    readonly BILLING_REFUND: "billing.refund";
    readonly COMPETITION_LEVEL_CREATED: "competition_level.created";
    readonly COMPETITION_LEVEL_UPDATED: "competition_level.updated";
    readonly COMPETITION_LEVEL_DEACTIVATED: "competition_level.deactivated";
    readonly COMPETITION_LEVEL_REACTIVATED: "competition_level.reactivated";
    readonly COMPETITION_LEVEL_REORDERED: "competition_level.reordered";
    readonly COMPETITION_LEVEL_DELETE_BLOCKED: "competition_level.delete_blocked";
    readonly SUBSCRIPTION_CREATED: "subscription.created";
    readonly SUBSCRIPTION_DEACTIVATED: "subscription.deactivated";
    readonly SUBSCRIPTION_REACTIVATED: "subscription.reactivated";
    readonly SUBSCRIPTION_DELETED: "subscription.deleted";
    readonly FILTER_UPDATED: "filter.updated";
    readonly FILTER_INVALIDATED: "filter.invalidated";
    readonly FILTER_MEMO_UPDATED: "filter.memo_updated";
    readonly DEPOSIT_INITIATED: "deposit.initiated";
    readonly DEPOSIT_COMPLETED: "deposit.completed";
    readonly DEPOSIT_FAILED: "deposit.failed";
    readonly LEAD_CHARGED: "lead.charged";
    readonly REFUND_PROCESSED: "refund.processed";
    readonly BALANCE_ADJUSTED: "balance.adjusted";
    readonly LOW_BALANCE_ALERT_SENT: "low_balance.alert_sent";
    readonly DISTRIBUTION_STARTED: "distribution.started";
    readonly DISTRIBUTION_COMPLETED: "distribution.completed";
    readonly DISTRIBUTION_FAILED: "distribution.failed";
    readonly DISTRIBUTION_SKIPPED_PROVIDER: "distribution.skipped_provider";
    readonly ASSIGNMENT_CREATED: "assignment.created";
};
export type AuditAction = typeof AuditActions[keyof typeof AuditActions];
/**
 * Audit log entry input
 */
export interface AuditLogEntry {
    actorId: string | null;
    actorRole: UserRole | null;
    action: AuditAction | string;
    entity?: string;
    entityId?: string;
    metadata?: Record<string, any>;
    adminOnlyMemo?: string;
    ipAddress?: string;
}
/**
 * Log an audit entry
 *
 * @param entry - The audit log entry
 * @returns The created audit log ID
 */
export declare function logAudit(entry: AuditLogEntry): Promise<string>;
/**
 * Convenience alias for logAudit
 */
export declare const logAction: typeof logAudit;
/**
 * Log a system action (performed by background jobs, etc.)
 */
export declare function logSystemAction(action: AuditAction | string, entity?: string, entityId?: string, metadata?: Record<string, any>): Promise<string>;
/**
 * Log a user authentication event
 */
export declare function logAuthEvent(action: AuditAction, userId: string, role: UserRole, ipAddress?: string, metadata?: Record<string, any>): Promise<string>;
/**
 * Log an admin action
 */
export declare function logAdminAction(action: AuditAction, adminId: string, entity: string, entityId: string, metadata?: Record<string, any>, adminOnlyMemo?: string, ipAddress?: string): Promise<string>;
/**
 * Query audit logs with filters
 */
export interface AuditLogQuery {
    actorId?: string;
    action?: string;
    entity?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}
export interface AuditLogResult {
    id: string;
    actor_id: string | null;
    actor_role: string | null;
    action: string;
    entity: string | null;
    entity_id: string | null;
    metadata: Record<string, any> | null;
    admin_only_memo: string | null;
    ip_address: string | null;
    created_at: Date;
}
export interface PaginatedAuditLogs {
    logs: AuditLogResult[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export declare function queryAuditLogs(query: AuditLogQuery): Promise<PaginatedAuditLogs>;
//# sourceMappingURL=audit-logger.d.ts.map