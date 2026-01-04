/**
 * Payment Service for EPIC 07
 * 
 * Handles payment gateway integration and payment record management.
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { sql } from '../db'
import { createLedgerEntry } from './ledger'
import { checkAndUpdateSubscriptionStatus } from './subscription-status'
import { checkLowBalanceAlert, reactivateEligibleSubscriptions } from './balance-alerts'
import { createStripeCheckoutSession, verifyStripeWebhook, extractPaymentIntentId } from '../gateways/stripe'
import { createPayPalOrder, capturePayPalOrder, verifyPayPalWebhook } from '../gateways/paypal'
import { DuplicatePaymentError, PaymentNotFoundError } from '../errors/billing'
import { emailService } from '@findmeahotlead/email'
import type { PaymentProvider, Payment } from '../types/billing'

const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/billing/success'
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/billing/cancel'
const PAYPAL_SUCCESS_URL = process.env.PAYPAL_SUCCESS_URL || 'http://localhost:3000/billing/success'
const PAYPAL_CANCEL_URL = process.env.PAYPAL_CANCEL_URL || 'http://localhost:3000/billing/cancel'

/**
 * Create payment record
 */
export async function createPayment(
  providerId: string,
  providerName: PaymentProvider,
  externalPaymentId: string,
  amount: number,
  currency: string = 'USD',
  metadata?: Record<string, any>
): Promise<string> {
  const [payment] = await sql`
    INSERT INTO payments (
      provider_id,
      provider_name,
      external_payment_id,
      amount,
      currency,
      status,
      metadata
    ) VALUES (
      ${providerId},
      ${providerName},
      ${externalPaymentId},
      ${amount},
      ${currency},
      'pending',
      ${metadata ? JSON.stringify(metadata) : null}
    )
    RETURNING id
  `

  return payment.id
}

/**
 * Initiate Stripe deposit
 */
export async function initiateStripeDeposit(
  providerId: string,
  amount: number,
  currency: string = 'USD'
): Promise<{ paymentId: string; checkoutUrl: string }> {
  // Create checkout session
  const { sessionId, checkoutUrl } = await createStripeCheckoutSession(
    providerId,
    amount,
    currency,
    STRIPE_SUCCESS_URL,
    STRIPE_CANCEL_URL,
    { provider_id: providerId }
  )

  // Create payment record
  const paymentId = await createPayment(providerId, 'stripe', sessionId, amount, currency, {
    session_id: sessionId,
  })

  return { paymentId, checkoutUrl }
}

/**
 * Initiate PayPal deposit
 */
export async function initiatePayPalDeposit(
  providerId: string,
  amount: number,
  currency: string = 'USD'
): Promise<{ paymentId: string; checkoutUrl: string }> {
  // Create PayPal order
  const { orderId, approvalUrl } = await createPayPalOrder(
    providerId,
    amount,
    currency,
    PAYPAL_SUCCESS_URL,
    PAYPAL_CANCEL_URL
  )

  // Create payment record
  const paymentId = await createPayment(providerId, 'paypal', orderId, amount, currency, {
    order_id: orderId,
  })

  return { paymentId, checkoutUrl: approvalUrl }
}

/**
 * Process Stripe webhook
 */
