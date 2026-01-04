/**
 * Zod validation schemas for competition levels and subscriptions (EPIC 04)
 * 
 * @see .cursor/docs/Delivery/Epic_04_Competition_Levels_Subscriptions.md
 */

import { z } from 'zod'

/**
 * Create competition level request schema
 */
export const createCompetitionLevelSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  price_per_lead_cents: z
    .number()
    .int('Price must be an integer')
    .min(0, 'Price cannot be negative'),
  max_recipients: z
    .number()
    .int('Max recipients must be an integer')
    .min(1, 'Max recipients must be at least 1')
    .max(100, 'Max recipients cannot exceed 100'),
  order_position: z
    .number()
    .int('Order position must be an integer')
    .min(1, 'Order position must be at least 1')
    .optional(), // Auto-assign if omitted
  is_active: z.boolean().default(true),
})

/**
 * Update competition level request schema
 */
export const updateCompetitionLevelSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .optional(),
  description: z.string().max(500, 'Description must be 500 characters or less').optional().nullable(),
  price_per_lead_cents: z
    .number()
    .int('Price must be an integer')
    .min(0, 'Price cannot be negative')
    .optional(),
  max_recipients: z
    .number()
    .int('Max recipients must be an integer')
    .min(1, 'Max recipients must be at least 1')
    .max(100, 'Max recipients cannot exceed 100')
    .optional(),
  order_position: z
    .number()
    .int('Order position must be an integer')
    .min(1, 'Order position must be at least 1')
    .optional(),
  is_active: z.boolean().optional(),
})

/**
 * Reorder competition levels request schema
 */
export const reorderCompetitionLevelsSchema = z.object({
  ordered_level_ids: z
    .array(z.string().uuid('Invalid level ID format'))
    .min(1, 'At least one level ID is required'),
})

/**
 * Competition levels list query schema
 */
export const competitionLevelsListQuerySchema = z.object({
  include_inactive: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(50),
})

/**
 * Provider subscriptions list query schema
 */
export const providerSubscriptionsQuerySchema = z.object({
  niche_id: z.string().uuid('Invalid niche ID format').optional(),
  is_active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(50),
})

/**
 * Admin subscriptions list query schema
 */
export const adminSubscriptionsQuerySchema = z.object({
  provider_id: z.string().uuid('Invalid provider ID format').optional(),
  niche_id: z.string().uuid('Invalid niche ID format').optional(),
  competition_level_id: z.string().uuid('Invalid competition level ID format').optional(),
  is_active: z.coerce.boolean().optional(),
  search: z.string().max(255, 'Search term too long').optional(),
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(50),
  sort: z.enum(['subscribed_at', '-subscribed_at']).default('-subscribed_at'),
})

