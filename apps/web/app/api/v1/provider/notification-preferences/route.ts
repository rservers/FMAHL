/**
 * GET /api/v1/provider/notification-preferences
 * PATCH /api/v1/provider/notification-preferences
 * 
 * Provider notification preferences management
 * 
 * @see .cursor/docs/Delivery/Epic_08_Provider_Lead_Management.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { notificationPreferencesSchema } from '@/lib/validations/provider-leads'
import { sql } from '@/lib/db'
import type { NotificationPreferences } from '@/lib/types/provider-leads'

export const GET = withAuth(
  async (request: NextRequest, user) => {
    try {
      // Get provider
      const [provider] = await sql`
        SELECT 
          notify_on_new_lead,
          notify_on_lead_status_change,
          notify_on_bad_lead_decision
        FROM providers
        WHERE user_id = ${user.id}
      `

      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }

      const preferences: NotificationPreferences = {
        notify_on_new_lead: provider.notify_on_new_lead ?? true,
        notify_on_lead_status_change: provider.notify_on_lead_status_change ?? true,
        notify_on_bad_lead_decision: provider.notify_on_bad_lead_decision ?? true,
      }

      return NextResponse.json({
        ok: true,
        preferences,
      })
    } catch (error) {
      console.error('Error fetching notification preferences:', error)
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      )
    }
  },
  { allowedRoles: ['provider'] }
)

export const PATCH = withAuth(
  async (request: NextRequest, user) => {
    try {
      // Parse request body
      const body = await request.json()
      const validationResult = notificationPreferencesSchema.safeParse(body)
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

      const updates = validationResult.data

      // Build update query using sql template
      const updateParts: any[] = []
      
      if (updates.notify_on_new_lead !== undefined) {
        updateParts.push(sql`notify_on_new_lead = ${updates.notify_on_new_lead}`)
      }

      if (updates.notify_on_lead_status_change !== undefined) {
        updateParts.push(sql`notify_on_lead_status_change = ${updates.notify_on_lead_status_change}`)
      }

      if (updates.notify_on_bad_lead_decision !== undefined) {
        updateParts.push(sql`notify_on_bad_lead_decision = ${updates.notify_on_bad_lead_decision}`)
      }

      if (updateParts.length === 0) {
        return NextResponse.json(
          { error: 'No fields to update' },
          { status: 400 }
        )
      }

      // Update provider preferences
      await sql`
        UPDATE providers
        SET ${sql.join(updateParts, sql`, `)}
        WHERE user_id = ${user.id}
      `

      // Fetch updated preferences
      const [provider] = await sql`
        SELECT 
          notify_on_new_lead,
          notify_on_lead_status_change,
          notify_on_bad_lead_decision
        FROM providers
        WHERE user_id = ${user.id}
      `

      const preferences: NotificationPreferences = {
        notify_on_new_lead: provider.notify_on_new_lead ?? true,
        notify_on_lead_status_change: provider.notify_on_lead_status_change ?? true,
        notify_on_bad_lead_decision: provider.notify_on_bad_lead_decision ?? true,
      }

      return NextResponse.json({
        ok: true,
        preferences,
      })
    } catch (error) {
      console.error('Error updating notification preferences:', error)
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      )
    }
  },
  { allowedRoles: ['provider'] }
)

