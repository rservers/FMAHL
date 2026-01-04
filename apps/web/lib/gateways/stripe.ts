/**
 * Stripe Gateway Integration for EPIC 07
 * 
 * Handles Stripe Checkout Session creation and webhook verification.
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

let stripeInstance: Stripe | null = null

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required')
    }
    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    })
  }
  return stripeInstance
}

/**
 * Create Stripe Checkout Session
 */
export async function createStripeCheckoutSession(
  providerId: string,
  amount: number,
  currency: string = 'USD',
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<{ sessionId: string; checkoutUrl: string }> {
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: 'Provider Deposit',
            description: `Deposit for provider ${providerId}`,
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      provider_id: providerId,
      ...metadata,
    },
  })

  return {
    sessionId: session.id,
    checkoutUrl: session.url || '',
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeWebhook(payload: string | Buffer, signature: string): Stripe.Event {
  if (!stripeWebhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required')
  }
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret)
}

/**
 * Extract payment intent ID from Stripe event
 */
export function extractPaymentIntentId(event: Stripe.Event): string | null {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    return session.payment_intent as string | null
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    return paymentIntent.id
  }

  return null
}

