/**
 * GET /api/v1/admin/subscriptions/:subscriptionId/filters
 * 
 * View filters for any subscription (admin only).
 * 
 * Requires: Admin role with MFA
 * 
 * @see .cursor/docs/Delivery/Epic_05_Filters_Eligibility.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminWithMFA } from '@/lib/middleware/mfa'
import { generateFilterSummary } from '@/lib/filter/summary'
import { validateFilterRules } from '@/lib/filter/validator'
import { sql } from '@/lib/db'
import type { FilterRules, NicheFormSchema } from '@/lib/types/filter'

export const GET = adminWithMFA(async (request: NextRequest, user: any) => {
  try {
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

    // Get subscription
    const [subscription] = await sql`
      SELECT 
        cls.id,
        cls.filter_rules,
        cls.filter_updated_at,
        cls.filter_is_valid,
        cls.provider_id,
        cl.niche_id,
        n.form_schema,
        p.business_name,
        cl.name as level_name
      FROM competition_level_subscriptions cls
      JOIN competition_levels cl ON cls.competition_level_id = cl.id
      JOIN niches n ON cl.niche_id = n.id
      JOIN providers p ON cls.provider_id = p.id
      WHERE cls.id = ${subscriptionId}
        AND cls.deleted_at IS NULL
    `

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
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
      subscription_id: subscription.id,
      provider_id: subscription.provider_id,
      provider_name: subscription.business_name,
      niche_id: subscription.niche_id,
      level_name: subscription.level_name,
      filter_rules: filterRules,
      filter_summary: summary,
      filter_is_valid: subscription.filter_is_valid,
      filter_updated_at: subscription.filter_updated_at?.toISOString() || null,
      validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
    })

  } catch (error: any) {
    console.error('Get subscription filters error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

