/**
 * POST /api/v1/leads/:id/resend-confirmation
 * 
 * Resend confirmation email for a lead per EPIC 02.
 * 
 * Constraints:
 * - Lead must be in pending_confirmation status
 * - Max 3 resends per lead
 * - Cooldown: 1 resend per 5 minutes
 * 
 * @see .cursor/docs/Delivery/Epic_02_Lead_Intake_Confirmation.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { resendConfirmationSchema } from '@/lib/validations/lead'
import {
  generateConfirmationToken,
  getTokenExpiry,
} from '@/lib/lead/confirmation-token'
import { sql } from '@/lib/db'
import { emailService } from '@findmeahotlead/email'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { getClientIP } from '@/lib/middleware/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Validate lead_id format
    const validationResult = resendConfirmationSchema.safeParse({ lead_id: id })
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid lead ID' },
        { status: 400 }
      )
    }

    // Find lead
    const [lead] = await sql`
      SELECT 
        id,
        niche_id,
        status,
        submitter_email,
        submitter_name,
        resend_count,
        last_resend_at,
        confirmation_token_hash,
        confirmation_expires_at
      FROM leads
      WHERE id = ${id}
    `

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Check status
    if (lead.status !== 'pending_confirmation') {
      return NextResponse.json(
        {
          error: 'Lead is not in pending confirmation status',
          current_status: lead.status,
        },
        { status: 400 }
      )
    }

    // Check resend count
    if (lead.resend_count >= 3) {
      return NextResponse.json(
        {
          error: 'Maximum resend attempts reached. Please contact support.',
        },
        { status: 429 }
      )
    }

    // Check cooldown (1 resend per 5 minutes)
    if (lead.last_resend_at) {
      const lastResendTime = new Date(lead.last_resend_at).getTime()
      const cooldownMs = 5 * 60 * 1000 // 5 minutes
      const timeSinceLastResend = Date.now() - lastResendTime

      if (timeSinceLastResend < cooldownMs) {
        const remainingSeconds = Math.ceil(
          (cooldownMs - timeSinceLastResend) / 1000
        )
        return NextResponse.json(
          {
            error: `Please wait ${remainingSeconds} seconds before requesting another resend.`,
            retryAfter: remainingSeconds,
          },
          { status: 429 }
        )
      }
    }

    // Invalidate old token
    await sql`
      UPDATE leads
      SET confirmation_token_used = true
      WHERE id = ${id}
        AND confirmation_token_hash = ${lead.confirmation_token_hash}
    `

    // Generate new token
    const { token, tokenHash } = generateConfirmationToken()
    const expiresAt = getTokenExpiry()

    // Update lead with new token
    await sql`
      UPDATE leads
      SET 
        confirmation_token_hash = ${tokenHash},
        confirmation_expires_at = ${expiresAt},
        confirmation_token_used = false,
        resend_count = resend_count + 1,
        last_resend_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}
    `

    // Get niche name for email
    const [niche] = await sql`
      SELECT name FROM niches WHERE id = ${lead.niche_id}
    `

    // Build confirmation link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const confirmationLink = `${appUrl}/api/v1/leads/confirm?token=${token}`

    // Send confirmation email
    try {
      await emailService.sendTemplated({
        template: 'lead_confirmation',
        to: lead.submitter_email,
        variables: {
          contact_name: lead.submitter_name,
          confirmation_link: confirmationLink,
          niche_name: niche?.name || 'service',
          expires_at: expiresAt.toISOString(),
        },
        relatedEntity: {
          type: 'lead',
          id: lead.id,
        },
        priority: 'normal',
      })
    } catch (emailError) {
      console.error('Failed to queue resend confirmation email:', emailError)
      // Don't fail the request - email is queued async
    }

    // Audit log resend
    const clientIP = getClientIP(request)
    await logAction({
      actorId: null, // System action
      actorRole: null,
      action: AuditActions.LEAD_CONFIRMATION_RESENT,
      entity: 'lead',
      entityId: lead.id,
      metadata: {
        resend_count: lead.resend_count + 1,
      },
      ipAddress: clientIP || undefined,
    })

    return NextResponse.json({
      message: 'Confirmation email has been resent. Please check your email.',
      resend_count: lead.resend_count + 1,
    })

  } catch (error: any) {
    console.error('Resend confirmation error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

