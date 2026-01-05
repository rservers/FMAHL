/**
 * POST /api/v1/admin/queues/dlq/:id/retry
 * 
 * Retry a failed job from DLQ
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { retryDLQJob } from '@/lib/services/dlq'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'
import type { RetryResponse } from '@/lib/types/observability'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return adminWithMFA(async (req, user) => {
    try {
      const { id } = await context.params

      const result = await retryDLQJob(id)

      // Log audit event
      await logAudit({
        action: AuditActions.DLQ_JOB_RETRIED,
        actorId: user.id,
        actorRole: 'admin',
        entity: 'dead_letter_queue',
        entityId: id,
        metadata: { new_job_id: result.job_id },
      })

      const response: RetryResponse = {
        ok: true,
        job_id: result.job_id,
        message: 'Job re-enqueued successfully',
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error retrying DLQ job:', error)
      
      if (error instanceof Error) {
        if (error.message === 'DLQ entry not found') {
          return NextResponse.json(
            { error: 'DLQ entry not found' },
            { status: 404 }
          )
        }
        if (error.message === 'DLQ entry already resolved') {
          return NextResponse.json(
            { error: 'DLQ entry already resolved' },
            { status: 400 }
          )
        }
      }

      return NextResponse.json(
        { error: 'Failed to retry job' },
        { status: 500 }
      )
    }
  })(request)
}

