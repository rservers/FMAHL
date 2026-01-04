/**
 * POST /api/v1/provider/leads/:leadId/reject
 * 
 * Provider rejects a lead assignment
 * 
 * @see .cursor/docs/Delivery/Epic_08_Provider_Lead_Management.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { rejectLeadSchema } from '@/lib/validations/provider-leads'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { emailService } from '@findmeahotlead/email'

export const POST = withAuth(
  async (request: NextRequest, user) => {
    try {
      // Extract lead ID from URL
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      const rejectIndex = pathParts.indexOf('reject')
      const leadId = rejectIndex > 0 ? pathParts[rejectIndex - 1] : null

      if (!leadId) {
        return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(leadId)) {
        return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 })
      }

      // Parse request body
      const body = await request.json()
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

      const { rejection_reason } = validationResult.data

      // Get provider ID
      const [provider] = await sql`
        SELECT id FROM providers WHERE user_id = ${user.id}
      `

      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }

      const providerId = provider.id

      // Reject lead with row-level locking
      const result = await sql.begin(async (sql) => {
        const [assignment] = await sql`
          SELECT 
            la.id as assignment_id,
            la.status,
            la.lead_id,
            l.niche_id,
            n.name as niche_name
          FROM lead_assignments la
          JOIN leads l ON la.lead_id = l.id
          JOIN niches n ON l.niche_id = n.id
          WHERE la.lead_id = ${leadId}
            AND la.provider_id = ${providerId}
            AND l.deleted_at IS NULL
          FOR UPDATE
        `

        if (!assignment) {
          throw new Error('Assignment not found')
        }

        if (assignment.status !== 'active') {
          throw new Error(`Lead already ${assignment.status}`)
        }

        // Update status to rejected
        await sql`
          UPDATE lead_assignments
          SET 
            status = 'rejected',
            rejected_at = NOW(),
            rejection_reason = ${rejection_reason}
          WHERE id = ${assignment.assignment_id}
        `

        return {
          assignment_id: assignment.assignment_id,
          lead_id: assignment.lead_id,
          niche_name: assignment.niche_name,
        }
      })

      // Log rejection action
      await logAction({
        actorId: user.id,
        actorRole: 'provider',
        action: AuditActions.LEAD_REJECTED_BY_PROVIDER,
        entity: 'lead_assignment',
        entityId: result.assignment_id,
        metadata: {
          lead_id: result.lead_id,
          provider_id: providerId,
          rejection_reason,
        },
      })

      // Notify admin if configured (default: true)
      const notifyAdmin = process.env.NOTIFY_ADMIN_ON_PROVIDER_REJECT !== 'false'
      if (notifyAdmin) {
        try {
          // Get admin emails
          const adminUsers = await sql`
            SELECT email FROM users WHERE role = 'admin' AND status = 'active' LIMIT 5
          `

          // Get provider info for email
          const [providerInfo] = await sql`
            SELECT 
              u.email as provider_email,
              u.first_name || ' ' || u.last_name as provider_name
            FROM providers p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ${providerId}
          `

          // Send email to admins
          for (const admin of adminUsers) {
            await emailService.sendTemplated({
              template: 'admin_provider_rejected_lead',
              to: admin.email,
              variables: {
                provider_name: providerInfo?.provider_name || providerInfo?.provider_email || 'Provider',
                lead_id: result.lead_id,
                niche_name: result.niche_name,
                rejection_reason,
                rejected_at: new Date().toISOString(),
              },
              relatedEntity: {
                type: 'lead_assignment',
                id: result.assignment_id,
              },
              priority: 'normal',
            })
          }
        } catch (emailError) {
          console.error('Failed to notify admin:', emailError)
          // Don't fail the request if admin notification fails
        }
      }

      return NextResponse.json({
        ok: true,
        assignment_id: result.assignment_id,
        status: 'rejected',
        rejected_at: new Date().toISOString(),
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already')) {
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
        if (error.message.includes('Missing') || error.message.includes('required')) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          )
        }
      }

      console.error('Error rejecting lead:', error)
      return NextResponse.json(
        { error: 'Failed to reject lead' },
        { status: 500 }
      )
    }
  },
  { allowedRoles: ['provider'] }
)

