export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

export interface EmailProvider {
  send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }>
}

export type EmailProviderType = 'mailhog' | 'ses' | 'console'

// ========================
// Template & Rendering
// ========================

export type TemplateKey =
  | 'email_verification'
  | 'password_reset'
  | 'lead_confirmation'
  | 'lead_confirmation_expired'
  | 'provider_new_lead'
  | 'provider_low_balance'
  | 'bad_lead_approved'
  | 'bad_lead_rejected'
  | 'admin_lead_pending'
  | 'lead_approved'
  | 'lead_rejected'
  | 'subscription_deactivated'
  | 'subscription_reactivated'

export interface TemplateVariable {
  name: string
  required?: boolean
  description?: string
  example?: string
}

export interface TemplateDefinition {
  key: TemplateKey
  subject: string
  html: string
  text?: string
  variables: TemplateVariable[]
  version?: number
}

export interface RenderTemplateInput {
  template: TemplateDefinition
  variables: Record<string, any>
}

export interface RenderTemplateResult {
  subject: string
  html: string
  text?: string
}

// ========================
// Service inputs
// ========================

export interface SendTemplatedEmailInput {
  template: TemplateKey
  to: string | string[]
  variables: Record<string, any>
  relatedEntity?: { type: string; id: string }
  priority?: 'high' | 'normal' | 'low'
}

export interface PreviewTemplateInput {
  template: TemplateKey
  variables: Record<string, any>
}
