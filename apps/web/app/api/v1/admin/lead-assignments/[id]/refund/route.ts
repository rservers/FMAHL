/**
 * POST /api/v1/admin/lead-assignments/:id/refund
 * 
 * Refund a lead assignment (admin only).
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { refundAssignmentSchema } from '@/lib/validations/billing'
import { RefundAlreadyProcessedError } from '@/lib/errors/billing'
import { createLedgerEntry } from '@/lib/services/ledger'
import { checkAndUpdateSubscriptionStatus } from '@/lib/services/subscription-status'
import { reactivateEligibleSubscriptions } from '@/lib/services/balance-alerts'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { emailService } from '@findmeahotlead/email'
import { sql } from '@/lib/db'

export const POST = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract assignment ID from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const assignmentIdIndex = pathParts.indexOf('lead-assignments')
    const assignmentId = assignmentIdIndex >= 0 && pathParts[assignmentIdIndex + 1]
      ? pathParts[assignmentIdIndex + 1]
      : null

    if (!assignmentId) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 })
    }

    // Validate request body
    const body = await request.json()
    const validationResult = refundAssignmentSchema.safeParse(body)
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

    const { refund_reason, memo } = validationResult.data

    // Get assignment with provider info
    const [assignment] = await sql`
      SELECT 
        la.id,
        la.provider_id,
        la.lead_id,
        la.subscription_id,
        la.price_cents,
        la.refunded_at,
        p.business_name,
        p.user_id
      FROM lead_assignments la
      JOIN providers p ON la.provider_id = p.id
      WHERE la.id = ${assignmentId}
    `

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Check if already refunded
    if (assignment.refunded_at) {
      return NextResponse.json(
        {
          error: 'Assignment already refunded',
          refunded_at: assignment.refunded_at.toISOString(),
        },
        { status: 409 }
      )
    }

    const refundAmount = parseFloat(assignment.price_cents.toString()) / 100

    // Process refund in transaction
    return sql.begin(async (sql) => {
      // Insert refund ledger entry
      await createLedgerEntry({
        provider_id: assignment.provider_id,
        entry_type: 'refund',
        amount: refundAmount,
        related_lead_id: assignment.lead_id,
        related_subscription_id: assignment.subscription_id,
        actor_id: user.id,
        actor_role: 'admin',
        memo: memo || refund_reason,
      })

      // Update assignment
      await sql`
        UPDATE lead_assignments
        SET 
          refunded_at = NOW(),
          refund_reason = ${refund_reason},
          status = 'refunded'
        WHERE id = ${assignmentId}
      `

      // Audit log
      await logAction({
        actorId: user.id,
        actorRole: 'admin',
        action: AuditActions.REFUND_PROCESSED,
        entity: 'lead_assignment',
        entityId: assignmentId,
        metadata: {
          provider_id: assignment.provider_id,
          lead_id: assignment.lead_id,
          refund_amount: refundAmount,
          refund_reason,
        },
      })

      // Check subscription status and reactivate if needed
      await checkAndUpdateSubscriptionStatus(assignment.provider_id)
      await reactivateEligibleSubscriptions(assignment.provider_id)

      // Send notification email (non-blocking)
      try {
        const [userRecord] = await sql`
          SELECT email FROM users WHERE id = ${assignment.user_id}
        `

        if (userRecord?.email) {
          await emailService.sendTemplated({
            template: 'refund_processed',
            to: userRecord.email,
            variables: {
              provider_name: assignment.business_name,
              amount: refundAmount.toFixed(2),
              currency: 'USD',
              refund_reason,
              billing_url: process.env.BILLING_URL || 'http://localhost:3000/billing/history',
            },
          })
        }
      } catch (error) {
        console.error('Failed to send refund notification email:', error)
      }

      // Get updated balance
      const [provider] = await sql`
        SELECT balance FROM providers WHERE id = ${assignment.provider_id}
      `

      return NextResponse.json({
        success: true,
        assignment_id: assignmentId,
        refund_amount: refundAmount,
        new_balance: parseFloat(provider.balance.toString()),
      })
    })
  } catch (error: any) {
    console.error('Refund error:', error)
    if (error instanceof RefundAlreadyProcessedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

