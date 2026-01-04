import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { emailTemplateCreateSchema, emailTemplatesQuerySchema } from '@/lib/validations/email'
import { sql } from '@/lib/db'

/**
 * GET /api/v1/admin/email-templates
 * POST /api/v1/admin/email-templates
 *
 * EPIC 10: Notifications & Email
 * See: .cursor/docs/Delivery/Epic_10_Notifications_Email.md
 */
export const GET = adminWithMFA(async (request: NextRequest) => {
  const url = new URL(request.url)
  const queryParams = Object.fromEntries(url.searchParams)
  const parsed = emailTemplatesQuerySchema.safeParse(queryParams)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { page, limit, template_key, is_active } = parsed.data
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []

  if (template_key) {
    conditions.push(`template_key = $${params.length + 1}`)
    params.push(template_key)
  }

  if (is_active !== undefined) {
    conditions.push(`is_active = $${params.length + 1}`)
    params.push(is_active)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [countRow] = await sql.unsafe(
    `SELECT COUNT(*) as total FROM email_templates ${whereClause}`,
    params
  )
  const total = parseInt(countRow?.total || '0', 10)

  const rows = await sql.unsafe(
    `
      SELECT id, template_key, version, subject, body_html, body_text, variables, is_active, created_at, updated_at
      FROM email_templates
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  )

  return NextResponse.json({
    templates: rows,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  })
})

export const POST = adminWithMFA(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const parsed = emailTemplateCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { template_key, subject, body_html, body_text, variables, is_active } = parsed.data

    const [row] = await sql`
      INSERT INTO email_templates (
        template_key,
        subject,
        body_html,
        body_text,
        variables,
        is_active
      ) VALUES (
        ${template_key},
        ${subject},
        ${body_html},
        ${body_text || null},
        ${JSON.stringify(variables)},
        ${is_active ?? true}
      )
      ON CONFLICT (template_key) DO NOTHING
      RETURNING id, template_key, version, subject, body_html, body_text, variables, is_active, created_at, updated_at
    `

    if (!row) {
      return NextResponse.json(
        { error: 'Template key already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(row, { status: 201 })
  } catch (error: any) {
    console.error('Create email template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

