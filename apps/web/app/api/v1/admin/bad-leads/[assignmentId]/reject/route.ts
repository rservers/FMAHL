/**
 * POST /api/v1/admin/bad-leads/:assignmentId/reject
 * 
 * Admin rejects bad lead request
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

      // Process rejection
      const result = await sql.begin(async (sql) => {
        // Get assignment with row-level lock
        const [assignment] = await sql`
          SELECT 
            la.id,
            la.lead_id,
            la.provider_id,
            la.bad_lead_status,
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

        // Idempotency: If already rejected, return current state
        if (assignment.bad_lead_status === 'rejected') {
          return {
            assignment_id: assignment.id,
            bad_lead_status: 'rejected',
            is_existing: true,
            niche_name: assignment.niche_name,
            provider_id: assignment.provider_id,
          }
        }

        // If already approved, return conflict
        if (assignment.bad_lead_status === 'approved') {
          throw new Error('Already approved')
        }

        // Validate pending status
        if (assignment.bad_lead_status !== 'pending') {
          throw new Error('Bad lead request must be pending')
        }

        // Update assignment
        await sql`
          UPDATE lead_assignments
          SET 
            bad_lead_status = 'rejected',
            refund_reason = ${admin_memo}
          WHERE id = ${assignmentId}
        `

        return {
          assignment_id: assignment.id,
          bad_lead_status: 'rejected',
          is_existing: false,
          niche_name: assignment.niche_name,
          provider_id: assignment.provider_id,
        }
      })

      // Log audit action
      await logAction({
        actorId: user.id,
        actorRole: 'admin',
        action: AuditActions.BAD_LEAD_REJECTED,
        entity: 'lead_assignment',
        entityId: assignmentId,
        metadata: {
          assignment_id: assignmentId,
          provider_id: result.provider_id,
          admin_memo,
        },
      })

      // Send rejection email to provider
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
            template: 'bad_lead_rejected',
            to: providerInfo.email,
            variables: {
              provider_name: providerInfo.provider_name || providerInfo.email,
              lead_id: result.assignment_id,
              niche_name: result.niche_name,
              admin_memo,
              reviewed_at: new Date().toISOString(),
            },
            relatedEntity: {
              type: 'lead_assignment',
              id: assignmentId,
            },
            priority: 'normal',
          })
        }
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError)
        // Don't fail the request if email fails
      }

      return NextResponse.json({
        ok: true,
        assignment_id: result.assignment_id,
        bad_lead_status: result.bad_lead_status,
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Already approved')) {
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

      console.error('Error rejecting bad lead:', error)
      return NextResponse.json(
        { error: 'Failed to reject bad lead' },
        { status: 500 }
      )
    }
  })(request)
}

