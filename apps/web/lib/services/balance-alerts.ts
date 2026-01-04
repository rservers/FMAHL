/**
 * Balance Alerts Service for EPIC 07
 * 
 * Handles low-balance alerts and subscription reactivation.
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { sql } from '../db'
import { emailService } from '@findmeahotlead/email'
import { logAction, AuditActions } from './audit-logger'

/**
 * Check and send low-balance alert if threshold crossed
 */
export async function checkLowBalanceAlert(providerId: string): Promise<void> {
  const [provider] = await sql`
    SELECT 
      id,
      balance,
      low_balance_threshold,
      low_balance_alert_sent,
      business_name,
      user_id
    FROM providers
    WHERE id = ${providerId}
  `

  if (!provider) {
    return
  }

  const balance = parseFloat(provider.balance.toString())
  const threshold = provider.low_balance_threshold
    ? parseFloat(provider.low_balance_threshold.toString())
    : null

  // No threshold set, skip
  if (!threshold) {
    return
  }

  // Check if threshold crossed
  if (balance < threshold) {
    // Alert not sent yet
    if (!provider.low_balance_alert_sent) {
      // Get provider email
      const [user] = await sql`
        SELECT email FROM users WHERE id = ${provider.user_id}
      `

      if (user?.email) {
        // Send alert email
        try {
          await emailService.sendTemplated({
            template: 'low_balance_alert',
            to: user.email,
            variables: {
              provider_name: provider.business_name,
              balance: balance.toFixed(2),
              threshold: threshold.toFixed(2),
              currency: 'USD',
              deposit_url: process.env.DEPOSIT_URL || 'http://localhost:3000/billing/deposit',
            },
          })

          // Mark alert as sent
          await sql`
            UPDATE providers
            SET low_balance_alert_sent = true
            WHERE id = ${providerId}
          `

          // Audit log
          await logAction({
            actorId: null,
            actorRole: 'system',
            action: AuditActions.LOW_BALANCE_ALERT_SENT,
            entity: 'provider',
            entityId: providerId,
            metadata: {
              balance,
              threshold,
            },
          })
        } catch (error) {
          console.error('Failed to send low balance alert:', error)
        }
      }
    }
  } else {
    // Balance above threshold, reset alert flag
    if (provider.low_balance_alert_sent) {
      await sql`
        UPDATE providers
        SET low_balance_alert_sent = false
        WHERE id = ${providerId}
      `
    }
  }
}

/**
 * Reactivate eligible subscriptions after balance increase
 */
export async function reactivateEligibleSubscriptions(providerId: string): Promise<void> {
  // Find subscriptions deactivated due to insufficient funds
  const subscriptions = await sql`
    SELECT 
      cls.id,
      cls.competition_level_id,
      cl.name as level_name,
      cl.price_per_lead_cents
    FROM competition_level_subscriptions cls
    JOIN competition_levels cl ON cls.competition_level_id = cl.id
    WHERE cls.provider_id = ${providerId}
      AND cls.is_active = false
      AND cls.deactivation_reason = 'insufficient_balance'
      AND cls.deleted_at IS NULL
  `

  // Get provider balance
  const [provider] = await sql`
    SELECT balance FROM providers WHERE id = ${providerId}
  `

  if (!provider) {
    return
  }

  const balance = parseFloat(provider.balance.toString())
  const reactivatedLevels: string[] = []

  // Check each subscription
  for (const sub of subscriptions) {
    const pricePerLead = parseFloat(sub.price_per_lead_cents.toString()) / 100

    // Reactivate if balance sufficient
    if (balance >= pricePerLead) {
      await sql`
        UPDATE competition_level_subscriptions
        SET 
          is_active = true,
          deactivation_reason = NULL
        WHERE id = ${sub.id}
      `

      reactivatedLevels.push(sub.level_name)

      // Audit log
      await logAction({
        actorId: null,
        actorRole: 'system',
        action: AuditActions.SUBSCRIPTION_REACTIVATED,
        entity: 'subscription',
        entityId: sub.id,
        metadata: {
          competition_level_id: sub.competition_level_id,
          reason: 'balance_restored',
        },
      })
    }
  }

  // Send notification if any reactivated
  if (reactivatedLevels.length > 0) {
    try {
      const [providerInfo] = await sql`
        SELECT business_name, user_id FROM providers WHERE id = ${providerId}
      `
      const [user] = await sql`
        SELECT email FROM users WHERE id = ${providerInfo.user_id}
      `

      if (user?.email) {
        await emailService.sendTemplated({
          template: 'subscription_reactivated',
          to: user.email,
          variables: {
            provider_name: providerInfo.business_name,
            level_name: reactivatedLevels.join(', '),
          },
        })
      }
    } catch (error) {
      console.error('Failed to send reactivation notification:', error)
    }
  }
}

