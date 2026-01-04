/**
 * Within-Level Fairness Selection Service for EPIC 06
 *
 * Implements LRU (Least Recently Used) selection of providers within a level
 * to ensure fair distribution among subscribers.
 *
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */
import { sql } from '../../db';
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
export async function selectProvidersForLevel(competitionLevelId, maxRecipients, excludeProviderIds, eligibleSubscriptionIds) {
    if (eligibleSubscriptionIds.length === 0) {
        return [];
    }
    // Build exclusion filter
    const excludeFilter = excludeProviderIds.length > 0
        ? sql `AND cls.provider_id NOT IN ${sql(excludeProviderIds)}`
        : sql ``;
    // Select providers ordered by fairness (LRU)
    const subscriptions = await sql `
    SELECT 
      cls.id as subscription_id,
      cls.provider_id,
      cls.last_received_at
    FROM competition_level_subscriptions cls
    WHERE cls.competition_level_id = ${competitionLevelId}
      AND cls.id IN ${sql(eligibleSubscriptionIds)}
      AND cls.is_active = true
      AND cls.deleted_at IS NULL
      ${excludeFilter}
    ORDER BY 
      cls.last_received_at ASC NULLS FIRST,
      cls.provider_id ASC
    LIMIT ${maxRecipients}
  `;
    return subscriptions.map((sub) => ({
        providerId: sub.provider_id,
        subscriptionId: sub.subscription_id,
    }));
}
//# sourceMappingURL=fairness.js.map