import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local from project root
config({ path: resolve(__dirname, '../../.env.local') })

import type {
  EmailProvider,
  EmailOptions,
  EmailProviderType,
  SendTemplatedEmailInput,
  PreviewTemplateInput,
  RenderTemplateResult,
} from './types'
import { MailHogProvider } from './providers/mailhog'
import { SESProvider } from './providers/ses'
import { ConsoleProvider } from './providers/console'
import {
  renderTemplate,
  renderTemplateByKey,
  TemplateNotFoundError,
  TemplateVariableError,
} from './templates/renderer'
import { defaultTemplates } from './templates/defaults'
import { enqueueEmail } from './queue/email-queue'

class EmailService {
  private provider: EmailProvider

  constructor() {
    const providerType = (process.env.EMAIL_PROVIDER || 'mailhog') as EmailProviderType

    switch (providerType) {
      case 'ses':
        this.provider = new SESProvider()
        break
      case 'console':
        this.provider = new ConsoleProvider()
        break
      case 'mailhog':
      default:
        this.provider = new MailHogProvider()
        break
    }
  }

  async send(options: EmailOptions) {
    return this.provider.send(options)
  }

  async sendTemplated(options: SendTemplatedEmailInput) {
    const { template, to, variables, relatedEntity, priority } = options
    const rendered = renderTemplateByKey(template, variables)
    // Enqueue for async delivery
    const job = await enqueueEmail({
      template,
      to,
      variables,
      relatedEntity,
      priority,
    })
    return { jobId: job.id }
  }

  async sendNow(options: EmailOptions) {
    return this.provider.send(options)
  }

  async preview(options: PreviewTemplateInput): Promise<RenderTemplateResult> {
    return renderTemplateByKey(options.template, options.variables)
  }
}

export const emailService = new EmailService()
export type {
  EmailOptions,
  EmailProvider,
  EmailProviderType,
  SendTemplatedEmailInput,
  PreviewTemplateInput,
  RenderTemplateResult,
}
export {
  renderTemplate,
  renderTemplateByKey,
  TemplateNotFoundError,
  TemplateVariableError,
  defaultTemplates,
}
