/**
 * PATCH /api/v1/admin/subscription-filter-logs/:id/memo
 * 
 * Update admin memo on a filter log entry.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { z } from 'zod'
import { updateFilterMemo } from '@/lib/services/filter-log'
import { sql } from '@/lib/db'

const updateMemoSchema = z.object({
  memo: z.string().max(1000, 'Memo must be 1000 characters or less'),
})

export const PATCH = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract log ID from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const logIdIndex = pathParts.indexOf('subscription-filter-logs')
    const logId = logIdIndex >= 0 && pathParts[logIdIndex + 1]
      ? pathParts[logIdIndex + 1]
      : null

    if (!logId) {
      return NextResponse.json({ error: 'Log ID is required' }, { status: 400 })
    }

    // Verify log exists
    const [logEntry] = await sql`
      SELECT id FROM subscription_filter_logs WHERE id = ${logId}
    `

    if (!logEntry) {
      return NextResponse.json({ error: 'Filter log not found' }, { status: 404 })
    }

    // Validate request body
    const body = await request.json()
    const validationResult = updateMemoSchema.safeParse(body)
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

    const { memo } = validationResult.data

    // Update memo
    await updateFilterMemo(logId, user.id, memo)

    return NextResponse.json({
      success: true,
      log_id: logId,
      memo,
      updated_at: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Update filter memo error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

