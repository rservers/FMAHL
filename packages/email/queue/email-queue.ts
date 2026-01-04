import { Queue } from 'bullmq'
import { config } from 'dotenv'
import { resolve } from 'path'
import { EmailJobData, EmailJobResult } from './types'
import { recordEmailEvent } from '../events/tracker'

// Load env from project root
config({ path: resolve(__dirname, '../../.env.local') })

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const redisUrl = new URL(REDIS_URL)

const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
  password: redisUrl.password || undefined,
}

const EMAIL_QUEUE_NAME = 'email_send'
type EmailJobName = 'send-email'

export const emailQueue = new Queue<EmailJobData, EmailJobResult, EmailJobName>(EMAIL_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s -> 5s -> 25s
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
})

// QueueScheduler handles stalled jobs and delayed jobs
export async function enqueueEmail(data: EmailJobData) {
  const job = await emailQueue.add('send-email' as EmailJobName, data, {
    priority: data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5,
  })

  // Track queued event
  await recordEmailEvent({
    email_type: data.template,
    recipient_email: Array.isArray(data.to) ? data.to.join(',') : data.to,
    event_type: 'queued',
    provider: process.env.EMAIL_PROVIDER || 'mailhog',
    related_entity_type: data.relatedEntity?.type,
    related_entity_id: data.relatedEntity?.id,
    metadata: { jobId: job.id },
  })

  return job
}

