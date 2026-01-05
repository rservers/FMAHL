/**
 * GET /api/v1/admin/queues/dlq/:id
 * 
 * Get DLQ entry details
 * 
 * @see .cursor/docs/Delivery/Epic_12_Observability_and_Ops_LOCKED_v4.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { getDLQEntry, resolveDLQEntry } from '@/lib/services/dlq'
import { logAudit, AuditActions } from '@/lib/services/audit-logger'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return adminWithMFA(async (req, user) => {
    try {
      const { id } = await context.params

      const entry = await getDLQEntry(id)

      if (!entry) {
        return NextResponse.json(
          { error: 'DLQ entry not found' },
          { status: 404 }
        )
      }

      // Log audit event
      await logAudit({
        action: AuditActions.DLQ_ENTRY_VIEWED,
        actorId: user.id,
        actorRole: 'admin',
        entity: 'dead_letter_queue',
        entityId: id,
      })

      return NextResponse.json(entry)
    } catch (error) {
      console.error('Error fetching DLQ entry:', error)
      return NextResponse.json(
        { error: 'Failed to fetch DLQ entry' },
        { status: 500 }
      )
    }
  })(request)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return adminWithMFA(async (req, user) => {
    try {
      const { id } = await context.params

      const entry = await getDLQEntry(id)

      if (!entry) {
        return NextResponse.json(
          { error: 'DLQ entry not found' },
          { status: 404 }
        )
      }

      if (entry.resolved) {
        return NextResponse.json(
          { error: 'DLQ entry already resolved' },
          { status: 400 }
        )
      }

      await resolveDLQEntry(id, user.id)

      // Log audit event
      await logAudit({
        action: AuditActions.DLQ_ENTRY_RESOLVED,
        actorId: user.id,
        actorRole: 'admin',
        entity: 'dead_letter_queue',
        entityId: id,
      })

      return NextResponse.json({
        ok: true,
        message: 'DLQ entry marked as resolved',
      })
    } catch (error) {
      console.error('Error resolving DLQ entry:', error)
      return NextResponse.json(
        { error: 'Failed to resolve DLQ entry' },
        { status: 500 }
      )
    }
  })(request)
}

