/**
 * GET /api/v1/admin/leads/:id/distribution-status
 * 
 * Get distribution status for a lead.
 * 
 * Requires: Admin role
 * 
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { sql } from '@/lib/db'
import { createDistributionQueue } from '@/lib/queues/distribution'
import type { DistributionStatusResponse } from '@/lib/types/distribution'

export const GET = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const statusIndex = pathParts.indexOf('distribution-status')
    const id = statusIndex > 0 ? pathParts[statusIndex - 1] : null

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 })
    }

    // Get lead info
    const [lead] = await sql`
      SELECT 
        id,
        status,
        distributed_at,
        distribution_attempts
      FROM leads
      WHERE id = ${id}
        AND deleted_at IS NULL
    `

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Get assignment count
    const [assignmentCount] = await sql`
      SELECT COUNT(*)::int as count
      FROM lead_assignments
      WHERE lead_id = ${id}
    `

    // Get start level order position from audit log (if available)
    const [distributionLog] = await sql`
      SELECT metadata->>'start_level_order_position' as start_level_order_position
      FROM audit_log
      WHERE entity = 'lead'
        AND entity_id = ${id}
        AND action = 'distribution.completed'
      ORDER BY created_at DESC
      LIMIT 1
    `

    // Check job queue status
    const queue = createDistributionQueue()
    const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 10)
    const leadJob = jobs.find((job) => job.data.leadId === id)

    let lastAttemptStatus: DistributionStatusResponse['lastAttemptStatus'] = 'none'
    let lastAttemptAt: string | null = null

    if (leadJob) {
      const jobState = await leadJob.getState()
      if (jobState === 'completed') {
        lastAttemptStatus = 'success'
        lastAttemptAt = leadJob.finishedOn ? new Date(leadJob.finishedOn).toISOString() : null
      } else if (jobState === 'failed') {
        lastAttemptStatus = 'failed'
        lastAttemptAt = leadJob.processedOn ? new Date(leadJob.processedOn).toISOString() : null
      } else if (jobState === 'active') {
        lastAttemptStatus = 'processing'
        lastAttemptAt = leadJob.processedOn ? new Date(leadJob.processedOn).toISOString() : null
      } else {
        lastAttemptStatus = 'queued'
        lastAttemptAt = leadJob.timestamp ? new Date(leadJob.timestamp).toISOString() : null
      }
    } else if (lead.distributed_at) {
      // No active job but lead was distributed
      lastAttemptStatus = 'success'
      lastAttemptAt = lead.distributed_at.toISOString()
    }

    const response: DistributionStatusResponse = {
      leadId: id,
      leadStatus: lead.status,
      lastAttemptAt,
      lastAttemptStatus,
      assignmentsCreated: assignmentCount?.count || 0,
      startLevelOrderPosition: distributionLog?.start_level_order_position
        ? parseInt(distributionLog.start_level_order_position, 10)
        : null,
      notes:
        lead.distribution_attempts > 0
          ? `Distribution attempted ${lead.distribution_attempts} time(s)`
          : undefined,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting distribution status:', error)
    return NextResponse.json({ error: 'Failed to get distribution status' }, { status: 500 })
  }
})

