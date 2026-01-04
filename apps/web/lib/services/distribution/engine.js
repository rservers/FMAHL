/**
 * Distribution Engine Core for EPIC 06
 *
 * Main orchestrator for lead distribution.
 * Coordinates rotation, traversal, eligibility, fairness, and billing.
 *
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */
import { sql } from '../../db';
import { getAndAdvanceStartLevel } from './rotation';
import { getTraversalOrder } from './traversal';
import { selectProvidersForLevel } from './fairness';
import { createAssignmentWithCharge, retryWithBackoff } from './assignment';
import { getEligibleSubscriptionsByLevel } from '../eligibility';
import { checkAndUpdateSubscriptionStatus } from '../subscription-status';
import { InsufficientBalanceError } from '../../errors/billing';
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
export async function distributeLead(leadId, triggeredBy) {
    const startTime = Date.now();
    try {
        // 1. Verify lead exists and is approved
        const [lead] = await sql `
      SELECT 
        id,
        niche_id,
        status
      FROM leads
      WHERE id = ${leadId}
        AND deleted_at IS NULL
    `;
        if (!lead) {
            throw new Error(`Lead not found: ${leadId}`);
        }
        if (lead.status !== 'approved') {
            throw new Error(`Lead ${leadId} is not approved (status: ${lead.status})`);
        }
        // 2. Get and advance starting level (atomic rotation)
        const { startOrderPosition, competitionLevelIds: traversalLevelIds } = await getAndAdvanceStartLevel(lead.niche_id);
        // 3. Get traversal order with level details
        const traversalOrder = await getTraversalOrder(lead.niche_id, startOrderPosition);
        if (traversalOrder.length === 0) {
            // No active competition levels
            const durationMs = Date.now() - startTime;
            return {
                leadId,
                startLevelOrderPosition: startOrderPosition,
                traversalOrder: [],
                assignmentsCreated: 0,
                assignmentDetails: [],
                skippedProviders: [],
                durationMs,
                status: 'no_eligible',
                error: 'No active competition levels found for niche',
            };
        }
        // 4. Get eligible subscriptions by level (EPIC 05)
        let eligibleByLevel;
        try {
            const eligibleResult = await getEligibleSubscriptionsByLevel(leadId);
            eligibleByLevel = eligibleResult;
        }
        catch (error) {
            // Fail-safe: treat as no eligible
            console.error('Eligibility evaluation failed:', error);
            const durationMs = Date.now() - startTime;
            return {
                leadId,
                startLevelOrderPosition: startOrderPosition,
                traversalOrder: traversalOrder.map(l => l.levelId),
                assignmentsCreated: 0,
                assignmentDetails: [],
                skippedProviders: [],
                durationMs,
                status: 'no_eligible',
                error: `Eligibility evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
        // Check if any eligible subscriptions exist
        const totalEligible = Object.values(eligibleByLevel).reduce((sum, subs) => sum + subs.length, 0);
        if (totalEligible === 0) {
            const durationMs = Date.now() - startTime;
            return {
                leadId,
                startLevelOrderPosition: startOrderPosition,
                traversalOrder: traversalOrder.map(l => l.levelId),
                assignmentsCreated: 0,
                assignmentDetails: [],
                skippedProviders: [],
                durationMs,
                status: 'no_eligible',
            };
        }
        // 5. Traverse levels and create assignments
        const assignmentDetails = [];
        const skippedProviders = [];
        const assignedProviderIds = new Set(); // Cross-level dedupe
        for (const levelInfo of traversalOrder) {
            const eligibleSubs = eligibleByLevel[levelInfo.levelId] || [];
            if (eligibleSubs.length === 0) {
                continue; // No eligible subscriptions for this level
            }
            // Select providers using fairness (LRU)
            const selectedProviders = await selectProvidersForLevel(levelInfo.levelId, levelInfo.maxRecipients, Array.from(assignedProviderIds), eligibleSubs.map(s => s.subscription_id));
            // Attempt assignment for each selected provider
            for (const selected of selectedProviders) {
                // Skip if already assigned (shouldn't happen with proper dedupe, but be safe)
                if (assignedProviderIds.has(selected.providerId)) {
                    skippedProviders.push({
                        providerId: selected.providerId,
                        subscriptionId: selected.subscriptionId,
                        reason: 'duplicate',
                    });
                    continue;
                }
                try {
                    // Create assignment with atomic charge (with retry)
                    const result = await retryWithBackoff(() => createAssignmentWithCharge(leadId, selected.providerId, selected.subscriptionId, levelInfo.levelId, levelInfo.pricePerLeadCents));
                    assignmentDetails.push({
                        assignmentId: result.assignmentId,
                        providerId: selected.providerId,
                        subscriptionId: selected.subscriptionId,
                        competitionLevelId: levelInfo.levelId,
                        priceCharged: levelInfo.pricePerLeadCents / 100,
                    });
                    assignedProviderIds.add(selected.providerId);
                    // Update subscription status after charge (may deactivate if balance low)
                    try {
                        await checkAndUpdateSubscriptionStatus(selected.providerId);
                    }
                    catch (statusError) {
                        console.error('Failed to update subscription status:', statusError);
                        // Don't fail distribution if status update fails
                    }
                }
                catch (error) {
                    if (error instanceof InsufficientBalanceError) {
                        skippedProviders.push({
                            providerId: selected.providerId,
                            subscriptionId: selected.subscriptionId,
                            reason: 'insufficient_balance',
                            details: error.message,
                        });
                        // Update subscription status (may deactivate)
                        try {
                            await checkAndUpdateSubscriptionStatus(selected.providerId);
                        }
                        catch (statusError) {
                            console.error('Failed to update subscription status:', statusError);
                        }
                    }
                    else if (error instanceof Error && error.message.includes('Duplicate assignment')) {
                        skippedProviders.push({
                            providerId: selected.providerId,
                            subscriptionId: selected.subscriptionId,
                            reason: 'duplicate',
                            details: error.message,
                        });
                    }
                    else {
                        // Other errors (eligibility, etc.)
                        skippedProviders.push({
                            providerId: selected.providerId,
                            subscriptionId: selected.subscriptionId,
                            reason: 'eligibility_error',
                            details: error instanceof Error ? error.message : String(error),
                        });
                    }
                }
            }
        }
        // 6. Update lead with distribution outcome
        const assignmentsCreated = assignmentDetails.length;
        const durationMs = Date.now() - startTime;
        if (assignmentsCreated > 0) {
            await sql `
        UPDATE leads
        SET 
          distributed_at = NOW(),
          distribution_attempts = distribution_attempts + 1
        WHERE id = ${leadId}
      `;
        }
        else {
            await sql `
        UPDATE leads
        SET distribution_attempts = distribution_attempts + 1
        WHERE id = ${leadId}
      `;
        }
        // 7. Determine status
        let status;
        if (assignmentsCreated === 0) {
            status = totalEligible === 0 ? 'no_eligible' : 'partial';
        }
        else if (assignmentsCreated === totalEligible) {
            status = 'success';
        }
        else {
            status = 'partial';
        }
        return {
            leadId,
            startLevelOrderPosition: startOrderPosition,
            traversalOrder: traversalOrder.map(l => l.levelId),
            assignmentsCreated,
            assignmentDetails,
            skippedProviders,
            durationMs,
            status,
        };
    }
    catch (error) {
        const durationMs = Date.now() - startTime;
        // Update attempt count even on failure
        try {
            await sql `
        UPDATE leads
        SET distribution_attempts = distribution_attempts + 1
        WHERE id = ${leadId}
      `;
        }
        catch (updateError) {
            console.error('Failed to update distribution_attempts:', updateError);
        }
        return {
            leadId,
            startLevelOrderPosition: 0,
            traversalOrder: [],
            assignmentsCreated: 0,
            assignmentDetails: [],
            skippedProviders: [],
            durationMs,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
//# sourceMappingURL=engine.js.map