/**
 * PUT /api/v1/provider/subscriptions/:subscriptionId/filters
 * GET /api/v1/provider/subscriptions/:subscriptionId/filters
 * 
 * Set and view filters for a provider subscription.
 * 
 * Requires: Provider authentication, subscription ownership
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { providerOnly } from '@/lib/middleware/rbac'
import { updateFilterSchema } from '@/lib/validations/filter'
import { validateFilterRules } from '@/lib/filter/validator'
import { generateFilterSummary } from '@/lib/filter/summary'
import { logFilterChange } from '@/lib/services/filter-log'
import { emailService } from '@findmeahotlead/email'
import { sql } from '@/lib/db'
import type { FilterRules, NicheFormSchema } from '@/lib/types/filter'
// Deep equality helper (simple JSON comparison)
function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export const PUT = providerOnly(async (request: NextRequest, user: any) => {
  try {
    // Get provider
    const [provider] = await sql`
      SELECT id FROM providers WHERE user_id = ${user.id} LIMIT 1
    `

    if (!provider) {
      return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 })
    }

    // Extract subscription ID from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const subscriptionIdIndex = pathParts.indexOf('subscriptions')
    const subscriptionId = subscriptionIdIndex >= 0 && pathParts[subscriptionIdIndex + 1]
      ? pathParts[subscriptionIdIndex + 1]
      : null

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 })
    }

    // Validate request body
    const body = await request.json()
    const validationResult = updateFilterSchema.safeParse(body)
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

    const { filter_rules } = validationResult.data

    // Get subscription and verify ownership
    const [subscription] = await sql`
      SELECT 
        cls.id,
        cls.provider_id,
        cls.competition_level_id,
        cls.filter_rules,
        cl.niche_id,
        cl.is_active as level_is_active,
        n.form_schema
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      JOIN niches n ON cl.niche_id = n.id
      WHERE cls.id = ${subscriptionId}
        AND cls.provider_id = ${provider.id}
        AND cls.deleted_at IS NULL
    `

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or access denied' },
        { status: 404 }
      )
    }

    // Verify competition level is active
    if (!subscription.level_is_active) {
      return NextResponse.json(
        { error: 'Cannot update filters for inactive competition level' },
        { status: 400 }
      )
    }

    // Parse niche schema
    const nicheSchema: NicheFormSchema = subscription.form_schema as NicheFormSchema

    // Validate filter rules against niche schema
    const validation = validateFilterRules(filter_rules, nicheSchema)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid filter rules',
          validation_errors: validation.errors,
        },
        { status: 400 }
      )
    }

    // Get old rules for comparison
    const oldRules: FilterRules | null = subscription.filter_rules
      ? (subscription.filter_rules as FilterRules)
      : null

    // Deep equality check (idempotency)
    if (oldRules && deepEqual(oldRules, filter_rules)) {
      // No change, return current state
      const summary = generateFilterSummary(filter_rules, nicheSchema)
      return NextResponse.json({
        filter_rules,
        filter_summary: summary,
        filter_is_valid: true,
        filter_updated_at: subscription.filter_rules ? new Date().toISOString() : null,
        message: 'No changes detected',
      })
    }

    // Update filter rules
    await sql`
      UPDATE competition_level_subscriptions
      SET
        filter_rules = ${JSON.stringify(filter_rules)},
        filter_updated_at = NOW(),
        filter_is_valid = true
      WHERE id = ${subscriptionId}
    `

    // Log filter change
    await logFilterChange(
      subscriptionId,
      user.id,
      'provider',
      oldRules,
      filter_rules
    )

    const summary = generateFilterSummary(filter_rules, nicheSchema)

    // Send email notification (async, don't block)
    try {
      const [level] = await sql`
        SELECT name FROM competition_levels WHERE id = ${subscription.competition_level_id}
      `
      const [provider] = await sql`
        SELECT business_name, user_id FROM providers WHERE id = ${subscription.provider_id}
      `
      const [userRecord] = await sql`
        SELECT email FROM users WHERE id = ${provider.user_id}
      `

      if (userRecord?.email) {
        await emailService.sendTemplated({
          template: 'filter_updated',
          to: userRecord.email,
          variables: {
            provider_name: provider.business_name,
            level_name: level.name,
            filter_summary: summary,
          },
        })
      }
    } catch (error) {
      console.error('Failed to send filter update email:', error)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      filter_rules,
      filter_summary: summary,
      filter_is_valid: true,
      filter_updated_at: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Update filter error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const GET = providerOnly(async (request: NextRequest, user: any) => {
  try {
    // Get provider
    const [provider] = await sql`
      SELECT id FROM providers WHERE user_id = ${user.id} LIMIT 1
    `

    if (!provider) {
      return NextResponse.json({ error: 'Provider profile not found' }, { status: 404 })
    }

    // Extract subscription ID from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const subscriptionIdIndex = pathParts.indexOf('subscriptions')
    const subscriptionId = subscriptionIdIndex >= 0 && pathParts[subscriptionIdIndex + 1]
      ? pathParts[subscriptionIdIndex + 1]
      : null

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 })
    }

    // Get subscription and verify ownership
    const [subscription] = await sql`
      SELECT 
        cls.id,
        cls.provider_id,
        cls.filter_rules,
        cls.filter_updated_at,
        cls.filter_is_valid,
        n.form_schema
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      JOIN niches n ON cl.niche_id = n.id
      WHERE cls.id = ${subscriptionId}
        AND cls.provider_id = ${provider.id}
        AND cls.deleted_at IS NULL
    `

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or access denied' },
        { status: 404 }
      )
    }

    const filterRules: FilterRules | null = subscription.filter_rules
      ? (subscription.filter_rules as FilterRules)
      : null

    const nicheSchema: NicheFormSchema = subscription.form_schema as NicheFormSchema

    // Generate summary
    const summary = generateFilterSummary(filterRules, nicheSchema)

    // Validate if rules exist
    let validationErrors: any[] = []
    if (filterRules) {
      const validation = validateFilterRules(filterRules, nicheSchema)
      if (!validation.valid) {
        validationErrors = validation.errors
      }
    }

    return NextResponse.json({
      filter_rules: filterRules,
      filter_summary: summary,
      filter_is_valid: subscription.filter_is_valid,
      filter_updated_at: subscription.filter_updated_at?.toISOString() || null,
      validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
    })

  } catch (error: any) {
    console.error('Get filter error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

