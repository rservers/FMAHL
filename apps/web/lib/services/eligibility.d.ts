/**
 * Eligibility Service for EPIC 05
 *
 * Computes eligible subscriptions for a lead, grouped by competition level.
 * Implements Redis caching with 5-minute TTL.
 *
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */
export interface EligibleSubscription {
    id: string;
    provider_id: string;
    competition_level_id: string;
    subscription_id: string;
}
export interface EligibleSubscriptionsByLevel {
    [competitionLevelId: string]: EligibleSubscription[];
}
/**
 * Get eligible subscriptions for a lead, grouped by competition level
 *
 * Uses Redis caching with 5-minute TTL.
 * Cache key: `eligible_subs:${leadId}`
 */
export declare function getEligibleSubscriptionsByLevel(leadId: string): Promise<EligibleSubscriptionsByLevel>;
/**
 * Invalidate eligibility cache for a lead
 */
export declare function invalidateEligibilityCache(leadId: string): Promise<void>;
/**
 * Invalidate eligibility cache for all leads in a niche
 * (Useful when competition level or subscription changes)
 */
export declare function invalidateEligibilityCacheForNiche(nicheId: string): Promise<void>;
//# sourceMappingURL=eligibility.d.ts.map