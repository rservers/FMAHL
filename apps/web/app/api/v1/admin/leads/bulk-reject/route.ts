/**
 * POST /api/v1/admin/leads/bulk-reject
 * 
 * Bulk reject multiple leads.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_03_Admin_Lead_Review_Approval.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { bulkRejectSchema } from '@/lib/validations/admin-leads'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'

export const POST = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    const body = await request.json()

    // Validate request body
    const validationResult = bulkRejectSchema.safeParse(body)
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

    const { lead_ids, reason, notes } = validationResult.data

    const success: Array<{ lead_id: string; status: string }> = []
    const failed: Array<{ lead_id: string; error: string }> = []

    // Process each lead individually (no transaction across leads)
    for (const leadId of lead_ids) {
      try {
        // Check lead exists and is in pending_approval
        const [lead] = await sql`
          SELECT id, status FROM leads WHERE id = ${leadId}
        `

        if (!lead) {
          failed.push({ lead_id: leadId, error: 'Lead not found' })
          continue
        }

        if (lead.status !== 'pending_approval') {
          failed.push({
            lead_id: leadId,
            error: `Lead is not in pending approval status (current: ${lead.status})`,
          })
          continue
        }

        // Update lead
        await sql`
          UPDATE leads
          SET 
            status = 'rejected',
            rejected_at = NOW(),
            rejected_by = ${user.id},
            rejection_reason = ${reason},
            admin_notes = ${notes || null},
            updated_at = NOW()
          WHERE id = ${leadId}
        `

        // Audit log
        await logAction({
          actorId: user.id,
          actorRole: user.role,
          action: AuditActions.LEAD_REJECTED,
          entity: 'lead',
          entityId: leadId,
          metadata: {
            bulk: true,
            reason: reason,
            notes: notes || null,
          },
        })

        success.push({ lead_id: leadId, status: 'rejected' })

      } catch (error: any) {
        failed.push({
          lead_id: leadId,
          error: error.message || 'Failed to reject lead',
        })
      }
    }

    return NextResponse.json({
      success,
      failed,
      total: lead_ids.length,
      succeeded: success.length,
      failed_count: failed.length,
    })

  } catch (error: any) {
    console.error('Bulk reject error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

