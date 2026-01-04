/**
 * POST /api/v1/webhooks/paypal
 * 
 * PayPal webhook handler for payment events.
 * 
 * Handles: CHECKOUT.ORDER.APPROVED
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { processPayPalWebhook } from '@/lib/services/payment'
import { checkAndUpdateSubscriptionStatus } from '@/lib/services/subscription-status'
import { checkLowBalanceAlert, reactivateEligibleSubscriptions } from '@/lib/services/balance-alerts'
import { sql } from '@/lib/db'

export const POST = async (request: NextRequest) => {
  try {
    // Get body and headers
    const body = await request.json()
    const headers = Object.fromEntries(request.headers.entries())

    // Process webhook
    const result = await processPayPalWebhook(headers, body)

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
    console.error('PayPal webhook error:', error)
    // Return 200 to prevent PayPal retries
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 200 })
  }
}

