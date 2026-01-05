/**
 * Zod validation schemas for EPIC 11 - Reporting & Analytics
 * 
 * @see .cursor/docs/Delivery/Epic_11_Reporting_Analytics.md
 */

import { z } from 'zod'

export const dateRangeSchema = z.object({
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
})

export const adminKPIDashboardQuerySchema = dateRangeSchema.strict()

export const funnelQuerySchema = dateRangeSchema.extend({
  bucket: z.enum(['day', 'hour']).default('day'),
  niche_id: z.string().uuid().optional(),
}).strict()

export const revenueQuerySchema = dateRangeSchema.strict()

export const starvationQuerySchema = z.object({
  niche_id: z.string().uuid().optional(),
  competition_level_id: z.string().uuid().optional(),
}).strict()

export const flaggedProvidersQuerySchema = dateRangeSchema.extend({
  provider_id: z.string().uuid().optional(),
}).strict()

export const providerKPIDashboardQuerySchema = dateRangeSchema.extend({
  group_by: z.enum(['niche', 'none']).default('none'),
}).strict()

export const exportJobRequestSchema = z.object({
  scope: z.enum(['admin', 'provider']),
  type: z.enum(['funnel', 'kpis', 'revenue', 'fairness', 'bad_leads', 'assigned_leads', 'distribution_metrics']),
  filters: z.record(z.string(), z.any()),
  format: z.enum(['csv', 'xlsx']).default('csv'),
}).strict()

