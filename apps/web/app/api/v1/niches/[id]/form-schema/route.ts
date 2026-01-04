/**
 * GET /api/v1/niches/:id/form-schema
 * 
 * Get form schema for a niche (EPIC 02).
 * Public endpoint for lead submission forms.
 * 
 * @see .cursor/docs/Delivery/Epic_02_Lead_Intake_Confirmation.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid niche ID' }, { status: 400 })
    }

    // Get niche with form schema
    const [niche] = await sql`
      SELECT 
        id,
        name,
        slug,
        description,
        is_active,
        is_location_based,
        form_schema,
        active_schema_version
      FROM niches
      WHERE id = ${id}
    `

    if (!niche) {
      return NextResponse.json({ error: 'Niche not found' }, { status: 404 })
    }

    // Return schema even if inactive (for reference)
    return NextResponse.json({
      niche_id: niche.id,
      niche_name: niche.name,
      niche_slug: niche.slug,
      description: niche.description,
      is_active: niche.is_active,
      is_location_based: niche.is_location_based,
      form_schema: niche.form_schema,
      schema_version: niche.active_schema_version,
    })

  } catch (error: any) {
    console.error('Get form schema error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

