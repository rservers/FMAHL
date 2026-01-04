/**
 * Distribution Engine Core for EPIC 06
 *
 * Main orchestrator for lead distribution.
 * Coordinates rotation, traversal, eligibility, fairness, and billing.
 *
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */
import type { DistributionResult } from '../../types/distribution';
/**
 * Distribute a lead to eligible providers
 *
 * Main entry point for distribution. Orchestrates:
 * - Starting level rotation
 * - Level traversal
 * - Eligibility filtering (EPIC 05)
 * - Fairness selection
 * - Atomic assignment + billing
 * - Subscription status updates
 *
 * @param leadId - Lead ID to distribute
 * @param triggeredBy - Who triggered the distribution
 * @returns Distribution result with assignments and skip details
 */
export declare function distributeLead(leadId: string, triggeredBy: {
    actorId: string;
    actorRole: 'admin' | 'system';
}): Promise<DistributionResult>;
//# sourceMappingURL=engine.d.ts.map