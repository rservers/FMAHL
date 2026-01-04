export type EmailEventType = 'queued' | 'sent' | 'delivered' | 'opened' | 'bounced' | 'complained' | 'failed'

export interface EmailEventInput {
  email_type: string
  recipient_email: string
  event_type: EmailEventType
  provider?: string
  message_id?: string
  template_id?: string
  related_entity_type?: string
  related_entity_id?: string
  metadata?: Record<string, any>
  error_message?: string
}

export interface EmailEventRecord extends EmailEventInput {
  id: string
  created_at: Date
}

