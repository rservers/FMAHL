/**
 * GET /api/v1/admin/leads/stats
 * 
 * Get lead review queue statistics.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_03_Admin_Lead_Review_Approval.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { sql } from '@/lib/db'

export const GET = adminWithMFA(async (request: NextRequest) => {
  try {
    // Count pending_approval leads
    const [pendingCount] = await sql`
      SELECT COUNT(*) as count
      FROM leads
      WHERE status = 'pending_approval'
    `

    // Count approved today
    const [approvedToday] = await sql`
      SELECT COUNT(*) as count
      FROM leads
      WHERE status = 'approved'
        AND approved_at >= CURRENT_DATE
    `

    // Count rejected today
    const [rejectedToday] = await sql`
      SELECT COUNT(*) as count
      FROM leads
      WHERE status = 'rejected'
        AND rejected_at >= CURRENT_DATE
    `

    // Calculate average queue time (hours) for approved leads
    const [avgQueueTime] = await sql`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (approved_at - confirmed_at)) / 3600) as avg_hours
      FROM leads
      WHERE status = 'approved'
        AND approved_at IS NOT NULL
        AND confirmed_at IS NOT NULL
    `

    // Find oldest pending lead age (hours)
    const [oldestPending] = await sql`
      SELECT 
        EXTRACT(EPOCH FROM (NOW() - confirmed_at)) / 3600 as age_hours
      FROM leads
      WHERE status = 'pending_approval'
        AND confirmed_at IS NOT NULL
      ORDER BY confirmed_at ASC
      LIMIT 1
    `

    return NextResponse.json({
      pending_approval_count: Number(pendingCount.count),
      approved_today: Number(approvedToday.count),
      rejected_today: Number(rejectedToday.count),
      average_queue_time_hours: avgQueueTime.avg_hours
        ? Number(Number(avgQueueTime.avg_hours).toFixed(2))
        : 0,
      oldest_pending_age_hours: oldestPending
        ? Number(Number(oldestPending.age_hours).toFixed(2))
        : 0,
    })

  } catch (error: any) {
    console.error('Lead stats error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

