/**
 * Billing Service for EPIC 07 - Billing & Payments
 *
 * Atomic charging for lead assignments with row-level locking.
 *
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */
import { sql } from '../db';
import { InsufficientBalanceError } from '../errors/billing';
import { getProviderBalance } from './ledger';
/**
 * Charge provider for lead assignment (atomic operation)
 *
 * This function performs:
 * 1. Row-level lock on provider
 * 2. Balance check
 * 3. Ledger entry creation
 * 4. Balance update
 *
 * All within a single transaction to prevent race conditions.
 *
 * @param providerId - Provider ID
 * @param leadId - Lead ID
 * @param subscriptionId - Subscription ID
 * @param amountCents - Amount in cents
 * @returns New balance after charge
 */
export async function chargeForLeadAssignment(providerId, leadId, subscriptionId, amountCents) {
    const amount = amountCents / 100;
    return sql.begin(async (sql) => {
        // 1. Lock provider row (SELECT FOR UPDATE)
        const [provider] = await sql `
      SELECT balance FROM providers WHERE id = ${providerId} FOR UPDATE
    `;
        if (!provider) {
            throw new Error(`Provider not found: ${providerId}`);
        }
        const currentBalance = parseFloat(provider.balance.toString());
        // 2. Check balance
        if (currentBalance < amount) {
            throw new InsufficientBalanceError(currentBalance, amount);
        }
        // 3. Calculate new balance
        const newBalance = currentBalance - amount;
        // 4. Insert ledger entry
        await sql `
      INSERT INTO provider_ledger (
        provider_id,
        entry_type,
        amount,
        balance_after,
        related_lead_id,
        related_subscription_id,
        actor_role
      ) VALUES (
        ${providerId},
        'lead_purchase',
        ${amount},
        ${newBalance},
        ${leadId},
        ${subscriptionId},
        'system'
      )
    `;
        // 5. Update cached balance
        await sql `
      UPDATE providers
      SET balance = ${newBalance}
      WHERE id = ${providerId}
    `;
        return { success: true, newBalance };
    });
}
/**
 * Check if provider has sufficient balance for a charge
 *
 * @param providerId - Provider ID
 * @param amountCents - Amount in cents
 * @returns True if sufficient balance
 */
export async function hasSufficientBalance(providerId, amountCents) {
    const amount = amountCents / 100;
    const balance = await getProviderBalance(providerId);
    return balance >= amount;
}
//# sourceMappingURL=billing.js.map