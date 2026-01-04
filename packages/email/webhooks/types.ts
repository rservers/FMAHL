export type SNSType = 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation'

export interface SNSMessage {
  Type: SNSType
  MessageId: string
  TopicArn: string
  Subject?: string
  Timestamp: string
  SignatureVersion: string
  Signature: string
  SigningCertURL: string
  UnsubscribeURL?: string
  SubscribeURL?: string
  Message: string
}

export interface SESEvent {
  eventType: 'Delivery' | 'Bounce' | 'Complaint'
  mail: {
    messageId: string
    destination: string[]
    source: string
    timestamp: string
  }
  delivery?: {
    timestamp: string
    processingTimeMillis: number
    recipients: string[]
    smtpResponse: string
  }
  bounce?: {
    bounceType: string
    bounceSubType: string
    bouncedRecipients: Array<{
      emailAddress: string
      action?: string
      status?: string
      diagnosticCode?: string
    }>
    timestamp: string
  }
  complaint?: {
    complainedRecipients: Array<{ emailAddress: string }>
    timestamp: string
    complaintFeedbackType?: string
  }
}

