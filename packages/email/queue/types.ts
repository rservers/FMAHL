import type { TemplateKey } from '../types'

export type EmailPriority = 'high' | 'normal' | 'low'

export interface EmailJobData {
  template: TemplateKey
  to: string | string[]
  variables: Record<string, any>
  relatedEntity?: { type: string; id: string }
  priority?: EmailPriority
}

export interface EmailJobResult {
  success: boolean
  messageId?: string
  provider?: string
  error?: string
}

