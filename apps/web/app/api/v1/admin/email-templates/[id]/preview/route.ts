import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { emailTemplatePreviewSchema } from '@/lib/validations/email'
import { sql } from '@/lib/db'
import { renderTemplate } from '@findmeahotlead/email'

/**
 * POST /api/v1/admin/email-templates/:id/preview
 *
 * Renders a template with provided variables without sending.
 */
export async function POST(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const params = await context.params
  return adminWithMFA(async (req) => {
    try {
      const body = await req.json()
      const parsed = emailTemplatePreviewSchema.safeParse(body)

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid payload', details: parsed.error.issues },
          { status: 400 }
        )
      }

      const { variables } = parsed.data

      const [template] = await sql`
        SELECT id, template_key, version, subject, body_html, body_text, variables
        FROM email_templates
        WHERE id = ${params.id}
      `

      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      const templateDef = {
        key: template.template_key,
        subject: template.subject,
        html: template.body_html,
        text: template.body_text || undefined,
        variables: Array.isArray(template.variables)
          ? template.variables.map((name: string) => ({ name, required: true }))
          : [],
        version: template.version,
      }

      const rendered = renderTemplate({ template: templateDef, variables })

      return NextResponse.json(rendered)
    } catch (error: any) {
      console.error('Preview email template error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })(request)
}

