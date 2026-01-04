/**
 * Atomic Assignment + Billing Service for EPIC 06
 *
 * Creates lead assignments atomically with billing charges.
 * Integrates with EPIC 07 billing service.
 *
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */
export interface AssignmentResult {
    assignmentId: string;
    newBalance: number;
}
/**
 * Create assignment and charge provider atomically
 *
 * Uses chargeForLeadAssignment() from EPIC 07 within transaction.
 * Updates last_received_at for fairness.
 * Throws InsufficientBalanceError if balance too low.
 *
 * @param leadId - Lead ID
 * @param providerId - Provider ID
 * @param subscriptionId - Subscription ID
 * @param competitionLevelId - Competition level ID
 * @param priceCents - Price in cents
 * @returns Assignment ID and new balance
 */
export declare function createAssignmentWithCharge(leadId: string, providerId: string, subscriptionId: string, competitionLevelId: string, priceCents: number): Promise<AssignmentResult>;
/**
 * Retry wrapper for transient database failures
 *
 * Retries up to maxRetries times with exponential backoff + jitter.
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Result of function execution
 */
export declare function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries?: number): Promise<T>;
//# sourceMappingURL=assignment.d.ts.map