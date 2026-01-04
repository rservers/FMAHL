import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { sql } from '@/lib/db'

/**
 * GET /api/v1/admin/audit-logs/:id
 * 
 * Get audit log details by ID.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export const GET = adminWithMFA(async (request: NextRequest) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid audit log ID format' },
        { status: 400 }
      )
    }

    const [log] = await sql`
      SELECT 
        al.id,
        al.actor_id,
        al.actor_role,
        al.action,
        al.entity,
        al.entity_id,
        al.metadata,
        al.admin_only_memo,
        al.ip_address,
        al.created_at,
        u.email as actor_email
      FROM audit_log al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE al.id = ${id}
    `

    if (!log) {
      return NextResponse.json(
        { error: 'Audit log not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      log: {
        id: log.id,
        actor_id: log.actor_id,
        actor_email: log.actor_email,
        actor_role: log.actor_role,
        action: log.action,
        entity: log.entity,
        entity_id: log.entity_id,
        metadata: log.metadata,
        admin_only_memo: log.admin_only_memo,
        ip_address: log.ip_address,
        created_at: log.created_at,
      },
    })

  } catch (error: any) {
    console.error('Get audit log error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

