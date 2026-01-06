/**
 * POST /api/v1/provider/reports/export
 * 
 * Request async export of provider reports
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { checkRateLimit, RateLimits } from '@/lib/middleware/rate-limit'
import { exportJobRequestSchema } from '@/lib/validations/reports'
import { sql } from '@/lib/db'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'

export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      // Check rate limit
      const rateLimitResult = await checkRateLimit(
        user.id,
        RateLimits.REPORT_EXPORT_PROVIDER
      )

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            retry_after: rateLimitResult.retryAfter 
          },
          { status: 429 }
        )
      }

      // Parse and validate request body
      const body = await request.json()
      const validationResult = exportJobRequestSchema.safeParse(body)
      
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

      const { scope, type, filters, format } = validationResult.data

      // Enforce provider scope
      if (scope !== 'provider') {
        return NextResponse.json(
          { error: 'Providers can only export provider-scoped reports' },
          { status: 403 }
        )
      }

      // Create export job record
      const [job] = await sql`
        INSERT INTO report_export_jobs (
          requested_by,
          actor_role,
          scope,
          type,
          filters,
          format,
          status
        ) VALUES (
          ${user.id},
          'provider',
          ${scope},
          ${type},
          ${JSON.stringify(filters)},
          ${format},
          'pending'
        )
        RETURNING id, created_at
      `

      // Enqueue export job (using dynamic import to avoid worker dependency)
      const { getQueue } = await import('@/lib/queue')
      const queue = getQueue('report-export')
      await queue.add('export', {
        job_id: job.id,
        requested_by: user.id,
        actor_role: 'provider',
        scope,
        type,
        filters,
        format,
      })

      // Log audit event
      await logAudit({
        action: AuditActions.REPORT_EXPORT_REQUESTED,
        actorId: user.id,
        actorRole: 'provider',
        entity: 'report_export_job',
        entityId: job.id,
        metadata: { scope, type, format },
      })

      return NextResponse.json({
        job_id: job.id,
        status: 'pending',
        created_at: job.created_at,
      }, { status: 202 })
    } catch (error) {
      console.error('Error creating export job:', error)
      return NextResponse.json(
        { error: 'Failed to create export job' },
        { status: 500 }
      )
    }
  }, { allowedRoles: ['provider'] })
}

