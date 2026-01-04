/**
 * GET /api/v1/admin/leads/:id
 * 
 * Get detailed lead information for admin review.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_03_Admin_Lead_Review_Approval.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { sql } from '@/lib/db'

export const GET = adminWithMFA(async (request: NextRequest) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const leadsIndex = pathParts.indexOf('leads')
    const id = leadsIndex >= 0 && pathParts[leadsIndex + 1] ? pathParts[leadsIndex + 1] : null

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

      // Validate UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
      }

      // Fetch lead with all details
      const [lead] = await sql`
        SELECT 
          l.*,
          n.name as niche_name,
          n.form_schema as niche_form_schema,
          n.active_schema_version as niche_schema_version,
          approved_user.email as approved_by_email,
          rejected_user.email as rejected_by_email
        FROM leads l
        LEFT JOIN niches n ON l.niche_id = n.id
        LEFT JOIN users approved_user ON l.approved_by = approved_user.id
        LEFT JOIN users rejected_user ON l.rejected_by = rejected_user.id
        WHERE l.id = ${id}
      `

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }

      // Format form_data with schema labels if available
      let formattedFormData = lead.niche_data
      if (lead.niche_form_schema && Array.isArray(lead.niche_form_schema)) {
        const schema = lead.niche_form_schema as any[]
        formattedFormData = {}
        for (const field of schema) {
          const value = lead.niche_data[field.field_key]
          if (value !== undefined) {
            formattedFormData[field.field_key] = {
              label: field.label,
              value: value,
              type: field.type,
            }
          }
        }
      }

      return NextResponse.json({
        id: lead.id,
        niche_id: lead.niche_id,
        niche_name: lead.niche_name,
        niche_form_schema: lead.niche_form_schema,
        schema_version: lead.niche_schema_version,
        status: lead.status,
        submitter_name: lead.submitter_name,
        submitter_email: lead.submitter_email,
        submitter_phone: lead.submitter_phone,
        form_data: formattedFormData,
        attribution: {
          utm_source: lead.utm_source,
          utm_medium: lead.utm_medium,
          utm_campaign: lead.utm_campaign,
          referrer_url: lead.referrer_url,
          partner_id: lead.partner_id,
        },
        confirmation: {
          confirmed_at: lead.confirmed_at ? lead.confirmed_at.toISOString() : null,
          ip_address: lead.ip_address,
          user_agent: lead.user_agent,
        },
        approval: lead.approved_at
          ? {
              approved_at: lead.approved_at.toISOString(),
              approved_by: lead.approved_by,
              approved_by_email: lead.approved_by_email,
            }
          : null,
        rejection: lead.rejected_at
          ? {
              rejected_at: lead.rejected_at.toISOString(),
              rejected_by: lead.rejected_by,
              rejected_by_email: lead.rejected_by_email,
              rejection_reason: lead.rejection_reason,
            }
          : null,
        admin_notes: lead.admin_notes,
        created_at: lead.created_at.toISOString(),
        updated_at: lead.updated_at ? lead.updated_at.toISOString() : null,
      })

    } catch (error: any) {
      console.error('Admin lead detail error:', error)

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
)

