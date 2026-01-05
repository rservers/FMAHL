/**
 * GET /api/v1/exports/:jobId/download
 * 
 * Download export file
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { sql } from '@/lib/db'
import { getRedis } from '@/lib/redis'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { jobId } = await context.params

      // Get job details
      const [job] = await sql`
        SELECT 
          id,
          status,
          artifact_path,
          download_expires_at,
          format,
          requested_by,
          type
        FROM report_export_jobs
        WHERE id = ${jobId}
      `

      if (!job) {
        return NextResponse.json(
          { error: 'Export job not found' },
          { status: 404 }
        )
      }

      // Check authorization
      if (job.requested_by !== user.id && user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }

      // Check if completed
      if (job.status !== 'completed') {
        return NextResponse.json(
          { error: 'Export not yet completed' },
          { status: 400 }
        )
      }

      // Check if expired
      const expiresAt = new Date(job.download_expires_at)
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Download link has expired' },
          { status: 410 }
        )
      }

      // Retrieve file from storage
      const redis = getRedis()
      const content = await redis.get(job.artifact_path)

      if (!content) {
        return NextResponse.json(
          { error: 'Export file not found or expired' },
          { status: 404 }
        )
      }

      // Log audit event
      await logAudit({
        action: AuditActions.REPORT_EXPORT_DOWNLOADED,
        actorId: user.id,
        actorRole: user.role,
        entity: 'report_export_job',
        entityId: job.id,
        metadata: { type: job.type },
      })

      // Return file
      const filename = `export-${job.type}-${jobId}.${job.format}`
      
      return new NextResponse(content, {
        status: 200,
        headers: {
          'Content-Type': job.format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (error) {
      console.error('Error downloading export:', error)
      return NextResponse.json(
        { error: 'Failed to download export' },
        { status: 500 }
      )
    }
  }, { allowedRoles: ['admin', 'provider'] })
}

