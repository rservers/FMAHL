/**
 * GET /api/v1/admin/queues/dlq
 * 
 * List dead letter queue entries
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { listDLQEntries } from '@/lib/services/dlq'
import { z } from 'zod'

const dlqListQuerySchema = z.object({
  queue: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
}).strict()

export async function GET(request: NextRequest) {
  return adminWithMFA(async (req) => {
    try {
      const url = new URL(request.url)
      const queryParams = {
        queue: url.searchParams.get('queue') || undefined,
        page: url.searchParams.get('page') || undefined,
        limit: url.searchParams.get('limit') || undefined,
      }

      const validationResult = dlqListQuerySchema.safeParse(queryParams)
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

      const { queue, page, limit } = validationResult.data

      const response = await listDLQEntries({
        queue,
        page,
        limit,
      })

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error listing DLQ entries:', error)
      return NextResponse.json(
        { error: 'Failed to list DLQ entries' },
        { status: 500 }
      )
    }
  })(request)
}

