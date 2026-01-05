/**
 * GET /api/v1/admin/queues
 * 
 * Queue monitoring endpoint - returns status for all queues
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { getQueueStatuses } from '@/lib/services/queue-monitor'
import type { QueuesResponse } from '@/lib/types/observability'

export async function GET(request: NextRequest) {
  return adminWithMFA(async (req) => {
    try {
      const queues = await getQueueStatuses()

      const response: QueuesResponse = {
        queues,
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching queue status:', error)
      return NextResponse.json(
        { error: 'Failed to fetch queue status' },
        { status: 500 }
      )
    }
  })(request)
}

