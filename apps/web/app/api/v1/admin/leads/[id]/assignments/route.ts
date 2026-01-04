/**
 * GET /api/v1/admin/leads/:id/assignments
 * 
 * Get paginated list of assignments for a lead.
 * 
 * Requires: Admin role
 * 
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { assignmentsListQuerySchema } from '@/lib/validations/distribution'
import { sql } from '@/lib/db'
import type { AssignmentsListResponse } from '@/lib/types/distribution'

export const GET = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const assignmentsIndex = pathParts.indexOf('assignments')
    const id = assignmentsIndex > 0 ? pathParts[assignmentsIndex - 1] : null

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 })
    }

    // Parse query params
    const searchParams = Object.fromEntries(url.searchParams.entries())
    const validationResult = assignmentsListQuerySchema.safeParse({
      leadId: id,
      ...searchParams,
    })

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

    const { page, limit } = validationResult.data
    const offset = (page - 1) * limit

    // Verify lead exists
    const [lead] = await sql`
      SELECT id FROM leads WHERE id = ${id} AND deleted_at IS NULL
    `

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Get total count
    const [countResult] = await sql`
      SELECT COUNT(*)::int as total
      FROM lead_assignments
      WHERE lead_id = ${id}
    `
    const total = countResult?.total || 0

    // Get paginated assignments
    const assignments = await sql`
      SELECT 
        la.id as assignment_id,
        la.provider_id,
        p.business_name as provider_name,
        la.subscription_id,
        la.competition_level_id,
        cl.name as level_name,
        la.price_cents,
        la.assigned_at,
        la.status
      FROM lead_assignments la
      JOIN providers p ON la.provider_id = p.id
      JOIN competition_levels cl ON la.competition_level_id = cl.id
      WHERE la.lead_id = ${id}
      ORDER BY la.assigned_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const response: AssignmentsListResponse = {
      leadId: id,
      page,
      limit,
      total,
      items: assignments.map((a) => ({
        assignmentId: a.assignment_id,
        providerId: a.provider_id,
        providerName: a.provider_name,
        subscriptionId: a.subscription_id,
        competitionLevelId: a.competition_level_id,
        levelName: a.level_name,
        priceCharged: a.price_cents / 100,
        assignedAt: a.assigned_at.toISOString(),
        status: a.status,
      })),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting assignments:', error)
    return NextResponse.json({ error: 'Failed to get assignments' }, { status: 500 })
  }
})

