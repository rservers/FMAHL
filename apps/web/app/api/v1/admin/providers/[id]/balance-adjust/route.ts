/**
 * POST /api/v1/admin/providers/:id/balance-adjust
 * 
 * Admin manual balance adjustment (credit or debit).
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { balanceAdjustSchema } from '@/lib/validations/billing'
import { InsufficientBalanceError } from '@/lib/errors/billing'
import { createLedgerEntry } from '@/lib/services/ledger'
import { checkAndUpdateSubscriptionStatus } from '@/lib/services/subscription-status'
import { reactivateEligibleSubscriptions } from '@/lib/services/balance-alerts'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { sql } from '@/lib/db'

export const POST = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract provider ID from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const providerIdIndex = pathParts.indexOf('providers')
    const providerId = providerIdIndex >= 0 && pathParts[providerIdIndex + 1]
      ? pathParts[providerIdIndex + 1]
      : null

    if (!providerId) {
      return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 })
    }

    // Validate request body
    const body = await request.json()
    const validationResult = balanceAdjustSchema.safeParse(body)
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

    const { entry_type, amount, memo } = validationResult.data

    // Verify provider exists
    const [provider] = await sql`
      SELECT id, balance FROM providers WHERE id = ${providerId}
    `

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    // For debits, check balance and lock row
    if (entry_type === 'manual_debit') {
      return sql.begin(async (sql) => {
        // Lock provider row
        const [lockedProvider] = await sql`
          SELECT balance FROM providers WHERE id = ${providerId} FOR UPDATE
        `

        const currentBalance = parseFloat(lockedProvider.balance.toString())

        if (currentBalance < amount) {
          throw new InsufficientBalanceError(currentBalance, amount)
        }

        // Create ledger entry
        await createLedgerEntry({
          provider_id: providerId,
          entry_type: 'manual_debit',
          amount,
          actor_id: user.id,
          actor_role: 'admin',
          memo,
        })

        // Audit log
        await logAction({
          actorId: user.id,
          actorRole: 'admin',
          action: AuditActions.BALANCE_ADJUSTED,
          entity: 'provider',
          entityId: providerId,
          metadata: {
            entry_type: 'manual_debit',
            amount,
            memo,
          },
        })

        // Check subscription status
        await checkAndUpdateSubscriptionStatus(providerId)

        // Get updated balance
        const [updatedProvider] = await sql`
          SELECT balance FROM providers WHERE id = ${providerId}
        `

        return NextResponse.json({
          success: true,
          entry_type: 'manual_debit',
          amount,
          new_balance: parseFloat(updatedProvider.balance.toString()),
        })
      })
    } else {
      // Manual credit (no balance check needed)
      await createLedgerEntry({
        provider_id: providerId,
        entry_type: 'manual_credit',
        amount,
        actor_id: user.id,
        actor_role: 'admin',
        memo,
      })

      // Audit log
      await logAction({
        actorId: user.id,
        actorRole: 'admin',
        action: AuditActions.BALANCE_ADJUSTED,
        entity: 'provider',
        entityId: providerId,
        metadata: {
          entry_type: 'manual_credit',
          amount,
          memo,
        },
      })

      // Check subscription status and reactivate if needed
      await checkAndUpdateSubscriptionStatus(providerId)
      await reactivateEligibleSubscriptions(providerId)

      // Get updated balance
      const [updatedProvider] = await sql`
        SELECT balance FROM providers WHERE id = ${providerId}
      `

      return NextResponse.json({
        success: true,
        entry_type: 'manual_credit',
        amount,
        new_balance: parseFloat(updatedProvider.balance.toString()),
      })
    }
  } catch (error: any) {
    console.error('Balance adjustment error:', error)
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          message: error.message,
          current_balance: error.currentBalance,
          required_amount: error.requiredAmount,
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

