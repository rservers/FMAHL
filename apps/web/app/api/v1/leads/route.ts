/**
 * POST /api/v1/leads
 * 
 * Public lead submission endpoint per EPIC 02.
 * Accepts niche-specific form data and creates a lead with pending_confirmation status.
 * Sends confirmation email via EPIC 10.
 * 
 * Rate limit: 5 submissions per email per hour
 * 
 * @see .cursor/docs/Delivery/Epic_02_Lead_Intake_Confirmation.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { leadSubmissionSchema } from '@/lib/validations/lead'
import { validateFormData } from '@/lib/lead/form-validator'
import { generateConfirmationToken, getTokenExpiry } from '@/lib/lead/confirmation-token'
import { leadSubmissionRateLimit, addRateLimitHeaders } from '@/lib/middleware/rate-limit'
import { getClientIP } from '@/lib/middleware/auth'
import { sql } from '@/lib/db'
import { emailService } from '@findmeahotlead/email'
import { logAction, AuditActions } from '@/lib/services/audit-logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validationResult = leadSubmissionSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues.map((e) => ({
            field: String(e.path.join('.')),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    const { niche_id, contact_email, contact_name, contact_phone, form_data, attribution } =
      validationResult.data

    // Check rate limit
    const rateLimitResult = await leadSubmissionRateLimit(contact_email)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Too many submission attempts. Please try again later.' },
        { status: 429 }
      )
      return addRateLimitHeaders(response, rateLimitResult)
    }

    // Validate niche exists and is active
    const [niche] = await sql`
      SELECT 
        id,
        name,
        is_active,
        form_schema,
        active_schema_version
      FROM niches
      WHERE id = ${niche_id}
    `

    if (!niche) {
      return NextResponse.json(
        { error: 'Niche not found' },
        { status: 404 }
      )
    }

    if (!niche.is_active) {
      return NextResponse.json(
        { error: 'This service is not currently accepting requests.' },
        { status: 404 }
      )
    }

    // Validate form_data against niche.form_schema
    const formSchema = niche.form_schema as any // Will be validated by form-validator
    const formValidation = validateFormData(form_data, formSchema)

    if (!formValidation.isValid) {
      return NextResponse.json(
        {
          error: 'Form validation failed',
          details: formValidation.errors,
        },
        { status: 400 }
      )
    }

    // Check for duplicate submission (same email + niche within 24h)
    const [duplicate] = await sql`
      SELECT id, created_at
      FROM leads
      WHERE submitter_email = ${contact_email.toLowerCase()}
        AND niche_id = ${niche_id}
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 1
    `

    // Note: We warn but don't block duplicates (per EPIC 02 spec)

    // Generate confirmation token
    const { token, tokenHash } = generateConfirmationToken()
    const expiresAt = getTokenExpiry()

    // Get client IP and user agent
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || null

    // Extract referrer from headers if not in attribution
    const referrerUrl = attribution?.referrer_url || request.headers.get('referer') || null

    // Create lead record
    const [lead] = await sql`
      INSERT INTO leads (
        niche_id,
        schema_version,
        status,
        submitter_name,
        submitter_email,
        submitter_phone,
        niche_data,
        confirmation_token_hash,
        confirmation_expires_at,
        utm_source,
        utm_medium,
        utm_campaign,
        referrer_url,
        partner_id,
        ip_address,
        user_agent
      ) VALUES (
        ${niche_id},
        ${niche.active_schema_version},
        'pending_confirmation',
        ${contact_name},
        ${contact_email.toLowerCase()},
        ${contact_phone || null},
        ${JSON.stringify(form_data)},
        ${tokenHash},
        ${expiresAt},
        ${attribution?.utm_source || null},
        ${attribution?.utm_medium || null},
        ${attribution?.utm_campaign || null},
        ${referrerUrl},
        ${attribution?.partner_id || null},
        ${clientIP || null},
        ${userAgent}
      )
      RETURNING id, status, created_at
    `

    // Audit log lead creation
    await logAction({
      actorId: null, // System action
      actorRole: null,
      action: AuditActions.LEAD_CREATED,
      entity: 'lead',
      entityId: lead.id,
      metadata: {
        niche_id,
        niche_name: niche.name,
        submitter_email: contact_email,
        duplicate_detected: !!duplicate,
      },
      ipAddress: clientIP || undefined,
    })

    // Build confirmation link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const confirmationLink = `${appUrl}/api/v1/leads/confirm?token=${token}`

    // Send confirmation email (non-blocking, queued)
    try {
      await emailService.sendTemplated({
        template: 'lead_confirmation',
        to: contact_email,
        variables: {
          contact_name: contact_name,
          confirmation_link: confirmationLink,
          niche_name: niche.name,
          expires_at: expiresAt.toISOString(),
        },
        relatedEntity: {
          type: 'lead',
          id: lead.id,
        },
        priority: 'normal',
      })
    } catch (emailError) {
      // Log but don't fail - email failures don't block lead creation
      console.error('Failed to queue confirmation email:', emailError)
    }

    const response = NextResponse.json(
      {
        lead_id: lead.id,
        message: 'Please check your email to confirm your request.',
        confirmation_sent: true,
        ...(duplicate && {
          warning: 'A similar request was submitted recently. Please check your email for confirmation.',
        }),
      },
      { status: 201 }
    )

    return addRateLimitHeaders(response, rateLimitResult)

  } catch (error: any) {
    console.error('Lead submission error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

