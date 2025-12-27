import type { EmailProvider, EmailOptions } from '../types'

export class ConsoleProvider implements EmailProvider {
  constructor() {
    console.log('📧 Console email provider (logs only)')
  }

  async send(options: EmailOptions) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📧 EMAIL (Not Actually Sent)')
    console.log('To:', options.to)
    console.log('Subject:', options.subject)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(options.html)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    return { success: true, messageId: `console-${Date.now()}` }
  }
}
