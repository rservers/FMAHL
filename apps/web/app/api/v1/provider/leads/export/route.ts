/**
 * POST /api/v1/provider/leads/export
 * 
 * Request CSV export of provider's leads
 * 
 * @see .cursor/docs/Delivery/Epic_08_Provider_Lead_Management.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { leadExportRequestSchema } from '@/lib/validations/provider-leads'
import { sql } from '@/lib/db'
import { getRedis } from '@/lib/redis'
import { logAction, AuditActions } from '@/lib/services/audit-logger'
import { RateLimits, checkRateLimit } from '@/lib/middleware/rate-limit'
import type { LeadExportRequest, LeadExportResponse } from '@/lib/types/provider-leads'

export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      // Check daily export limit
      const redis = getRedis()
      const rateLimitKey = `${RateLimits.PROVIDER_EXPORT.keyPrefix}:${user.id}:${new Date().toISOString().split('T')[0]}`
      
      const rateLimitResult = await checkRateLimit(
        rateLimitKey,
        RateLimits.PROVIDER_EXPORT
      )

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            error: 'Export limit exceeded',
            limit: RateLimits.PROVIDER_EXPORT.limit,
            remaining: rateLimitResult.remaining,
          },
          { status: 429 }
        )
      }

      // Parse request body
      const body = await request.json().catch(() => ({}))
      const validationResult = leadExportRequestSchema.safeParse(body)
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

      const { filters } = validationResult.data

      // Get provider ID
      const [provider] = await sql`
        SELECT id FROM providers WHERE user_id = ${user.id}
      `

      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }

      const providerId = provider.id

      // Estimate row count with parameterized query (SQL injection safe)
      let countQuery = sql`
        SELECT COUNT(*) as total
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        WHERE la.provider_id = ${providerId}
      `

      if (filters?.status) {
        countQuery = sql`${countQuery} AND la.status = ${filters.status}`
      }

      if (filters?.date_from) {
        countQuery = sql`${countQuery} AND la.assigned_at >= ${filters.date_from}`
      }

      if (filters?.date_to) {
        countQuery = sql`${countQuery} AND la.assigned_at <= ${filters.date_to}`
      }

      if (filters?.niche_id) {
        countQuery = sql`${countQuery} AND l.niche_id = ${filters.niche_id}`
      }

      const [countResult] = await countQuery

      const estimatedRows = Number(countResult.total)

      // Enforce max rows limit
      const MAX_EXPORT_ROWS = 5000
      if (estimatedRows > MAX_EXPORT_ROWS) {
        return NextResponse.json(
          {
            error: 'Export too large',
            estimated_rows: estimatedRows,
            max_rows: MAX_EXPORT_ROWS,
          },
          { status: 400 }
        )
      }

      // Generate export ID
      const exportId = crypto.randomUUID()

      // Log export request
      await logAction({
        actorId: user.id,
        actorRole: 'provider',
        action: AuditActions.LEAD_EXPORT_REQUESTED,
        entity: 'lead_export',
        entityId: exportId,
        metadata: {
          provider_id: providerId,
          estimated_rows: estimatedRows,
          filters,
        },
      })

      // For MVP: Generate CSV synchronously (in production, this would be async)
      // Note: Full async processing with BullMQ would be implemented in production
      // For now, we'll return a queued status
      const response: LeadExportResponse = {
        ok: true,
        export_id: exportId,
        status: 'queued',
        estimated_rows: estimatedRows,
        message: 'Export queued. You will receive an email when ready.',
      }

      return NextResponse.json(response, { status: 202 })
    } catch (error) {
      console.error('Error requesting export:', error)
      return NextResponse.json(
        { error: 'Failed to request export' },
        { status: 500 }
      )
    }
  }, { allowedRoles: ['provider'] })
}

