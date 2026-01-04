import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { emailTemplateUpdateSchema } from '@/lib/validations/email'
import { sql } from '@/lib/db'

/**
 * GET /api/v1/admin/email-templates/:id
 * PUT /api/v1/admin/email-templates/:id
 * DELETE /api/v1/admin/email-templates/:id  (deactivate)
 *
 * EPIC 10: Notifications & Email
 */
export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const params = await context.params
  return adminWithMFA(async () => {
    const { id } = params

    const [template] = await sql`
      SELECT id, template_key, version, subject, body_html, body_text, variables, is_active, created_at, updated_at
      FROM email_templates
      WHERE id = ${id}
    `

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json(template)
  })(request)
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const params = await context.params
  return adminWithMFA(async (req) => {
    try {
      const body = await req.json()
      const parsed = emailTemplateUpdateSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid payload', details: parsed.error.issues },
          { status: 400 }
        )
      }

      const fields = parsed.data

      const updates: string[] = []
      const values: any[] = []

      if (fields.subject !== undefined) {
        updates.push(`subject = $${updates.length + 1}`)
        values.push(fields.subject)
      }
      if (fields.body_html !== undefined) {
        updates.push(`body_html = $${updates.length + 1}`)
        values.push(fields.body_html)
      }
      if (fields.body_text !== undefined) {
        updates.push(`body_text = $${updates.length + 1}`)
        values.push(fields.body_text)
      }
      if (fields.variables !== undefined) {
        updates.push(`variables = $${updates.length + 1}`)
        values.push(JSON.stringify(fields.variables))
      }
      if (fields.is_active !== undefined) {
        updates.push(`is_active = $${updates.length + 1}`)
        values.push(fields.is_active)
      }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
      }

      // Increment version on each update
      updates.push(`version = version + 1`)

      const query = `
        UPDATE email_templates
        SET ${updates.join(', ')},
            updated_at = NOW()
        WHERE id = $${updates.length + 1}
        RETURNING id, template_key, version, subject, body_html, body_text, variables, is_active, created_at, updated_at
      `

      const [updated] = await sql.unsafe(query, [...values, params.id])

      if (!updated) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      return NextResponse.json(updated)
    } catch (error: any) {
      console.error('Update email template error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })(request)
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const params = await context.params
  return adminWithMFA(async () => {
    const { id } = params

    const [updated] = await sql`
      UPDATE email_templates
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, template_key, version, subject, body_html, body_text, variables, is_active, created_at, updated_at
    `

    if (!updated) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  })(request)
}

