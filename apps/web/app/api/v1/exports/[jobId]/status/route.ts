/**
 * GET /api/v1/exports/:jobId/status
 * 
 * Check status of export job
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { sql } from '@/lib/db'
import type { ExportJobStatus } from '@/lib/types/reports'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { jobId } = await context.params

      // Get job status
      const [job] = await sql`
        SELECT 
          id,
          status,
          created_at,
          updated_at,
          row_count,
          artifact_path,
          download_expires_at,
          error,
          requested_by
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

      // Generate download URL if completed
      let downloadUrl = null
      if (job.status === 'completed' && job.artifact_path) {
        const expiresAt = new Date(job.download_expires_at)
        if (expiresAt > new Date()) {
          downloadUrl = `/api/v1/exports/${jobId}/download`
        }
      }

      const response: ExportJobStatus = {
        job_id: job.id,
        status: job.status,
        created_at: job.created_at.toISOString(),
        completed_at: job.status === 'completed' ? job.updated_at.toISOString() : null,
        row_count: job.row_count,
        download_url: downloadUrl,
        expires_at: job.download_expires_at ? job.download_expires_at.toISOString() : null,
        error: job.error,
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching export status:', error)
      return NextResponse.json(
        { error: 'Failed to fetch export status' },
        { status: 500 }
      )
    }
  }, { allowedRoles: ['admin', 'provider'] })
}

