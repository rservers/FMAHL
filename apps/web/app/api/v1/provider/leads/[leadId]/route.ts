/**
 * GET /api/v1/provider/leads/:leadId
 * 
 * Provider lead detail view with automatic viewed tracking
 * 
 * @see .cursor/docs/Delivery/Epic_08_Provider_Lead_Management.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import type { LeadDetailView } from '@/lib/types/provider-leads'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await context.params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(leadId)) {
    return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 })
  }

  return withAuth(request, async (user) => {
    try {

      // Get provider ID
      const [provider] = await sql`
        SELECT id FROM providers WHERE user_id = ${user.id}
      `

      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }

      const providerId = provider.id

      // Get assignment with lead details
      const [assignment] = await sql`
        SELECT 
          la.id as assignment_id,
          la.lead_id,
          l.niche_id,
          n.name as niche_name,
          la.status,
          la.price_cents / 100.0 as price_charged,
          la.assigned_at,
          la.viewed_at,
          la.accepted_at,
          la.rejected_at,
          la.rejection_reason,
          l.contact_email,
          l.contact_phone,
          l.contact_name,
          l.form_data,
          l.utm_source,
          l.utm_medium,
          l.utm_campaign,
          l.referrer_url,
          cl.name as competition_level_name,
          cls.id as subscription_id,
          la.competition_level_id
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        JOIN niches n ON l.niche_id = n.id
        JOIN competition_levels cl ON la.competition_level_id = cl.id
        JOIN competition_level_subscriptions cls ON la.subscription_id = cls.id
        WHERE la.lead_id = ${leadId}
          AND la.provider_id = ${providerId}
          AND l.deleted_at IS NULL
      `

      if (!assignment) {
        return NextResponse.json(
          { error: 'Lead not found or not assigned to you' },
          { status: 404 }
        )
      }

      // Mark as viewed if not already viewed (automatic viewed tracking)
      if (!assignment.viewed_at) {
        await sql`
          UPDATE lead_assignments
          SET viewed_at = NOW()
          WHERE id = ${assignment.assignment_id}
            AND viewed_at IS NULL
        `

        // Log viewing action
        await logAction({
          actorId: user.id,
          actorRole: 'provider',
          action: AuditActions.LEAD_VIEWED,
          entity: 'lead_assignment',
          entityId: assignment.assignment_id,
          metadata: {
            lead_id: leadId,
            provider_id: providerId,
          },
        })
      }

      // Build response
      const showAttribution = process.env.SHOW_ATTRIBUTION_TO_PROVIDERS === 'true'

      const response: LeadDetailView = {
        assignment_id: assignment.assignment_id,
        lead_id: assignment.lead_id,
        niche_id: assignment.niche_id,
        niche_name: assignment.niche_name,
        status: assignment.status,
        price_charged: Number(assignment.price_charged),
        assigned_at: assignment.assigned_at.toISOString(),
        viewed_at: assignment.viewed_at ? assignment.viewed_at.toISOString() : new Date().toISOString(),
        accepted_at: assignment.accepted_at ? assignment.accepted_at.toISOString() : null,
        rejected_at: assignment.rejected_at ? assignment.rejected_at.toISOString() : null,
        rejection_reason: assignment.rejection_reason,
        contact_email: assignment.contact_email,
        contact_phone: assignment.contact_phone,
        contact_name: assignment.contact_name,
        form_data: assignment.form_data || {},
        billing_context: {
          price_charged: Number(assignment.price_charged),
          charged_at: assignment.assigned_at.toISOString(),
          competition_level: assignment.competition_level_name,
          subscription_id: assignment.subscription_id,
        },
        ...(showAttribution && {
          attribution: {
            utm_source: assignment.utm_source,
            utm_medium: assignment.utm_medium,
            utm_campaign: assignment.utm_campaign,
            referrer_url: assignment.referrer_url,
          },
        }),
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching lead detail:', error)
      return NextResponse.json(
        { error: 'Failed to fetch lead details' },
        { status: 500 }
      )
    }
  }, { allowedRoles: ['provider'] })
}

