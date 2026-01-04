/**
 * Eligibility Service for EPIC 05
 * 
 * Computes eligible subscriptions for a lead, grouped by competition level.
 * Implements Redis caching with 5-minute TTL.
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import { sql } from '../db'
import { getRedis } from '../redis'
import { evaluateEligibility } from '../filter/evaluator'
import type { FilterRules, NicheFormSchema } from '../types/filter'

export interface EligibleSubscription {
  id: string
  provider_id: string
  competition_level_id: string
  subscription_id: string
}

export interface EligibleSubscriptionsByLevel {
  [competitionLevelId: string]: EligibleSubscription[]
}

/**
 * Get eligible subscriptions for a lead, grouped by competition level
 * 
 * Uses Redis caching with 5-minute TTL.
 * Cache key: `eligible_subs:${leadId}`
 */
export async function getEligibleSubscriptionsByLevel(
  leadId: string
): Promise<EligibleSubscriptionsByLevel> {
  const redis = getRedis()
  const cacheKey = `eligible_subs:${leadId}`

  // Try cache first
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached) as EligibleSubscriptionsByLevel
    }
  } catch (error) {
    console.warn('Redis cache read failed, computing eligibility:', error)
  }

  // Get lead data
  const [lead] = await sql`
    SELECT 
      l.id,
      l.niche_id,
      l.form_data,
      n.form_schema
    FROM leads l
    JOIN niches n ON l.niche_id = n.id
    WHERE l.id = ${leadId}
      AND l.status = 'approved'
      AND l.deleted_at IS NULL
  `

  if (!lead) {
    return {}
  }

  const leadFormData = lead.form_data as Record<string, unknown>
  const nicheSchema: NicheFormSchema = lead.form_schema as NicheFormSchema

  // Get all active subscriptions for this niche with active competition levels
  const subscriptions = await sql`
    SELECT 
      cls.id as subscription_id,
      cls.provider_id,
      cls.competition_level_id,
      cls.filter_rules,
      cls.filter_is_valid,
      cl.id as level_id,
      cl.is_active as level_is_active
    FROM competition_level_subscriptions cls
    JOIN competition_levels cl ON cls.competition_level_id = cl.id
    WHERE cl.niche_id = ${lead.niche_id}
      AND cl.is_active = true
      AND cl.deleted_at IS NULL
      AND cls.is_active = true
      AND cls.deleted_at IS NULL
      AND cls.filter_is_valid = true
  `

  const eligibleByLevel: EligibleSubscriptionsByLevel = {}

  // Evaluate each subscription
  for (const subscription of subscriptions) {
    const filterRules: FilterRules | null = subscription.filter_rules
      ? (subscription.filter_rules as FilterRules)
      : null

    // No filters = eligible (all leads)
    if (!filterRules || !filterRules.rules || filterRules.rules.length === 0) {
      const levelId = subscription.competition_level_id
      if (!eligibleByLevel[levelId]) {
        eligibleByLevel[levelId] = []
      }
      eligibleByLevel[levelId].push({
        id: subscription.subscription_id,
        provider_id: subscription.provider_id,
        competition_level_id: subscription.competition_level_id,
        subscription_id: subscription.subscription_id,
      })
      continue
    }

    // Evaluate eligibility
    const result = evaluateEligibility(leadFormData, filterRules, nicheSchema)

    if (result.eligible) {
      const levelId = subscription.competition_level_id
      if (!eligibleByLevel[levelId]) {
        eligibleByLevel[levelId] = []
      }
      eligibleByLevel[levelId].push({
        id: subscription.subscription_id,
        provider_id: subscription.provider_id,
        competition_level_id: subscription.competition_level_id,
        subscription_id: subscription.subscription_id,
      })
    }
  }

  // Cache result (5 minutes TTL)
  try {
    await redis.setex(cacheKey, 300, JSON.stringify(eligibleByLevel))
  } catch (error) {
    console.warn('Redis cache write failed:', error)
  }

  return eligibleByLevel
}

/**
 * Invalidate eligibility cache for a lead
 */
export async function invalidateEligibilityCache(leadId: string): Promise<void> {
  const redis = getRedis()
  const cacheKey = `eligible_subs:${leadId}`
  try {
    await redis.del(cacheKey)
  } catch (error) {
    console.warn('Redis cache invalidation failed:', error)
  }
}

/**
 * Invalidate eligibility cache for all leads in a niche
 * (Useful when competition level or subscription changes)
 */
export async function invalidateEligibilityCacheForNiche(nicheId: string): Promise<void> {
  const redis = getRedis()
  try {
    // Get all approved leads for this niche
    const leads = await sql`
      SELECT id FROM leads
      WHERE niche_id = ${nicheId}
        AND status = 'approved'
        AND deleted_at IS NULL
    `

    // Delete cache for each lead
    const pipeline = redis.pipeline()
    for (const lead of leads) {
      pipeline.del(`eligible_subs:${lead.id}`)
    }
    await pipeline.exec()
  } catch (error) {
    console.warn('Redis cache bulk invalidation failed:', error)
  }
}

