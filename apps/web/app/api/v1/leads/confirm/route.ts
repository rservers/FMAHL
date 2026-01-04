/**
 * GET /api/v1/leads/confirm
 * 
 * Lead confirmation endpoint per EPIC 02.
 * Validates confirmation token and updates lead status to pending_approval.
 * 
 * Rate limit: 10 attempts per IP per minute
 * 
 * @see .cursor/docs/Delivery/Epic_02_Lead_Intake_Confirmation.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { leadConfirmationSchema } from '@/lib/validations/lead'
import {
  hashConfirmationToken,
  isValidTokenFormat,
} from '@/lib/lead/confirmation-token'
import {
  leadConfirmationRateLimit,
  addRateLimitHeaders,
} from '@/lib/middleware/rate-limit'
import { getClientIP } from '@/lib/middleware/auth'
import { sql } from '@/lib/db'
import { logAction, AuditActions } from '@/lib/services/audit-logger'

export async function GET(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await leadConfirmationRateLimit(request)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Too many confirmation attempts. Please try again later.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Get token from query params
    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    // Validate token format
    if (!token || !isValidTokenFormat(token)) {
      return NextResponse.redirect(
        new URL('/confirm/invalid', request.url),
        302
      )
    }

    // Hash token and lookup lead
    const tokenHash = hashConfirmationToken(token)

    const [lead] = await sql`
      SELECT 
        id,
        status,
        confirmation_token_hash,
        confirmation_expires_at,
        confirmation_token_used,
        confirmed_at
      FROM leads
      WHERE confirmation_token_hash = ${tokenHash}
    `

    if (!lead) {
      return NextResponse.redirect(
        new URL('/confirm/invalid', request.url),
        302
      )
    }

    // Check if already confirmed
    if (lead.confirmed_at) {
      return NextResponse.redirect(
        new URL('/confirm/already-confirmed', request.url),
        302
      )
    }

    // Check if token is expired
    if (new Date(lead.confirmation_expires_at) < new Date()) {
      return NextResponse.redirect(
        new URL(`/confirm/expired?lead_id=${lead.id}`, request.url),
        302
      )
    }

    // Check if token already used
    if (lead.confirmation_token_used) {
      return NextResponse.redirect(
        new URL('/confirm/invalid', request.url),
        302
      )
    }

    // Check lead status
    if (lead.status !== 'pending_confirmation') {
      // If already moved to pending_approval or beyond, treat as already confirmed
      if (lead.status === 'pending_approval' || lead.status === 'approved') {
        return NextResponse.redirect(
          new URL('/confirm/already-confirmed', request.url),
          302
        )
      }
      // Other statuses are invalid
      return NextResponse.redirect(
        new URL('/confirm/invalid', request.url),
        302
      )
    }

    // Update lead: confirm and change status
    await sql`
      UPDATE leads
      SET 
        confirmed_at = NOW(),
        status = 'pending_approval',
        confirmation_token_used = true,
        updated_at = NOW()
      WHERE id = ${lead.id}
        AND status = 'pending_confirmation'
        AND confirmation_token_used = false
    `

    // Audit log confirmation
    const clientIP = getClientIP(request)
    await logAction({
      actorId: null, // System action
      actorRole: null,
      action: AuditActions.LEAD_CONFIRMED,
      entity: 'lead',
      entityId: lead.id,
      ipAddress: clientIP || undefined,
    })

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/confirm/success', request.url),
      302
    )

  } catch (error: any) {
    console.error('Lead confirmation error:', error)

    return NextResponse.redirect(
      new URL('/confirm/invalid', request.url),
      302
    )
  }
}

