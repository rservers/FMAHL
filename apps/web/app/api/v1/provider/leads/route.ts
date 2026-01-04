/**
 * GET /api/v1/provider/leads
 * 
 * Provider inbox - list assigned leads with filtering, search, and pagination
 * 
 * @see .cursor/docs/Delivery/Epic_08_Provider_Lead_Management.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { providerInboxQuerySchema } from '@/lib/validations/provider-leads'
import { sql } from '@/lib/db'
import type { ProviderLeadAssignment, ProviderInboxResponse } from '@/lib/types/provider-leads'

export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      // Parse query parameters
      const url = new URL(request.url)
      const queryParams = {
        status: url.searchParams.get('status') || undefined,
        niche_id: url.searchParams.get('niche_id') || undefined,
        date_from: url.searchParams.get('date_from') || undefined,
        date_to: url.searchParams.get('date_to') || undefined,
        search: url.searchParams.get('search') || undefined,
        page: url.searchParams.get('page') || '1',
        limit: url.searchParams.get('limit') || '25',
      }

      // Validate query parameters
      const validationResult = providerInboxQuerySchema.safeParse(queryParams)
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

      const { status, niche_id, date_from, date_to, search, page, limit } = validationResult.data

      // Get provider ID
      const [provider] = await sql`
        SELECT id FROM providers WHERE user_id = ${user.id}
      `

      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }

      const providerId = provider.id

      // Build query with parameterized conditions (SQL injection safe)
      const offset = (page - 1) * limit

      // Build WHERE conditions dynamically using sql template
      let countQuery = sql`
        SELECT COUNT(*) as total
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        WHERE la.provider_id = ${providerId}
      `

      let dataQuery = sql`
        SELECT 
          la.id as assignment_id,
          la.lead_id,
          l.niche_id,
          n.name as niche_name,
          la.status,
          la.price_cents / 100.0 as price_charged,
          la.assigned_at,
          la.viewed_at,
          la.accepted_at,
          la.rejected_at,
          la.rejection_reason,
          l.contact_email,
          l.contact_phone,
          l.contact_name
        FROM lead_assignments la
        JOIN leads l ON la.lead_id = l.id
        JOIN niches n ON l.niche_id = n.id
        WHERE la.provider_id = ${providerId}
      `

      if (status) {
        countQuery = sql`${countQuery} AND la.status = ${status}`
        dataQuery = sql`${dataQuery} AND la.status = ${status}`
      }

      if (niche_id) {
        countQuery = sql`${countQuery} AND l.niche_id = ${niche_id}`
        dataQuery = sql`${dataQuery} AND l.niche_id = ${niche_id}`
      }

      if (date_from) {
        countQuery = sql`${countQuery} AND la.assigned_at >= ${date_from}`
        dataQuery = sql`${dataQuery} AND la.assigned_at >= ${date_from}`
      }

      if (date_to) {
        countQuery = sql`${countQuery} AND la.assigned_at <= ${date_to}`
        dataQuery = sql`${dataQuery} AND la.assigned_at <= ${date_to}`
      }

      if (search) {
        const searchPattern = `%${search}%`
        countQuery = sql`${countQuery} AND (LOWER(l.contact_email) LIKE LOWER(${searchPattern}) OR l.contact_phone LIKE ${searchPattern})`
        dataQuery = sql`${dataQuery} AND (LOWER(l.contact_email) LIKE LOWER(${searchPattern}) OR l.contact_phone LIKE ${searchPattern})`
      }

      // Get total count
      const [countResult] = await countQuery

      const totalCount = Number(countResult.total)
      const totalPages = Math.ceil(totalCount / limit)

      // Get paginated results
      const assignments = await sql`${dataQuery} ORDER BY la.assigned_at DESC LIMIT ${limit} OFFSET ${offset}`

      const items: ProviderLeadAssignment[] = assignments.map((row: any) => ({
        assignment_id: row.assignment_id,
        lead_id: row.lead_id,
        niche_id: row.niche_id,
        niche_name: row.niche_name,
        status: row.status,
        price_charged: Number(row.price_charged),
        assigned_at: row.assigned_at.toISOString(),
        viewed_at: row.viewed_at ? row.viewed_at.toISOString() : null,
        accepted_at: row.accepted_at ? row.accepted_at.toISOString() : null,
        rejected_at: row.rejected_at ? row.rejected_at.toISOString() : null,
        rejection_reason: row.rejection_reason,
        contact_email: row.contact_email,
        contact_phone: row.contact_phone,
        contact_name: row.contact_name,
      }))

      const response: ProviderInboxResponse = {
        page,
        limit,
        total_count: totalCount,
        total_pages: totalPages,
        items,
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Error fetching provider inbox:', error)
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      )
    }
  }, { allowedRoles: ['provider'] })
}

