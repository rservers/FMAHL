import { sql } from '../client'
import { defaultTemplates } from '../../email/templates/defaults'

// Seed the default template set for EPIC 10
export async function seedEmailTemplates() {
  for (const tplKey of Object.keys(defaultTemplates)) {
    const tpl = defaultTemplates[tplKey as keyof typeof defaultTemplates]

    await sql`
      INSERT INTO email_templates (
        template_key,
        version,
        subject,
        body_html,
        body_text,
        variables,
        is_active
      ) VALUES (
        ${tpl.key},
        ${tpl.version || 1},
        ${tpl.subject},
        ${tpl.html},
        ${tpl.text || null},
        ${JSON.stringify(tpl.variables.map((v) => v.name))},
        true
      )
      ON CONFLICT (template_key) DO NOTHING
    `
  }
}

