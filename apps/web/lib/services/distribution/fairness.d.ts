/**
 * Within-Level Fairness Selection Service for EPIC 06
 *
 * Implements LRU (Least Recently Used) selection of providers within a level
 * to ensure fair distribution among subscribers.
 *
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */
export interface SelectedProvider {
    providerId: string;
    subscriptionId: string;
}
/**
 * Select providers within a level using LRU fairness
 *
 * Orders by last_received_at ASC (NULLS FIRST) with provider_id tie-breaker.
 * Excludes providers already assigned to this lead (cross-level dedupe).
 *
 * @param competitionLevelId - Competition level ID
 * @param maxRecipients - Maximum number of providers to select
 * @param excludeProviderIds - Provider IDs to exclude (already assigned)
 * @param eligibleSubscriptionIds - Subscription IDs that are eligible for this lead
 * @returns Selected providers with their subscription IDs
 */
export declare function selectProvidersForLevel(competitionLevelId: string, maxRecipients: number, excludeProviderIds: string[], eligibleSubscriptionIds: string[]): Promise<SelectedProvider[]>;
//# sourceMappingURL=fairness.d.ts.map