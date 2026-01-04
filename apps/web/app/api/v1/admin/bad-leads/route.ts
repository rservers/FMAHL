/**
 * GET /api/v1/admin/bad-leads
 * 
 * Admin queue for bad lead requests with filtering and pagination
 * 
 * @see .cursor/docs/Delivery/Epic_09_Bad_Lead_Refunds.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { adminBadLeadListQuerySchema } from '@/lib/validations/bad-leads'
import { sql } from '@/lib/db'
import type { BadLeadListItem } from '@/lib/types/bad-leads'

export async function GET(request: NextRequest) {
  return adminWithMFA(async () => {
    try {
      // Parse query parameters
      const url = new URL(request.url)
      const queryParams = {
        status: url.searchParams.get('status') || 'pending',
        niche_id: url.searchParams.get('niche_id') || undefined,
        provider_id: url.searchParams.get('provider_id') || undefined,
        reason_category: url.searchParams.get('reason_category') || undefined,
        reported_from: url.searchParams.get('reported_from') || undefined,
        reported_to: url.searchParams.get('reported_to') || undefined,
        page: url.searchParams.get('page') || '1',
        limit: url.searchParams.get('limit') || '50',
      }

      // Validate query parameters
      const validationResult = adminBadLeadListQuerySchema.safeParse(queryParams)
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

      const { status, niche_id, provider_id, reason_category, reported_from, reported_to, page, limit } = validationResult.data

      // Ensure status is defined (default to 'pending')
      const filterStatus: 'pending' | 'approved' | 'rejected' = status || 'pending'

      // Build query with parameterized conditions
      let countQuery = sql`
        SELECT COUNT(*) as total
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        JOIN niches n ON l.niche_id = n.id
        JOIN providers p ON la.provider_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE la.bad_lead_status = ${filterStatus}
          AND la.bad_lead_reported_at IS NOT NULL
      `

      let dataQuery = sql`
        SELECT 
          la.id as assignment_id,
          la.lead_id,
          la.provider_id,
          u.first_name || ' ' || u.last_name as provider_name,
          l.niche_id,
          n.name as niche_name,
          la.bad_lead_reported_at,
          la.bad_lead_reason_category,
          la.bad_lead_reason_notes,
          la.bad_lead_status,
          la.price_cents / 100.0 as price_charged
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        JOIN niches n ON l.niche_id = n.id
        JOIN providers p ON la.provider_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE la.bad_lead_status = ${filterStatus}
          AND la.bad_lead_reported_at IS NOT NULL
      `

      if (niche_id) {
        countQuery = sql`${countQuery} AND l.niche_id = ${niche_id}`
        dataQuery = sql`${dataQuery} AND l.niche_id = ${niche_id}`
      }

      if (provider_id) {
        countQuery = sql`${countQuery} AND la.provider_id = ${provider_id}`
        dataQuery = sql`${dataQuery} AND la.provider_id = ${provider_id}`
      }

      if (reason_category) {
        countQuery = sql`${countQuery} AND la.bad_lead_reason_category = ${reason_category}`
        dataQuery = sql`${dataQuery} AND la.bad_lead_reason_category = ${reason_category}`
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

      const response: { page: number; limit: number; total_count: number; total_pages: number; items: BadLeadListItem[] } = {
        page,
        limit,
        total_count: totalCount,
        total_pages: totalPages,
        items: items.map((row: any) => ({
          assignment_id: row.assignment_id,
          lead_id: row.lead_id,
          provider_id: row.provider_id,
          provider_name: row.provider_name || 'Unknown',
          niche_id: row.niche_id,
          niche_name: row.niche_name,
          bad_lead_reported_at: row.bad_lead_reported_at.toISOString(),
          bad_lead_reason_category: row.bad_lead_reason_category,
          bad_lead_reason_notes: row.bad_lead_reason_notes,
          bad_lead_status: row.bad_lead_status,
          price_charged: Number(row.price_charged),
        })),
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching bad leads:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bad leads' },
        { status: 500 }
      )
    }
  })(request)
}

