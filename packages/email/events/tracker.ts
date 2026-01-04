import { sql } from '@findmeahotlead/database/client'
import type { EmailEventInput } from './types'

export async function recordEmailEvent(event: EmailEventInput) {
  try {
    await sql`
      INSERT INTO email_events (
        email_type,
        recipient_email,
        event_type,
        provider,
        message_id,
        template_id,
        related_entity_type,
        related_entity_id,
        metadata,
        error_message
      ) VALUES (
        ${event.email_type},
        ${event.recipient_email},
        ${event.event_type},
        ${event.provider || null},
        ${event.message_id || null},
        ${event.template_id || null},
        ${event.related_entity_type || null},
        ${event.related_entity_id || null},
        ${event.metadata ? JSON.stringify(event.metadata) : null},
        ${event.error_message || null}
      )
    `
  } catch (error) {
    // Do not throw; logging failure should not crash queue
    console.error('Failed to record email event', error)
  }
}

