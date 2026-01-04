/**
 * GET /api/v1/admin/billing/providers/:id/ledger
 * 
 * Get provider's ledger history (admin view).
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_07_Billing_Balance_Payments.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { billingHistoryQuerySchema } from '@/lib/validations/billing'
import { getLedgerHistory } from '@/lib/services/ledger'
import { sql } from '@/lib/db'

export const GET = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
    // Extract provider ID from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const providerIdIndex = pathParts.indexOf('providers')
    const providerId = providerIdIndex >= 0 && pathParts[providerIdIndex + 1]
      ? pathParts[providerIdIndex + 1]
      : null

    if (!providerId) {
      return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 })
    }

    // Verify provider exists
    const [provider] = await sql`
      SELECT id FROM providers WHERE id = ${providerId}
    `

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    // Parse query params
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
    const history = await getLedgerHistory(providerId, query)

    return NextResponse.json({
      provider_id: providerId,
      entries: history.entries,
      pagination: history.pagination,
    })
  } catch (error: any) {
    console.error('Admin provider ledger error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

