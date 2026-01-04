import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { listAuditLogsQuerySchema } from '@/lib/validations/admin'
import { queryAuditLogs } from '@/lib/services/audit-logger'

/**
 * GET /api/v1/admin/audit-logs
 * 
 * List audit logs with pagination and filters.
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */
export const GET = adminWithMFA(async (request: NextRequest) => {
  try {
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)

    // Validate query params
    const validationResult = listAuditLogsQuerySchema.safeParse(queryParams)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { page, limit, actor_id, action, entity, entity_id, start_date, end_date } = validationResult.data

    // Query audit logs
    const result = await queryAuditLogs({
      actorId: actor_id,
      action,
      entity,
      entityId: entity_id,
      startDate: start_date ? new Date(start_date) : undefined,
      endDate: end_date ? new Date(end_date) : undefined,
      page,
      limit,
    })

    return NextResponse.json({
      logs: result.logs.map((log) => ({
        id: log.id,
        actor_id: log.actor_id,
        actor_role: log.actor_role,
        action: log.action,
        entity: log.entity,
        entity_id: log.entity_id,
        metadata: log.metadata,
        admin_only_memo: log.admin_only_memo,
        created_at: log.created_at,
      })),
      pagination: result.pagination,
    })

  } catch (error: any) {
    console.error('List audit logs error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

