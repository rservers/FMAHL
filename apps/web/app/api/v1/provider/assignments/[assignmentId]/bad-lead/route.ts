/**
 * POST /api/v1/provider/assignments/:assignmentId/bad-lead
 * 
 * Provider reports a bad lead for an assignment
 * 
 * @see .cursor/docs/Delivery/Epic_09_Bad_Lead_Refunds.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { reportBadLeadSchema } from '@/lib/validations/bad-leads'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { RateLimits, checkRateLimit } from '@/lib/middleware/rate-limit'
import { getRedis } from '@/lib/redis'
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

  return withAuth(request, async (user) => {
    try {
      // Parse request body
      const body = await request.json()
      const validationResult = reportBadLeadSchema.safeParse(body)
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

      const { reason_category, reason_notes } = validationResult.data

      // Get provider ID
      const [provider] = await sql`
        SELECT id FROM providers WHERE user_id = ${user.id}
      `

      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }

      const providerId = provider.id

      // Check daily report limit
      const redis = getRedis()
      const today = new Date().toISOString().split('T')[0]
      const rateLimitKey = `${RateLimits.BAD_LEAD_REPORT.keyPrefix}:${providerId}:${today}`
      
      const rateLimitResult = await checkRateLimit(
        rateLimitKey,
        RateLimits.BAD_LEAD_REPORT
      )

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            error: 'Report limit exceeded',
            limit: RateLimits.BAD_LEAD_REPORT.limit,
            remaining: rateLimitResult.remaining,
            reset_at: new Date(rateLimitResult.resetAt * 1000).toISOString(),
          },
          { status: 429 }
        )
      }

      // Process report with idempotency check
      const result = await sql.begin(async (sql) => {
        // Get assignment with row-level lock
        const [assignment] = await sql`
          SELECT 
            la.id,
            la.lead_id,
            la.provider_id,
            la.bad_lead_reported_at,
            la.bad_lead_status,
            la.refunded_at,
            l.niche_id,
            n.name as niche_name
          FROM lead_assignments la
          JOIN leads l ON la.lead_id = l.id
          JOIN niches n ON l.niche_id = n.id
          WHERE la.id = ${assignmentId}
            AND la.provider_id = ${providerId}
            AND l.deleted_at IS NULL
          FOR UPDATE
        `

        if (!assignment) {
          throw new Error('Assignment not found')
        }

        // Idempotency: If already pending, return existing state
        if (assignment.bad_lead_reported_at && assignment.bad_lead_status === 'pending') {
          return {
            assignment_id: assignment.id,
            bad_lead_status: 'pending',
            bad_lead_reported_at: assignment.bad_lead_reported_at.toISOString(),
            is_existing: true,
          }
        }

        // If already resolved, return conflict
        if (assignment.bad_lead_status === 'approved' || assignment.bad_lead_status === 'rejected') {
          throw new Error('Already resolved')
        }

        // If already refunded, cannot report
        if (assignment.refunded_at) {
          throw new Error('Assignment already refunded')
        }

        // Update assignment with bad lead report
        await sql`
          UPDATE lead_assignments
          SET 
            bad_lead_reported_at = NOW(),
            bad_lead_status = 'pending',
            bad_lead_reason_category = ${reason_category},
            bad_lead_reason_notes = ${reason_notes || null}
          WHERE id = ${assignmentId}
        `

        return {
          assignment_id: assignment.id,
          bad_lead_status: 'pending',
          bad_lead_reported_at: new Date().toISOString(),
          is_existing: false,
          niche_name: assignment.niche_name,
        }
      })

      // Log audit action
      await logAction({
        actorId: user.id,
        actorRole: 'provider',
        action: AuditActions.BAD_LEAD_REPORTED,
        entity: 'lead_assignment',
        entityId: assignmentId,
        metadata: {
          assignment_id: assignmentId,
          reason_category,
          reason_notes: reason_notes || null,
        },
      })

      // Send confirmation email (optional)
      try {
        const [providerInfo] = await sql`
          SELECT 
            u.email,
            u.first_name || ' ' || u.last_name as provider_name
          FROM providers p
          JOIN users u ON p.user_id = u.id
          WHERE p.id = ${providerId}
        `

        await emailService.sendTemplated({
          template: 'bad_lead_reported_confirmation',
          to: providerInfo.email,
          variables: {
            provider_name: providerInfo.provider_name || providerInfo.email,
            lead_id: result.assignment_id,
            niche_name: result.niche_name,
            reported_at: result.bad_lead_reported_at,
          },
          relatedEntity: {
            type: 'lead_assignment',
            id: assignmentId,
          },
          priority: 'normal',
        })
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError)
        // Don't fail the request if email fails
      }

      return NextResponse.json({
        ok: true,
        assignment_id: result.assignment_id,
        bad_lead_status: result.bad_lead_status,
        bad_lead_reported_at: result.bad_lead_reported_at,
      }, { status: result.is_existing ? 200 : 201 })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Already resolved') || error.message.includes('already refunded')) {
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

      console.error('Error reporting bad lead:', error)
      return NextResponse.json(
        { error: 'Failed to report bad lead' },
        { status: 500 }
      )
    }
  }, { allowedRoles: ['provider'] })
}

