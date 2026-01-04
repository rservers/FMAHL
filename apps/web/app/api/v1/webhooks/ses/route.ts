import { NextRequest, NextResponse } from 'next/server'
import { handleSNSMessage } from '@findmeahotlead/email/webhooks/ses-handler'

/**
 * POST /api/v1/webhooks/ses
 *
 * SES → SNS → This endpoint
 * Verifies SNS signature, enforces TopicArn (if configured), and records email events.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await handleSNSMessage(body)
    return NextResponse.json({ ok: true, result })
  } catch (error: any) {
    console.error('SES webhook error:', error)
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 401 })
  }
}

