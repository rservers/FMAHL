/**
 * GET /api/v1/provider/bad-leads
 * 
 * Provider bad lead history with filtering and pagination
 * 
 * @see .cursor/docs/Delivery/Epic_09_Bad_Lead_Refunds.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { providerBadLeadHistoryQuerySchema } from '@/lib/validations/bad-leads'
import { sql } from '@/lib/db'
import type { ProviderBadLeadHistoryItem } from '@/lib/types/bad-leads'

export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      // Parse query parameters
      const url = new URL(request.url)
      const queryParams = {
        status: url.searchParams.get('status') || undefined,
        reported_from: url.searchParams.get('reported_from') || undefined,
        reported_to: url.searchParams.get('reported_to') || undefined,
        page: url.searchParams.get('page') || '1',
        limit: url.searchParams.get('limit') || '50',
      }

      // Validate query parameters
      const validationResult = providerBadLeadHistoryQuerySchema.safeParse(queryParams)
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

      const { status, reported_from, reported_to, page, limit } = validationResult.data

      // Get provider ID
      const [provider] = await sql`
        SELECT id FROM providers WHERE user_id = ${user.id}
      `

      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }

      const providerId = provider.id

      // Build query with parameterized conditions
      let countQuery = sql`
        SELECT COUNT(*) as total
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        JOIN niches n ON l.niche_id = n.id
        WHERE la.provider_id = ${providerId}
          AND la.bad_lead_reported_at IS NOT NULL
      `

      let dataQuery = sql`
        SELECT 
          la.id as assignment_id,
          la.lead_id,
          n.name as niche_name,
          la.bad_lead_reported_at,
          la.bad_lead_reason_category,
          la.bad_lead_reason_notes,
          la.bad_lead_status,
          la.refund_amount,
          la.refunded_at,
          la.refund_reason as admin_memo
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        JOIN niches n ON l.niche_id = n.id
        WHERE la.provider_id = ${providerId}
          AND la.bad_lead_reported_at IS NOT NULL
      `

      if (status) {
        countQuery = sql`${countQuery} AND la.bad_lead_status = ${status}`
        dataQuery = sql`${dataQuery} AND la.bad_lead_status = ${status}`
      }

      if (reported_from) {
        countQuery = sql`${countQuery} AND la.bad_lead_reported_at >= ${reported_from}`
        dataQuery = sql`${dataQuery} AND la.bad_lead_reported_at >= ${reported_from}`
      }

      if (reported_to) {
        countQuery = sql`${countQuery} AND la.bad_lead_reported_at <= ${reported_to}`
        dataQuery = sql`${dataQuery} AND la.bad_lead_reported_at <= ${reported_to}`
      }

      // Get total count
      const [countResult] = await countQuery
      const totalCount = Number(countResult.total)
      const totalPages = Math.ceil(totalCount / limit)
      const offset = (page - 1) * limit

      // Get paginated results
      const items = await sql`${dataQuery} ORDER BY la.bad_lead_reported_at DESC LIMIT ${limit} OFFSET ${offset}`

      const response: { page: number; limit: number; total_count: number; total_pages: number; items: ProviderBadLeadHistoryItem[] } = {
        page,
        limit,
        total_count: totalCount,
        total_pages: totalPages,
        items: items.map((row: any) => ({
          assignment_id: row.assignment_id,
          lead_id: row.lead_id,
          niche_name: row.niche_name,
          bad_lead_reported_at: row.bad_lead_reported_at.toISOString(),
          bad_lead_reason_category: row.bad_lead_reason_category,
          bad_lead_reason_notes: row.bad_lead_reason_notes,
          bad_lead_status: row.bad_lead_status,
          refund_amount: row.refund_amount ? Number(row.refund_amount) : null,
          refunded_at: row.refunded_at ? row.refunded_at.toISOString() : null,
          admin_memo: row.admin_memo,
        })),
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching bad lead history:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bad lead history' },
        { status: 500 }
      )
    }
  }, { allowedRoles: ['provider'] })
}

