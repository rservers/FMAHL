/**
 * POST /api/v1/admin/reports/export
 * 
 * Request async export of admin reports
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { exportJobRequestSchema } from '@/lib/validations/reports'
import { sql } from '@/lib/db'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'

export async function POST(request: NextRequest) {
  return adminWithMFA(async (request, user) => {
    try {
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
          'admin',
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
        actor_role: 'admin',
        scope,
        type,
        filters,
        format,
      })

      // Log audit event
      await logAudit({
        action: AuditActions.REPORT_EXPORT_REQUESTED,
        actorId: user.id,
        actorRole: 'admin',
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
  })(request)
}

