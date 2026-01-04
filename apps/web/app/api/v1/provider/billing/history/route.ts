/**
 * GET /api/v1/provider/billing/history
 * 
 * Get provider's billing history (ledger entries).
 * 
 * Requires: Provider authentication
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { providerOnly } from '@/lib/middleware/rbac'
import { billingHistoryQuerySchema } from '@/lib/validations/billing'
import { getLedgerHistory } from '@/lib/services/ledger'
import { sql } from '@/lib/db'

export const GET = providerOnly(async (request: NextRequest, user: any) => {
  try {
    // Get provider
    const [provider] = await sql`
      SELECT id FROM providers WHERE user_id = ${user.id} LIMIT 1
    `

    if (!provider) {
      return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 })
    }

    // Parse query params
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const validationResult = billingHistoryQuerySchema.safeParse(queryParams)
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

    const query = validationResult.data

    // Get ledger history
    const history = await getLedgerHistory(provider.id, query)

    // Enhance entries with related entity names (lightweight)
    const enhancedEntries = await Promise.all(
      history.entries.map(async (entry) => {
        let levelName: string | null = null

        if (entry.related_subscription_id) {
          const [level] = await sql`
            SELECT cl.name
            FROM competition_level_subscriptions cls
            JOIN competition_levels cl ON cls.competition_level_id = cl.id
            WHERE cls.id = ${entry.related_subscription_id}
            LIMIT 1
          `
          levelName = level?.name || null
        }

        return {
          ...entry,
          level_name: levelName,
        }
      })
    )

    return NextResponse.json({
      entries: enhancedEntries,
      pagination: history.pagination,
    })
  } catch (error: any) {
    console.error('Billing history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

