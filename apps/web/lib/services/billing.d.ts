/**
 * Billing Service for EPIC 07 - Billing & Payments
 *
 * Atomic charging for lead assignments with row-level locking.
 *
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */
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
export declare function chargeForLeadAssignment(providerId: string, leadId: string, subscriptionId: string, amountCents: number): Promise<{
    success: true;
    newBalance: number;
}>;
/**
 * Check if provider has sufficient balance for a charge
 *
 * @param providerId - Provider ID
 * @param amountCents - Amount in cents
 * @returns True if sufficient balance
 */
export declare function hasSufficientBalance(providerId: string, amountCents: number): Promise<boolean>;
//# sourceMappingURL=billing.d.ts.map