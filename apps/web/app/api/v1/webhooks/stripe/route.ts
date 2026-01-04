/**
 * POST /api/v1/webhooks/stripe
 * 
 * Stripe webhook handler for payment events.
 * 
 * Handles: checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { processStripeWebhook } from '@/lib/services/payment'
import { checkAndUpdateSubscriptionStatus } from '@/lib/services/subscription-status'
import { checkLowBalanceAlert, reactivateEligibleSubscriptions } from '@/lib/services/balance-alerts'
import { sql } from '@/lib/db'

export const POST = async (request: NextRequest) => {
  try {
    // Get raw body and signature
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Process webhook (verifies signature and processes payment)
    const result = await processStripeWebhook(body, signature)

    if (!result.processed) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Get provider ID from payment
    if (result.paymentId) {
      const [payment] = await sql`
        SELECT provider_id FROM payments WHERE id = ${result.paymentId}
      `

      if (payment) {
        // Check subscription status and reactivate if needed
        await checkAndUpdateSubscriptionStatus(payment.provider_id)
        await reactivateEligibleSubscriptions(payment.provider_id)

        // Check low balance alert
        await checkLowBalanceAlert(payment.provider_id)
      }
    }

    // Always return 200 (idempotent)
    return NextResponse.json({ received: true, processed: result.processed }, { status: 200 })
  } catch (error: any) {
    console.error('Stripe webhook error:', error)
    // Return 200 to prevent Stripe retries for invalid signatures
    // Log error for investigation
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 200 })
  }
}

