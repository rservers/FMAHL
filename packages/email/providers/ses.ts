import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import type { EmailProvider, EmailOptions } from '../types'

export class SESProvider implements EmailProvider {
  private client: SESClient

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1'
    
    this.client = new SESClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || '',
      },
    })

    console.log(`📧 Amazon SES initialized (${region})`)
  }

  async send(options: EmailOptions) {
    try {
      const fromName = process.env.EMAIL_FROM_NAME || 'Find Me A Hot Lead'
      const fromAddress = process.env.AWS_SES_FROM_EMAIL || 'noreply@findmeahotlead.com'
      const from = options.from || `"${fromName}" <${fromAddress}>`

      const command = new SendEmailCommand({
        Source: from,
        Destination: {
          ToAddresses: Array.isArray(options.to) ? options.to : [options.to],
        },
        Message: {
          Subject: { Data: options.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: options.html, Charset: 'UTF-8' },
            Text: options.text ? { Data: options.text, Charset: 'UTF-8' } : undefined,
          },
        },
        ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
      })

      const response = await this.client.send(command)
      console.log('✅ Email sent via SES:', options.subject)
      return { success: true, messageId: response.MessageId }
    } catch (error) {
      console.error('❌ SES error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
