/**
 * POST /api/v1/admin/leads/:id/reject
 * 
 * Reject a lead.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_03_Admin_Lead_Review_Approval.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { rejectLeadSchema } from '@/lib/validations/admin-leads'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { emailService } from '@findmeahotlead/email'

export const POST = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const rejectIndex = pathParts.indexOf('reject')
    const id = rejectIndex > 0 ? pathParts[rejectIndex - 1] : null

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }
      const body = await request.json()

      // Validate request body
      const validationResult = rejectLeadSchema.safeParse(body)
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

      const { reason, notes, notify_user } = validationResult.data

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
          status = 'rejected',
          rejected_at = NOW(),
          rejected_by = ${user.id},
          rejection_reason = ${reason},
          admin_notes = ${notes || null},
          updated_at = NOW()
        WHERE id = ${id}
      `

      // Audit log
      await logAction({
        actorId: user.id,
        actorRole: user.role,
        action: AuditActions.LEAD_REJECTED,
        entity: 'lead',
        entityId: id,
        metadata: {
          reason: reason,
          notes: notes || null,
          notify_user: notify_user || false,
        },
      })

      // Optional: Send rejection notification email
      if (notify_user) {
        try {
          const [niche] = await sql`SELECT name FROM niches WHERE id = ${lead.niche_id}`
          
          await emailService.sendTemplated({
            template: 'lead_rejected',
            to: lead.submitter_email,
            variables: {
              contact_name: lead.submitter_name,
              niche_name: niche?.name || 'service',
              rejection_reason: reason,
            },
            relatedEntity: {
              type: 'lead',
              id: id,
            },
            priority: 'normal',
          })
        } catch (emailError) {
          // Log but don't fail - email is optional
          console.error('Failed to send rejection email:', emailError)
        }
      }

      // Return updated lead
      const [updatedLead] = await sql`
        SELECT 
          id,
          status,
          rejected_at,
          rejected_by,
          rejection_reason,
          admin_notes
        FROM leads
        WHERE id = ${id}
      `

      return NextResponse.json({
        id: updatedLead.id,
        status: updatedLead.status,
        rejected_at: updatedLead.rejected_at.toISOString(),
        rejected_by: updatedLead.rejected_by,
        rejection_reason: updatedLead.rejection_reason,
        admin_notes: updatedLead.admin_notes,
      })

    } catch (error: any) {
      console.error('Reject lead error:', error)

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
)

