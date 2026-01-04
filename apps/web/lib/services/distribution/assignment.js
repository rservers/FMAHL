/**
 * Atomic Assignment + Billing Service for EPIC 06
 *
 * Creates lead assignments atomically with billing charges.
 * Integrates with EPIC 07 billing service.
 *
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */
import { sql } from '../../db';
import { chargeForLeadAssignment } from '../billing';
import { InsufficientBalanceError } from '../../errors/billing';
import { emailService } from '@findmeahotlead/email';
import { logAction, AuditActions } from '../audit-logger';
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
export async function createAssignmentWithCharge(leadId, providerId, subscriptionId, competitionLevelId, priceCents) {
    try {
        // Charge provider (atomic with row lock)
        const { newBalance } = await chargeForLeadAssignment(providerId, leadId, subscriptionId, priceCents);
        // Create assignment record
        const [assignment] = await sql `
      INSERT INTO lead_assignments (
        lead_id,
        provider_id,
        subscription_id,
        competition_level_id,
        price_cents,
        assigned_at
      ) VALUES (
        ${leadId},
        ${providerId},
        ${subscriptionId},
        ${competitionLevelId},
        ${priceCents},
        NOW()
      )
      RETURNING id
    `;
        // Update last_received_at for fairness (within same transaction context)
        await sql `
      UPDATE competition_level_subscriptions
      SET last_received_at = NOW()
      WHERE id = ${subscriptionId}
    `;
        // Log assignment creation
        await logAction({
            actorId: null,
            actorRole: 'system',
            action: AuditActions.ASSIGNMENT_CREATED,
            entity: 'lead_assignment',
            entityId: assignment.id,
            metadata: {
                lead_id: leadId,
                provider_id: providerId,
                subscription_id: subscriptionId,
                competition_level_id: competitionLevelId,
                price_cents: priceCents,
            },
        });
        // Queue email notification (async, don't wait)
        try {
            // Get provider and level info for email
            const [providerInfo] = await sql `
        SELECT 
          u.email,
          u.first_name,
          u.last_name,
          cl.name as level_name,
          n.name as niche_name
        FROM providers p
        JOIN users u ON p.user_id = u.id
        JOIN competition_level_subscriptions cls ON cls.provider_id = p.id
        JOIN competition_levels cl ON cls.competition_level_id = cl.id
        JOIN niches n ON cl.niche_id = n.id
        WHERE p.id = ${providerId}
          AND cls.id = ${subscriptionId}
      `;
            if (providerInfo) {
                await emailService.sendTemplated({
                    template: 'lead_assigned',
                    to: providerInfo.email,
                    variables: {
                        provider_name: `${providerInfo.first_name || ''} ${providerInfo.last_name || ''}`.trim() || providerInfo.email,
                        niche_name: providerInfo.niche_name,
                        level_name: providerInfo.level_name,
                        price_charged: (priceCents / 100).toFixed(2),
                        dashboard_url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/provider/leads` : undefined,
                    },
                    relatedEntity: {
                        type: 'lead_assignment',
                        id: assignment.id,
                    },
                    priority: 'high',
                });
            }
        }
        catch (emailError) {
            console.error('Failed to queue assignment email:', emailError);
            // Don't fail assignment if email fails
        }
        return {
            assignmentId: assignment.id,
            newBalance,
        };
    }
    catch (error) {
        // Re-throw InsufficientBalanceError as-is
        if (error instanceof InsufficientBalanceError) {
            throw error;
        }
        // Handle duplicate constraint (shouldn't happen with proper dedupe, but be safe)
        if (error && typeof error === 'object' && 'code' in error) {
            const pgError = error;
            if (pgError.code === '23505' && pgError.constraint === 'uq_lead_assignments_lead_provider') {
                throw new Error(`Duplicate assignment: provider ${providerId} already assigned to lead ${leadId}`);
            }
        }
        // Re-throw other errors
        throw error;
    }
}
/**
 * Retry wrapper for transient database failures
 *
 * Retries up to maxRetries times with exponential backoff + jitter.
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Result of function execution
 */
export async function retryWithBackoff(fn, maxRetries = 3) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Don't retry InsufficientBalanceError (not transient)
            if (error instanceof InsufficientBalanceError) {
                throw error;
            }
            // Don't retry on last attempt
            if (attempt === maxRetries) {
                break;
            }
            // Calculate backoff: exponential (2^attempt) + jitter (0-100ms)
            const baseDelay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
            const jitter = Math.random() * 100;
            const delay = baseDelay + jitter;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
//# sourceMappingURL=assignment.js.map