/**
 * GET /api/v1/admin/leads
 * 
 * List leads with pagination and filters for admin review.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_03_Admin_Lead_Review_Approval.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { leadListQuerySchema } from '@/lib/validations/admin-leads'
import { sql } from '@/lib/db'

export const GET = adminWithMFA(async (request: NextRequest) => {
  try {
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)

    // Validate query params
    const validationResult = leadListQuerySchema.safeParse(queryParams)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validationResult.error.issues.map((e) => ({
            field: String(e.path.join('.')),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    const { status, niche_id, page, limit } = validationResult.data
    const offset = (page - 1) * limit

    // Build WHERE clause
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      conditions.push(`l.status = $${paramIndex++}`)
      params.push(status)
    } else {
      // Default to pending_approval if no status specified
      conditions.push(`l.status = $${paramIndex++}`)
      params.push('pending_approval')
    }

    if (niche_id) {
      conditions.push(`l.niche_id = $${paramIndex++}`)
      params.push(niche_id)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM leads l
      ${whereClause}
    `
    const [countResult] = await sql.unsafe(countQuery, params)
    const total = Number(countResult.total)

    // Get leads with pagination
    const leadsQuery = `
      SELECT 
        l.id,
        l.submitter_email,
        l.submitter_name,
        l.niche_id,
        n.name as niche_name,
        l.status,
        l.created_at,
        l.confirmed_at
      FROM leads l
      LEFT JOIN niches n ON l.niche_id = n.id
      ${whereClause}
      ORDER BY l.created_at ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    params.push(limit, offset)

    const leads = await sql.unsafe(leadsQuery, params)

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      leads: leads.map((lead) => ({
        id: lead.id,
        submitter_email: lead.submitter_email,
        submitter_name: lead.submitter_name,
        niche_id: lead.niche_id,
        niche_name: lead.niche_name,
        status: lead.status,
        created_at: lead.created_at.toISOString(),
        confirmed_at: lead.confirmed_at ? lead.confirmed_at.toISOString() : null,
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    })

  } catch (error: any) {
    console.error('Admin lead list error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

