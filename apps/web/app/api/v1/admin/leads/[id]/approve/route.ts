/**
 * POST /api/v1/admin/leads/:id/approve
 * 
 * Approve a lead for distribution.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_03_Admin_Lead_Review_Approval.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { approveLeadSchema } from '@/lib/validations/admin-leads'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { emailService } from '@findmeahotlead/email'
import { createDistributionQueue } from '@/lib/queues/distribution'

export const POST = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const approveIndex = pathParts.indexOf('approve')
    const id = approveIndex > 0 ? pathParts[approveIndex - 1] : null

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }
      const body = await request.json()

      // Validate request body
      const validationResult = approveLeadSchema.safeParse(body)
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

      const { notes, notify_user } = validationResult.data

      // Validate UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
      }

      // Check lead exists and is in pending_approval
      const [lead] = await sql`
        SELECT 
          id,
          status,
          submitter_email,
          submitter_name,
          niche_id
        FROM leads
        WHERE id = ${id}
      `

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }

      if (lead.status !== 'pending_approval') {
        return NextResponse.json(
          {
            error: 'Lead is not in pending approval status',
            current_status: lead.status,
          },
          { status: 400 }
        )
      }

      // Update lead status
      await sql`
        UPDATE leads
        SET 
          status = 'approved',
          approved_at = NOW(),
          approved_by = ${user.id},
          admin_notes = ${notes || null},
          updated_at = NOW()
        WHERE id = ${id}
      `

      // Audit log
      await logAction({
        actorId: user.id,
        actorRole: user.role,
        action: AuditActions.LEAD_APPROVED,
        entity: 'lead',
        entityId: id,
        metadata: {
          notes: notes || null,
          notify_user: notify_user || false,
        },
      })

      // Optional: Send approval notification email
      if (notify_user) {
        try {
          const [niche] = await sql`SELECT name FROM niches WHERE id = ${lead.niche_id}`
          
          await emailService.sendTemplated({
            template: 'lead_approved',
            to: lead.submitter_email,
            variables: {
              contact_name: lead.submitter_name,
              niche_name: niche?.name || 'service',
            },
            relatedEntity: {
              type: 'lead',
              id: id,
            },
            priority: 'normal',
          })
        } catch (emailError) {
          // Log but don't fail - email is optional
          console.error('Failed to send approval email:', emailError)
        }
      }

      // EPIC 06: Auto-distribute approved lead (if enabled)
      const AUTO_DISTRIBUTE_ENABLED = process.env.AUTO_DISTRIBUTE_ON_APPROVAL === 'true'
      if (AUTO_DISTRIBUTE_ENABLED) {
        try {
          const queue = createDistributionQueue()
          await queue.add('distribute', {
            leadId: id,
            triggeredBy: {
              actorId: user.id,
              actorRole: 'admin',
            },
            requestedAt: new Date().toISOString(),
          })
          console.log(`[Auto-Distribute] Queued distribution for lead ${id} after approval`)
        } catch (distError) {
          // Log but don't fail - distribution can be triggered manually later
          console.error('Failed to auto-queue distribution:', distError)
        }
      }

      // Return updated lead
      const [updatedLead] = await sql`
        SELECT 
          id,
          status,
          approved_at,
          approved_by,
          admin_notes
        FROM leads
        WHERE id = ${id}
      `

      return NextResponse.json({
        id: updatedLead.id,
        status: updatedLead.status,
        approved_at: updatedLead.approved_at.toISOString(),
        approved_by: updatedLead.approved_by,
        admin_notes: updatedLead.admin_notes,
      })

    } catch (error: any) {
      console.error('Approve lead error:', error)

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
)

