/**
 * POST /api/v1/provider/leads/:leadId/accept
 * 
 * Provider accepts a lead assignment
 * 
 * @see .cursor/docs/Delivery/Epic_08_Provider_Lead_Management.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { acceptLeadSchema } from '@/lib/validations/provider-leads'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { emailService } from '@findmeahotlead/email'

export const POST = withAuth(
  async (request: NextRequest, user) => {
    try {
      // Extract lead ID from URL
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      const acceptIndex = pathParts.indexOf('accept')
      const leadId = acceptIndex > 0 ? pathParts[acceptIndex - 1] : null

      if (!leadId) {
        return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(leadId)) {
        return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 })
      }

      // Parse request body (should be empty for accept)
      const body = await request.json().catch(() => ({}))
      const validationResult = acceptLeadSchema.safeParse(body)
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

      // Get provider ID
      const [provider] = await sql`
        SELECT id FROM providers WHERE user_id = ${user.id}
      `

      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }

      const providerId = provider.id

      // Accept lead with row-level locking to prevent race conditions
      const result = await sql.begin(async (sql) => {
        const [assignment] = await sql`
          SELECT 
            la.id as assignment_id,
            la.status,
            la.lead_id
          FROM lead_assignments la
          JOIN leads l ON la.lead_id = l.id
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

        // Update status to accepted
        await sql`
          UPDATE lead_assignments
          SET 
            status = 'accepted',
            accepted_at = NOW()
          WHERE id = ${assignment.assignment_id}
        `

        return {
          assignment_id: assignment.assignment_id,
          lead_id: assignment.lead_id,
        }
      })

      // Log acceptance action
      await logAction({
        actorId: user.id,
        actorRole: 'provider',
        action: AuditActions.LEAD_ACCEPTED,
        entity: 'lead_assignment',
        entityId: result.assignment_id,
        metadata: {
          lead_id: result.lead_id,
          provider_id: providerId,
        },
      })

      // Optional: Notify admin if configured
      const notifyAdmin = process.env.NOTIFY_ADMIN_ON_PROVIDER_ACCEPT === 'true'
      if (notifyAdmin) {
        try {
          // Get admin emails (simplified - in production, use proper admin notification system)
          const [adminUsers] = await sql`
            SELECT email FROM users WHERE role = 'admin' AND status = 'active' LIMIT 5
          `
          
          // Note: Admin notification template would need to be created
          // For now, we'll skip this as it's optional
        } catch (emailError) {
          console.error('Failed to notify admin:', emailError)
          // Don't fail the request if admin notification fails
        }
      }

      return NextResponse.json({
        ok: true,
        assignment_id: result.assignment_id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
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
      }

      console.error('Error accepting lead:', error)
      return NextResponse.json(
        { error: 'Failed to accept lead' },
        { status: 500 }
      )
    }
  },
  { allowedRoles: ['provider'] }
)

