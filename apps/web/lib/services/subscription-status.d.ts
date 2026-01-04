/**
 * Subscription Status Management Service (EPIC 04)
 *
 * Handles auto-deactivation/reactivation of subscriptions based on provider balance.
 *
 * Integration point for EPIC 07 (Billing & Payments)
 *
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */
/**
 * Check provider balance and update subscription statuses
 *
 * EPIC 07 Integration: This function will be called when balance changes
 *
 * @param providerId Provider ID to check
 */
export declare function checkAndUpdateSubscriptionStatus(providerId: string): Promise<void>;
/**
 * Batch reactivate eligible subscriptions
 *
 * Background job to run every 5 minutes
 */
export declare function reactivateEligibleSubscriptions(): Promise<void>;
//# sourceMappingURL=subscription-status.d.ts.map