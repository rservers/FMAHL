import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { emailEventsQuerySchema } from '@/lib/validations/email'
import { sql } from '@/lib/db'

/**
 * GET /api/v1/admin/email-events
 *
 * Lists email events with pagination and filters.
 */
export const GET = adminWithMFA(async (request: NextRequest) => {
  const url = new URL(request.url)
  const queryParams = Object.fromEntries(url.searchParams)
  const parsed = emailEventsQuerySchema.safeParse(queryParams)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { page, limit, email_type, recipient_email, event_type } = parsed.data
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []

  if (email_type) {
    conditions.push(`email_type = $${params.length + 1}`)
    params.push(email_type)
  }
  if (recipient_email) {
    conditions.push(`recipient_email = $${params.length + 1}`)
    params.push(recipient_email)
  }
  if (event_type) {
    conditions.push(`event_type = $${params.length + 1}`)
    params.push(event_type)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [countRow] = await sql.unsafe(
    `SELECT COUNT(*) as total FROM email_events ${whereClause}`,
    params
  )
  const total = parseInt(countRow?.total || '0', 10)

  const rows = await sql.unsafe(
    `
      SELECT id, email_type, recipient_email, event_type, provider, message_id, template_id,
             related_entity_type, related_entity_id, metadata, error_message, created_at
      FROM email_events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  )

  return NextResponse.json({
    events: rows,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  })
})

