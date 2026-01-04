/**
 * POST /api/v1/admin/leads/:id/distribute
 * 
 * Manually trigger distribution for an approved lead.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { distributeLeadRequestSchema } from '@/lib/validations/distribution'
import { sql } from '@/lib/db'
import { createDistributionQueue } from '@/lib/queues/distribution'

export const POST = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const distributeIndex = pathParts.indexOf('distribute')
    const id = distributeIndex > 0 ? pathParts[distributeIndex - 1] : null

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 })
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const validationResult = distributeLeadRequestSchema.safeParse(body)
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

    // Verify lead exists and is approved
    const [lead] = await sql`
      SELECT id, status, niche_id
      FROM leads
      WHERE id = ${id}
        AND deleted_at IS NULL
    `

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    if (lead.status !== 'approved') {
      return NextResponse.json(
        { error: `Lead is not approved (status: ${lead.status})` },
        { status: 400 }
      )
    }

    // Queue distribution job
    const queue = createDistributionQueue()
    const job = await queue.add('distribute', {
      leadId: id,
      triggeredBy: {
        actorId: user.id,
        actorRole: 'admin',
      },
      requestedAt: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        lead_id: id,
        status: 'queued',
        job_id: job.id,
        message: 'Distribution job queued successfully',
      },
      { status: 202 }
    )
  } catch (error) {
    console.error('Error queuing distribution:', error)
    return NextResponse.json(
      { error: 'Failed to queue distribution job' },
      { status: 500 }
    )
  }
})

