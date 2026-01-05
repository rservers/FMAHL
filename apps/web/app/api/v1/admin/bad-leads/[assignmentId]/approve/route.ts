/**
 * POST /api/v1/admin/bad-leads/:assignmentId/approve
 * 
 * Admin approves bad lead request and processes atomic refund
 * 
 * @see .cursor/docs/Delivery/Epic_09_Bad_Lead_Refunds.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { adminBadLeadActionSchema } from '@/lib/validations/bad-leads'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { emailService } from '@findmeahotlead/email'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(assignmentId)) {
    return NextResponse.json({ error: 'Invalid assignment ID format' }, { status: 400 })
  }

  return adminWithMFA(async (req, user) => {
    try {
      // Parse request body
      const body = await req.json()
      const validationResult = adminBadLeadActionSchema.safeParse(body)
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

      const { admin_memo } = validationResult.data

      // Process approval with atomic refund
      const result = await sql.begin(async (txn) => {
        // Get assignment with row-level lock
        const [assignment] = await txn`
          SELECT 
            la.id,
            la.lead_id,
            la.provider_id,
            la.subscription_id,
            la.price_cents,
            la.bad_lead_status,
            la.bad_lead_reported_at,
            la.refunded_at,
            l.niche_id,
            n.name as niche_name
          FROM lead_assignments la
          JOIN leads l ON la.lead_id = l.id
          JOIN niches n ON l.niche_id = n.id
          WHERE la.id = ${assignmentId}
            AND l.deleted_at IS NULL
          FOR UPDATE
        `

        if (!assignment) {
          throw new Error('Assignment not found')
        }

        // Idempotency: If already approved, return current state
        if (assignment.bad_lead_status === 'approved') {
          const [refundInfo] = await txn`
            SELECT refund_amount, refunded_at
            FROM lead_assignments
            WHERE id = ${assignmentId}
          `
          return {
            assignment_id: assignment.id,
            bad_lead_status: 'approved',
            refund_amount: refundInfo?.refund_amount ? Number(refundInfo.refund_amount) : null,
            refunded_at: refundInfo?.refunded_at ? refundInfo.refunded_at.toISOString() : null,
            is_existing: true,
            niche_name: assignment.niche_name,
            provider_id: assignment.provider_id,
            new_balance: 0,
          }
        }

        // If already rejected, return conflict
        if (assignment.bad_lead_status === 'rejected') {
          throw new Error('Already rejected')
        }

        // Validate pending status
        if (!assignment.bad_lead_status || assignment.bad_lead_status !== 'pending') {
          throw new Error('Bad lead request must be pending')
        }

        // Validate not already refunded
        if (assignment.refunded_at) {
          throw new Error('Assignment already refunded')
        }

        // Calculate refund amount (equals original charge)
        const refundAmount = Number(assignment.price_cents) / 100

        // Lock provider row for balance update
        const [provider] = await txn`
          SELECT balance FROM providers WHERE id = ${assignment.provider_id} FOR UPDATE
        `

        if (!provider) {
          throw new Error('Provider not found')
        }

        const currentBalance = Number(provider.balance)
        const newBalance = currentBalance + refundAmount

        // Update assignment
        await txn`
          UPDATE lead_assignments
          SET 
            bad_lead_status = 'approved',
            refunded_at = NOW(),
            refund_amount = ${refundAmount},
            refund_reason = ${admin_memo}
          WHERE id = ${assignmentId}
        `

        // Create refund ledger entry (within same transaction)
        const [ledgerEntry] = await txn`
          INSERT INTO provider_ledger (
            provider_id,
            entry_type,
            amount,
            balance_after,
            related_lead_id,
            related_subscription_id,
            actor_id,
            actor_role,
            memo
          ) VALUES (
            ${assignment.provider_id},
            'refund',
            ${refundAmount},
            ${newBalance},
            ${assignment.lead_id},
            ${assignment.subscription_id},
            ${user.id},
            'admin',
            ${'Bad lead refund: ' + admin_memo}
          )
          RETURNING id
        `

        // Update provider balance (within same transaction)
        await txn`
          UPDATE providers
          SET balance = ${newBalance}
          WHERE id = ${assignment.provider_id}
        `

        // Check and update subscription status (within same transaction)
        // Get active subscriptions
        const subscriptions = await txn`
          SELECT 
            cls.id,
            cls.is_active,
            cl.price_per_lead_cents,
            cl.name as level_name
          FROM competition_level_subscriptions cls
          JOIN competition_levels cl ON cls.competition_level_id = cl.id
          WHERE cls.provider_id = ${assignment.provider_id}
            AND cls.deleted_at IS NULL
            AND cls.is_active = false
            AND cls.deactivation_reason = 'insufficient_balance'
        `

        const newBalanceCents = Math.round(newBalance * 100)

        // Reactivate subscriptions if balance is now sufficient
        for (const sub of subscriptions) {
          if (newBalanceCents >= sub.price_per_lead_cents) {
            await txn`
              UPDATE competition_level_subscriptions
              SET 
                is_active = true,
                deactivation_reason = NULL,
                updated_at = NOW()
              WHERE id = ${sub.id}
            `
          }
        }

        return {
          assignment_id: assignment.id,
          bad_lead_status: 'approved',
          refund_amount: refundAmount,
          refunded_at: new Date().toISOString(),
          ledger_entry_id: ledgerEntry.id,
          new_balance: newBalance,
          is_existing: false,
          niche_name: assignment.niche_name,
          provider_id: assignment.provider_id,
        }
      })

      // Log audit actions
      await logAction({
        actorId: user.id,
        actorRole: 'admin',
        action: AuditActions.BAD_LEAD_APPROVED,
        entity: 'lead_assignment',
        entityId: assignmentId,
        metadata: {
          assignment_id: assignmentId,
          provider_id: result.provider_id,
          refund_amount: result.refund_amount,
          admin_memo,
        },
      })

      await logAction({
        actorId: null,
        actorRole: 'system',
        action: AuditActions.BAD_LEAD_REFUND_PROCESSED,
        entity: 'provider_ledger',
        entityId: result.ledger_entry_id,
        metadata: {
          assignment_id: assignmentId,
          ledger_entry_id: result.ledger_entry_id,
          refund_amount: result.refund_amount,
          balance_after: result.new_balance,
        },
      })

      // Send approval email to provider
      try {
        const [providerInfo] = await sql`
          SELECT 
            u.email,
            u.first_name || ' ' || u.last_name as provider_name,
            p.notify_on_bad_lead_decision
          FROM providers p
          JOIN users u ON p.user_id = u.id
          WHERE p.id = ${result.provider_id}
        `

        if (providerInfo?.notify_on_bad_lead_decision !== false) {
          await emailService.sendTemplated({
            template: 'bad_lead_approved',
            to: providerInfo.email,
            variables: {
              provider_name: providerInfo.provider_name || providerInfo.email,
              lead_id: result.assignment_id,
              niche_name: result.niche_name,
              refund_amount: (result.refund_amount || 0).toFixed(2),
              admin_memo,
              refunded_at: result.refunded_at || new Date().toISOString(),
              new_balance: (result.new_balance || 0).toFixed(2),
            },
            relatedEntity: {
              type: 'lead_assignment',
              id: assignmentId,
            },
            priority: 'normal',
          })
        }
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError)
        // Don't fail the request if email fails
      }

      return NextResponse.json({
        ok: true,
        assignment_id: result.assignment_id,
        bad_lead_status: result.bad_lead_status,
        refund_amount: result.refund_amount,
        refunded_at: result.refunded_at,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Already rejected') || error.message.includes('already refunded')) {
          return NextResponse.json(
            { error: error.message },
            { status: 409 }
          )
        }
        if (error.message.includes('not found')) {
          return NextResponse.json(
            { error: error.message },
            { status: 404 }
          )
        }
        if (error.message.includes('must be pending')) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          )
        }
      }

      console.error('Error approving bad lead:', error)
      return NextResponse.json(
        { error: 'Failed to approve bad lead' },
        { status: 500 }
      )
    }
  })(request)
}

