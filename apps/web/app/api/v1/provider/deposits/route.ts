/**
 * POST /api/v1/provider/deposits
 * 
 * Initiate a deposit via Stripe or PayPal.
 * 
 * Requires: Provider authentication
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { providerOnly } from '@/lib/middleware/rbac'
import { createDepositSchema } from '@/lib/validations/billing'
import { MIN_DEPOSIT_USD } from '@/lib/constants/billing'
import { initiateStripeDeposit, initiatePayPalDeposit } from '@/lib/services/payment'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { sql } from '@/lib/db'

export const POST = providerOnly(async (request: NextRequest, user: any) => {
  try {
    // Get provider
    const [provider] = await sql`
      SELECT id, status FROM providers WHERE user_id = ${user.id} LIMIT 1
    `

    if (!provider) {
      return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 })
    }

    // Check provider is active (not suspended)
    if (provider.status === 'suspended') {
      return NextResponse.json(
        { error: 'Provider account is suspended. Cannot process deposits.' },
        { status: 403 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validationResult = createDepositSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues.map((e) => ({
            field: String(e.path.join('.')),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    const { provider_name, amount, currency } = validationResult.data

    // Check minimum deposit
    if (amount < MIN_DEPOSIT_USD) {
      return NextResponse.json(
        {
          error: 'minimum_deposit',
          message: `Minimum deposit is ${MIN_DEPOSIT_USD.toFixed(2)} USD.`,
        },
        { status: 400 }
      )
    }

    // Initiate deposit based on provider
    let result: { paymentId: string; checkoutUrl: string }

    if (provider_name === 'stripe') {
      result = await initiateStripeDeposit(provider.id, amount, currency)
    } else if (provider_name === 'paypal') {
      result = await initiatePayPalDeposit(provider.id, amount, currency)
    } else {
      return NextResponse.json({ error: 'Invalid payment provider' }, { status: 400 })
    }

    // Audit log
    await logAction({
      actorId: user.id,
      actorRole: 'provider',
      action: AuditActions.DEPOSIT_INITIATED,
      entity: 'payment',
      entityId: result.paymentId,
      metadata: {
        provider_name,
        amount,
        currency,
      },
    })

    return NextResponse.json(
      {
        payment_id: result.paymentId,
        provider_name,
        checkout_url: result.checkoutUrl,
        status: 'pending',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Deposit initiation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

