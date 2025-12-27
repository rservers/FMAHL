import nodemailer from 'nodemailer'
import type { EmailProvider, EmailOptions } from '../types'

export class MailHogProvider implements EmailProvider {
  private transporter: nodemailer.Transporter

  constructor() {
    const host = process.env.MAILHOG_HOST || 'localhost'
    const port = parseInt(process.env.MAILHOG_PORT || '1025', 10)

    this.transporter = nodemailer.createTransport({
      host,
      port,
      ignoreTLS: true,
    })

    console.log(`📧 MailHog initialized (${host}:${port})`)
    console.log(`📬 View emails at: http://localhost:8025`)
  }

  async send(options: EmailOptions) {
    try {
      const fromName = process.env.EMAIL_FROM_NAME || 'Find Me A Hot Lead'
      const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@findmeahotlead.com'
      const from = options.from || `"${fromName}" <${fromAddress}>`

      const info = await this.transporter.sendMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
      })

      console.log('✅ Email sent:', options.subject)
      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('❌ Email error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
