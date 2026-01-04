/**
 * GET /api/v1/admin/bad-leads/:assignmentId
 * 
 * Admin bad lead detail view with full context
 * 
 * @see .cursor/docs/Delivery/Epic_09_Bad_Lead_Refunds.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { sql } from '@/lib/db'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(assignmentId)) {
    return NextResponse.json({ error: 'Invalid assignment ID format' }, { status: 400 })
  }

  return adminWithMFA(async () => {
    try {
      // Get assignment with full context
      const [assignment] = await sql`
        SELECT 
          la.id as assignment_id,
          la.lead_id,
          la.provider_id,
          la.subscription_id,
          la.competition_level_id,
          la.status,
          la.price_cents / 100.0 as price_charged,
          la.assigned_at,
          la.viewed_at,
          la.accepted_at,
          la.rejected_at,
          la.rejection_reason,
          la.bad_lead_reported_at,
          la.bad_lead_reason_category,
          la.bad_lead_reason_notes,
          la.bad_lead_status,
          la.refunded_at,
          la.refund_amount,
          la.refund_reason,
          l.niche_id,
          n.name as niche_name,
          l.form_data,
          l.contact_email,
          l.contact_phone,
          l.contact_name,
          l.status as lead_status,
          l.created_at as lead_created_at,
          l.approved_at,
          l.approved_by,
          u.first_name || ' ' || u.last_name as provider_name,
          u.email as provider_email,
          cl.name as competition_level_name,
          cls.competition_level_id
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        JOIN niches n ON l.niche_id = n.id
        JOIN providers p ON la.provider_id = p.id
        JOIN users u ON p.user_id = u.id
        JOIN competition_levels cl ON la.competition_level_id = cl.id
        JOIN competition_level_subscriptions cls ON la.subscription_id = cls.id
        WHERE la.id = ${assignmentId}
          AND l.deleted_at IS NULL
      `

      if (!assignment) {
        return NextResponse.json(
          { error: 'Assignment not found' },
          { status: 404 }
        )
      }

      // Get ledger entries for this assignment
      const ledgerEntries = await sql`
        SELECT 
          id,
          entry_type,
          amount,
          balance_after,
          created_at,
          memo
        FROM provider_ledger
        WHERE related_lead_id = ${assignment.lead_id}
          AND provider_id = ${assignment.provider_id}
        ORDER BY created_at DESC
      `

      const response = {
        assignment: {
          assignment_id: assignment.assignment_id,
          lead_id: assignment.lead_id,
          provider_id: assignment.provider_id,
          provider_name: assignment.provider_name || 'Unknown',
          provider_email: assignment.provider_email,
          niche_id: assignment.niche_id,
          niche_name: assignment.niche_name,
          competition_level_name: assignment.competition_level_name,
          status: assignment.status,
          price_charged: Number(assignment.price_charged),
          assigned_at: assignment.assigned_at.toISOString(),
          viewed_at: assignment.viewed_at ? assignment.viewed_at.toISOString() : null,
          accepted_at: assignment.accepted_at ? assignment.accepted_at.toISOString() : null,
          rejected_at: assignment.rejected_at ? assignment.rejected_at.toISOString() : null,
          rejection_reason: assignment.rejection_reason,
          bad_lead_reported_at: assignment.bad_lead_reported_at ? assignment.bad_lead_reported_at.toISOString() : null,
          bad_lead_reason_category: assignment.bad_lead_reason_category,
          bad_lead_reason_notes: assignment.bad_lead_reason_notes,
          bad_lead_status: assignment.bad_lead_status,
          refunded_at: assignment.refunded_at ? assignment.refunded_at.toISOString() : null,
          refund_amount: assignment.refund_amount ? Number(assignment.refund_amount) : null,
          refund_reason: assignment.refund_reason,
        },
        lead: {
          lead_id: assignment.lead_id,
          contact_email: assignment.contact_email,
          contact_phone: assignment.contact_phone,
          contact_name: assignment.contact_name,
          form_data: assignment.form_data || {},
          status: assignment.lead_status,
          created_at: assignment.lead_created_at.toISOString(),
          approved_at: assignment.approved_at ? assignment.approved_at.toISOString() : null,
          approved_by: assignment.approved_by,
        },
        billing_context: {
          price_charged: Number(assignment.price_charged),
          competition_level: assignment.competition_level_name,
          subscription_id: assignment.subscription_id,
        },
        ledger_history: ledgerEntries.map((entry: any) => ({
          id: entry.id,
          entry_type: entry.entry_type,
          amount: Number(entry.amount),
          balance_after: Number(entry.balance_after),
          created_at: entry.created_at.toISOString(),
          memo: entry.memo,
        })),
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching bad lead detail:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bad lead details' },
        { status: 500 }
      )
    }
  })(request)
}

