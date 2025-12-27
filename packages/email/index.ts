import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local from project root
config({ path: resolve(__dirname, '../../.env.local') })

import type { EmailProvider, EmailOptions, EmailProviderType } from './types'
import { MailHogProvider } from './providers/mailhog'
import { SESProvider } from './providers/ses'
import { ConsoleProvider } from './providers/console'

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
}

export const emailService = new EmailService()
export type { EmailOptions, EmailProvider, EmailProviderType }
