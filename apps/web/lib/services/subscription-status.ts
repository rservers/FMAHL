/**
 * Subscription Status Management Service (EPIC 04)
 * 
 * Handles auto-deactivation/reactivation of subscriptions based on provider balance.
 * 
 * Integration point for EPIC 07 (Billing & Payments)
 * 
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */

import { sql } from '../db'
import { logAction, AuditActions } from './audit-logger'
import { emailService } from '@findmeahotlead/email'

/**
 * Check provider balance and update subscription statuses
 * 
 * EPIC 07 Integration: This function will be called when balance changes
 * 
 * @param providerId Provider ID to check
 */
export async function checkAndUpdateSubscriptionStatus(providerId: string): Promise<void> {
  try {
    // Get provider's subscriptions
    const subscriptions = await sql`
      SELECT 
        cls.id,
        cls.competition_level_id,
        cls.is_active,
        cl.price_per_lead_cents,
        cl.name as level_name
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      WHERE cls.provider_id = ${providerId}
        AND cls.deleted_at IS NULL
        AND cls.is_active = true
    `

    // EPIC 07: Get actual provider balance
    const [provider] = await sql`
      SELECT balance FROM providers WHERE id = ${providerId}
    `
    
    if (!provider) {
      return
    }
    
    const providerBalance = parseFloat(provider.balance.toString())
    const providerBalanceCents = Math.round(providerBalance * 100)

    for (const subscription of subscriptions) {
      const pricePerLead = subscription.price_per_lead_cents
      const hasSufficientBalance = providerBalanceCents >= pricePerLead
      const currentlyActive = subscription.is_active

      if (!hasSufficientBalance && currentlyActive) {
        // Deactivate subscription
        await sql`
          UPDATE competition_level_subscriptions
          SET 
            is_active = false,
            deactivation_reason = 'insufficient_balance',
            updated_at = NOW()
          WHERE id = ${subscription.id}
        `

        // Audit log
        await logAction({
          actorId: null, // System action
          actorRole: 'system',
          action: AuditActions.SUBSCRIPTION_DEACTIVATED,
          entity: 'competition_level_subscription',
          entityId: subscription.id,
          metadata: {
            reason: 'insufficient_balance',
            balance_cents: providerBalanceCents,
            price_per_lead_cents: pricePerLead,
          },
        })

        // Send notification email (EPIC 10)
        try {
          const [provider] = await sql`
            SELECT u.email, u.first_name, u.last_name
            FROM providers p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ${providerId}
          `

          if (provider) {
            await emailService.sendTemplated({
              template: 'subscription_deactivated',
              to: provider.email,
              variables: {
                provider_name: `${provider.first_name || ''} ${provider.last_name || ''}`.trim() || provider.email,
                level_name: subscription.level_name,
                price_per_lead: (pricePerLead / 100).toFixed(2),
              },
              relatedEntity: {
                type: 'competition_level_subscription',
                id: subscription.id,
              },
              priority: 'normal',
            })
          }
        } catch (emailError) {
          console.error('Failed to send deactivation email:', emailError)
          // Don't fail the whole operation if email fails
        }

      } else if (hasSufficientBalance && !currentlyActive && subscription.deactivation_reason === 'insufficient_balance') {
        // Reactivate subscription
        await sql`
          UPDATE competition_level_subscriptions
          SET 
            is_active = true,
            deactivation_reason = NULL,
            updated_at = NOW()
          WHERE id = ${subscription.id}
        `

        // Audit log
        await logAction({
          actorId: null, // System action
          actorRole: 'system',
          action: AuditActions.SUBSCRIPTION_REACTIVATED,
          entity: 'competition_level_subscription',
          entityId: subscription.id,
          metadata: {
            reason: 'balance_restored',
            balance_cents: providerBalanceCents,
            price_per_lead_cents: pricePerLead,
          },
        })

        // Send notification email (EPIC 10)
        try {
          const [provider] = await sql`
            SELECT u.email, u.first_name, u.last_name
            FROM providers p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ${providerId}
          `

          if (provider) {
            await emailService.sendTemplated({
              template: 'subscription_reactivated',
              to: provider.email,
              variables: {
                provider_name: `${provider.first_name || ''} ${provider.last_name || ''}`.trim() || provider.email,
                level_name: subscription.level_name,
              },
              relatedEntity: {
                type: 'competition_level_subscription',
                id: subscription.id,
              },
              priority: 'normal',
            })
          }
        } catch (emailError) {
          console.error('Failed to send reactivation email:', emailError)
          // Don't fail the whole operation if email fails
        }
      }
    }
  } catch (error) {
    console.error('Error checking subscription status:', error)
    throw error
  }
}

/**
 * Batch reactivate eligible subscriptions
 * 
 * Background job to run every 5 minutes
 */
export async function reactivateEligibleSubscriptions(): Promise<void> {
  try {
    // Get all inactive subscriptions with insufficient_balance reason
    const inactiveSubscriptions = await sql`
      SELECT DISTINCT cls.provider_id
      FROM competition_level_subscriptions cls
      WHERE cls.is_active = false
        AND cls.deactivation_reason = 'insufficient_balance'
        AND cls.deleted_at IS NULL
    `

    for (const sub of inactiveSubscriptions) {
      await checkAndUpdateSubscriptionStatus(sub.provider_id)
    }
  } catch (error) {
    console.error('Error reactivating eligible subscriptions:', error)
    throw error
  }
}