export async function processStripeWebhook(
  payload: string | Buffer,
  signature: string
): Promise<{ processed: boolean; paymentId?: string }> {
  // Verify signature
  const event = verifyStripeWebhook(payload, signature)

  // Extract payment intent ID
  const paymentIntentId = extractPaymentIntentId(event)

  if (!paymentIntentId) {
    return { processed: false }
  }

    // Find payment by external_payment_id (session ID or payment intent ID)
    const eventObjectId = (event.data.object as any).id || paymentIntentId
    const [payment] = await sql`
      SELECT id, provider_id, amount, status, provider_name, external_payment_id
      FROM payments
      WHERE external_payment_id = ${paymentIntentId}
         OR external_payment_id = ${eventObjectId}
         OR metadata->>'session_id' = ${eventObjectId}
      LIMIT 1
    `

  if (!payment) {
    return { processed: false }
  }

  // Check if already processed (idempotency)
  if (payment.status === 'completed') {
    return { processed: true, paymentId: payment.id }
  }

  // Process payment
  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    return sql.begin(async (sql) => {
      // Update payment status
      await sql`
        UPDATE payments
        SET status = 'completed', updated_at = NOW()
        WHERE id = ${payment.id}
      `

      // Credit ledger
      await createLedgerEntry({
        provider_id: payment.provider_id,
        entry_type: 'deposit',
        amount: parseFloat(payment.amount.toString()),
        related_payment_id: payment.id,
        actor_role: 'system',
      })

      // Queue notification email (non-blocking)
      try {
        const [provider] = await sql`
          SELECT business_name, user_id FROM providers WHERE id = ${payment.provider_id}
        `
        const [user] = await sql`
          SELECT email FROM users WHERE id = ${provider.user_id}
        `

        if (user?.email) {
          await emailService.sendTemplated({
            template: 'deposit_completed',
            to: user.email,
            variables: {
              provider_name: provider.business_name,
              amount: parseFloat(payment.amount.toString()).toFixed(2),
              currency: 'USD',
            },
          })
        }
      } catch (error) {
        console.error('Failed to send deposit notification email:', error)
      }

      // Check subscription status and reactivate if needed
      await checkAndUpdateSubscriptionStatus(payment.provider_id)
      await reactivateEligibleSubscriptions(payment.provider_id)

      // Check low balance alert
      await checkLowBalanceAlert(payment.provider_id)

      return { processed: true, paymentId: payment.id }
    })
  }

  if (event.type === 'payment_intent.payment_failed') {
    await sql`
      UPDATE payments
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${payment.id}
    `
    return { processed: true, paymentId: payment.id }
  }

  return { processed: false }
}

/**
 * Process PayPal webhook
 */
export async function processPayPalWebhook(
  headers: Record<string, string>,
  body: any
): Promise<{ processed: boolean; paymentId?: string }> {
  // Verify webhook
  const isValid = await verifyPayPalWebhook(headers, body)

  if (!isValid) {
    return { processed: false }
  }

  const orderId = body.resource?.id

  if (!orderId) {
    return { processed: false }
  }

  // Find payment
  const [payment] = await sql`
    SELECT id, provider_id, amount, status
    FROM payments
    WHERE external_payment_id = ${orderId}
      AND provider_name = 'paypal'
    LIMIT 1
  `

  if (!payment) {
    return { processed: false }
  }

  // Check idempotency
  if (payment.status === 'completed') {
    return { processed: true, paymentId: payment.id }
  }

  // Capture order and process
  if (body.event_type === 'CHECKOUT.ORDER.APPROVED') {
    try {
      await capturePayPalOrder(orderId)

      return sql.begin(async (sql) => {
        // Update payment status
        await sql`
          UPDATE payments
          SET status = 'completed', updated_at = NOW()
          WHERE id = ${payment.id}
        `

        // Credit ledger
        await createLedgerEntry({
          provider_id: payment.provider_id,
          entry_type: 'deposit',
          amount: parseFloat(payment.amount.toString()),
          related_payment_id: payment.id,
          actor_role: 'system',
        })

        // Queue notification email (non-blocking)
        try {
          const [provider] = await sql`
            SELECT business_name, user_id FROM providers WHERE id = ${payment.provider_id}
          `
          const [user] = await sql`
            SELECT email FROM users WHERE id = ${provider.user_id}
          `

          if (user?.email) {
            await emailService.sendTemplated({
              template: 'deposit_completed',
              to: user.email,
              variables: {
                provider_name: provider.business_name,
                amount: parseFloat(payment.amount.toString()).toFixed(2),
                currency: 'USD',
              },
            })
          }
        } catch (error) {
          console.error('Failed to send deposit notification email:', error)
        }

        // Check subscription status and reactivate if needed
        await checkAndUpdateSubscriptionStatus(payment.provider_id)
        await reactivateEligibleSubscriptions(payment.provider_id)

        // Check low balance alert
        await checkLowBalanceAlert(payment.provider_id)

        return { processed: true, paymentId: payment.id }
      })
    } catch (error: any) {
      // Capture failed
      await sql`
        UPDATE payments
        SET status = 'failed', updated_at = NOW()
        WHERE id = ${payment.id}
      `
      return { processed: true, paymentId: payment.id }
    }
  }

  return { processed: false }
}

