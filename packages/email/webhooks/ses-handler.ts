import crypto from 'crypto'
import https from 'https'
import { recordEmailEvent } from '@findmeahotlead/email/events/tracker'
import type { SNSMessage, SESEvent } from './types'
import { sql } from '@findmeahotlead/database/client'

const EXPECTED_TOPIC_ARN = process.env.SES_SNS_TOPIC_ARN

// Build the canonical string per SNS signing doc
function buildStringToSign(message: SNSMessage): string {
  const lines: string[] = []
  const push = (k: string, v?: string) => {
    if (v !== undefined) {
      lines.push(k)
      lines.push(v)
    }
  }

  // Order matters
  push('Message', message.Message)
  push('MessageId', message.MessageId)
  if (message.Subject) {
    push('Subject', message.Subject)
  }
  push('Timestamp', message.Timestamp)
  push('TopicArn', message.TopicArn)
  push('Type', message.Type)
  return lines.join('\n')
}

async function fetchCert(signingCertUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(signingCertUrl, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (d) => chunks.push(d))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      .on('error', (err) => reject(err))
  })
}

async function verifySignature(message: SNSMessage) {
  const stringToSign = buildStringToSign(message)
  const cert = await fetchCert(message.SigningCertURL)
  const verifier = crypto.createVerify('RSA-SHA1')
  verifier.update(stringToSign, 'utf8')
  return verifier.verify(cert, message.Signature, 'base64')
}

async function isDuplicateMessage(messageId: string): Promise<boolean> {
  const existing = await sql`
    SELECT 1 FROM email_events WHERE message_id = ${messageId} LIMIT 1
  `
  return existing.length > 0
}

function mapEvent(event: SESEvent) {
  const base = {
    email_type: 'ses',
    provider: 'ses',
    message_id: event.mail.messageId,
  }

  if (event.eventType === 'Delivery') {
    const recipient = event.delivery?.recipients?.[0] || event.mail.destination?.[0]
    return {
      ...base,
      recipient_email: recipient || 'unknown',
      event_type: 'delivered' as const,
      metadata: {
        processingTimeMillis: event.delivery?.processingTimeMillis,
        smtpResponse: event.delivery?.smtpResponse,
      },
    }
  }

  if (event.eventType === 'Bounce') {
    const recipient = event.bounce?.bouncedRecipients?.[0]?.emailAddress || event.mail.destination?.[0]
    return {
      ...base,
      recipient_email: recipient || 'unknown',
      event_type: 'bounced' as const,
      metadata: {
        bounceType: event.bounce?.bounceType,
        bounceSubType: event.bounce?.bounceSubType,
      },
    }
  }

  if (event.eventType === 'Complaint') {
    const recipient = event.complaint?.complainedRecipients?.[0]?.emailAddress || event.mail.destination?.[0]
    return {
      ...base,
      recipient_email: recipient || 'unknown',
      event_type: 'complained' as const,
      metadata: {
        complaintFeedbackType: event.complaint?.complaintFeedbackType,
      },
    }
  }

  return null
}

export async function handleSNSMessage(message: SNSMessage) {
  // Topic guard
  if (EXPECTED_TOPIC_ARN && message.TopicArn !== EXPECTED_TOPIC_ARN) {
    throw new Error('Invalid TopicArn')
  }

  // Signature verification
  const isValid = await verifySignature(message)
  if (!isValid) {
    throw new Error('Invalid SNS signature')
  }

  // Handle subscription confirmation
  if (message.Type === 'SubscriptionConfirmation' && message.SubscribeURL) {
    await fetch(message.SubscribeURL)
    return { status: 'subscribed' }
  }

  if (message.Type !== 'Notification') {
    return { status: 'ignored' }
  }

  const sesEvent: SESEvent = JSON.parse(message.Message)

  // Idempotency by message_id
  if (await isDuplicateMessage(sesEvent.mail.messageId)) {
    return { status: 'duplicate' }
  }

  const mapped = mapEvent(sesEvent)
  if (!mapped) {
    return { status: 'ignored' }
  }

  await recordEmailEvent(mapped)
  return { status: 'processed' }
}

