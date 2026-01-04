/**
 * Distribution Types for EPIC 06 - Distribution Engine
 *
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */
export interface DistributionJob {
    leadId: string;
    triggeredBy: {
        actorId: string;
        actorRole: 'admin' | 'system';
    };
    requestedAt: string;
}
export interface AssignmentDetail {
    assignmentId: string;
    providerId: string;
    subscriptionId: string;
    competitionLevelId: string;
    priceCharged: number;
}
export interface SkippedProvider {
    providerId: string;
    subscriptionId: string;
    reason: 'insufficient_balance' | 'eligibility_error' | 'duplicate' | 'subscription_inactive';
    details?: string;
}
export type DistributionStatus = 'success' | 'partial' | 'no_eligible' | 'failed';
export interface DistributionResult {
    leadId: string;
    startLevelOrderPosition: number;
    traversalOrder: string[];
    assignmentsCreated: number;
    assignmentDetails: AssignmentDetail[];
    skippedProviders: SkippedProvider[];
    durationMs: number;
    status: DistributionStatus;
    error?: string;
}
export interface DistributionStatusResponse {
    leadId: string;
    leadStatus: string;
    lastAttemptAt: string | null;
    lastAttemptStatus: 'success' | 'failed' | 'queued' | 'processing' | 'none';
    assignmentsCreated: number;
    startLevelOrderPosition: number | null;
    notes?: string;
}
export interface AssignmentListItem {
    assignmentId: string;
    providerId: string;
    providerName: string;
    subscriptionId: string;
    competitionLevelId: string;
    levelName: string;
    priceCharged: number;
    assignedAt: string;
    status: 'active' | 'refunded';
}
export interface AssignmentsListResponse {
    leadId: string;
    page: number;
    limit: number;
    total: number;
    items: AssignmentListItem[];
}
//# sourceMappingURL=distribution.d.ts.map