/**
 * Filter Invalidation Service for EPIC 05
 * 
 * Handles filter invalidation when niche schemas change.
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import { sql } from '../db'
import { validateFilterRules } from '../filter/validator'
import { logAction, AuditActions, SYSTEM_USER_ID } from './audit-logger'
import { emailService } from '@findmeahotlead/email'
import type { NicheFormSchema } from '../types/filter'

/**
 * Validate and invalidate filters for subscriptions in a niche
 * 
 * Called when niche form_schema is updated.
 */
export async function validateSubscriptionFiltersForNiche(nicheId: string): Promise<void> {
  // Get niche schema
  const [niche] = await sql`
    SELECT form_schema FROM niches WHERE id = ${nicheId}
  `

  if (!niche) {
    throw new Error(`Niche ${nicheId} not found`)
  }

  const nicheSchema: NicheFormSchema = niche.form_schema as NicheFormSchema

  // Get all subscriptions for this niche with filters
  const subscriptions = await sql`
    SELECT 
      cls.id,
      cls.provider_id,
      cls.filter_rules,
      cls.filter_is_valid,
      p.business_name,
      p.user_id,
      u.email as provider_email,
      cl.name as level_name
    FROM competition_level_subscriptions cls
    JOIN competition_levels cl ON cls.competition_level_id = cl.id
    JOIN providers p ON cls.provider_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE cl.niche_id = ${nicheId}
      AND cls.filter_rules IS NOT NULL
      AND cls.deleted_at IS NULL
  `

  const invalidatedSubscriptions: Array<{
    subscriptionId: string
    providerEmail: string
    providerName: string
    levelName: string
  }> = []

  // Validate each subscription's filters
  for (const subscription of subscriptions) {
    const filterRules = subscription.filter_rules as any

    // Validate against new schema
    const validation = validateFilterRules(filterRules, nicheSchema)

    if (!validation.valid) {
      // Mark as invalid
      await sql`
        UPDATE competition_level_subscriptions
        SET filter_is_valid = false
        WHERE id = ${subscription.id}
      `

      // Log invalidation
      await logAction({
        actorId: SYSTEM_USER_ID,
        actorRole: 'system',
        action: AuditActions.FILTER_INVALIDATED,
        entity: 'subscription',
        entityId: subscription.id,
        metadata: {
          niche_id: nicheId,
          subscription_id: subscription.id,
          validation_errors: validation.errors,
        },
      })

      invalidatedSubscriptions.push({
        subscriptionId: subscription.id,
        providerEmail: subscription.provider_email,
        providerName: subscription.business_name,
        levelName: subscription.level_name,
      })
    } else if (!subscription.filter_is_valid) {
      // Re-validate: mark as valid if it was previously invalid
      await sql`
        UPDATE competition_level_subscriptions
        SET filter_is_valid = true
        WHERE id = ${subscription.id}
      `
    }
  }

  // Send email notifications to affected providers
  for (const sub of invalidatedSubscriptions) {
    try {
      await emailService.sendTemplated({
        template: 'filter_invalidated',
        to: sub.providerEmail,
        variables: {
          provider_name: sub.providerName,
          level_name: sub.levelName,
        },
      })
    } catch (error) {
      console.error(`Failed to send filter invalidation email to ${sub.providerEmail}:`, error)
      // Don't throw - continue with other notifications
    }
  }
}

