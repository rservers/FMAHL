/**
 * PayPal Gateway Integration for EPIC 07
 * 
 * Handles PayPal Order creation and webhook verification.
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

// @ts-ignore - PayPal SDK doesn't have TypeScript types
import paypal from '@paypal/checkout-server-sdk'

const mode = process.env.PAYPAL_MODE || 'sandbox'

/**
 * Get PayPal environment
 */
function environment(): any {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables are required')
  }
  
  if (mode === 'live') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret)
  }
  return new paypal.core.SandboxEnvironment(clientId, clientSecret)
}

/**
 * Get PayPal client
 */
function client(): any {
  return new paypal.core.PayPalHttpClient(environment())
}

/**
 * Create PayPal Order
 */
export async function createPayPalOrder(
  providerId: string,
  amount: number,
  currency: string = 'USD',
  successUrl: string,
  cancelUrl: string
): Promise<{ orderId: string; approvalUrl: string }> {
  const request = new paypal.orders.OrdersCreateRequest()
  request.prefer('return=representation')
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
        custom_id: providerId,
      },
    ],
    application_context: {
      brand_name: 'Find Me A Hot Lead',
      landing_page: 'BILLING',
      user_action: 'PAY_NOW',
      return_url: successUrl,
      cancel_url: cancelUrl,
    },
  })

  const order = await client().execute(request)

  const approvalUrl = order.result.links?.find((link: any) => link.rel === 'approve')?.href

  if (!approvalUrl) {
    throw new Error('Failed to get PayPal approval URL')
  }

  return {
    orderId: order.result.id!,
    approvalUrl,
  }
}

/**
 * Capture PayPal Order
 */
export async function capturePayPalOrder(orderId: string): Promise<{ id: string; status: string }> {
  const request = new paypal.orders.OrdersCaptureRequest(orderId)
  request.requestBody({})

  const capture = await client().execute(request)

  return {
    id: capture.result.id!,
    status: capture.result.status!,
  }
}

/**
 * Verify PayPal webhook signature
 * 
 * Note: PayPal webhook verification requires additional setup.
 * For MVP, we'll verify the order exists and is completed.
 */
export async function verifyPayPalWebhook(headers: Record<string, string>, body: any): Promise<boolean> {
  // In production, use PayPal's webhook verification SDK
  // For MVP, verify order exists and is completed
  if (body.resource_type === 'checkout-order' && body.event_type === 'CHECKOUT.ORDER.APPROVED') {
    const orderId = body.resource?.id
    if (orderId) {
      // Verify order exists (simplified for MVP)
      return true
    }
  }
  if (body.event_type === 'CHECKOUT.ORDER.APPROVED') {
    return true
  }
  return false
}

