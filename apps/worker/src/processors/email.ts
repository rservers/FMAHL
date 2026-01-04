import { Worker } from 'bullmq'
import { config } from 'dotenv'
import { resolve } from 'path'
import { EmailJobData, EmailJobResult } from '@findmeahotlead/email/queue/types'
import { renderTemplateByKey } from '@findmeahotlead/email'
import { emailService } from '@findmeahotlead/email'
import { recordEmailEvent } from '@findmeahotlead/email/events/tracker'

// Load env
config({ path: resolve(__dirname, '../../../../.env.local') })

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const redisUrl = new URL(REDIS_URL)

const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
  password: redisUrl.password || undefined,
}

const EMAIL_QUEUE_NAME = 'email_send'
type EmailJobName = 'send-email'

export const emailWorker = new Worker<EmailJobData, EmailJobResult, EmailJobName>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    const { template, to, variables } = job.data

    // Track queued already handled at enqueue; mark sent/failed here

    // Render template
    const rendered = renderTemplateByKey(template, variables)

    // Send email
    const result = await emailService.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })

    if (!result.success) {
      await recordEmailEvent({
        email_type: template,
        recipient_email: Array.isArray(to) ? to.join(',') : to,
        event_type: 'failed',
        provider: process.env.EMAIL_PROVIDER || 'mailhog',
        error_message: result.error,
        metadata: { jobId: job.id },
      })
      throw new Error(result.error || 'Email send failed')
    }

    await recordEmailEvent({
      email_type: template,
      recipient_email: Array.isArray(to) ? to.join(',') : to,
      event_type: 'sent',
      provider: process.env.EMAIL_PROVIDER || 'mailhog',
      message_id: result.messageId,
      metadata: { jobId: job.id },
    })

    return {
      success: true,
      messageId: result.messageId,
      provider: process.env.EMAIL_PROVIDER || 'mailhog',
    }
  },
  {
    connection,
    concurrency: 10,
  }
)

emailWorker.on('completed', (job, result) => {
  console.log(`✅ Email job ${job.id} completed`, result)
})

emailWorker.on('failed', (job, err) => {
  console.error(`❌ Email job ${job?.id} failed:`, err)
})

