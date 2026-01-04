/**
 * Zod validation schemas for EPIC 09 - Bad Lead & Refunds
 * 
 * @see .cursor/docs/Delivery/Epic_09_Bad_Lead_Refunds.md
 */

import { z } from 'zod'

export const badLeadReasonCategorySchema = z.enum(['spam', 'duplicate', 'invalid_contact', 'out_of_scope', 'other'])

export const badLeadStatusSchema = z.enum(['pending', 'approved', 'rejected'])

export const reportBadLeadSchema = z.object({
  reason_category: badLeadReasonCategorySchema,
  reason_notes: z.string().max(500).optional(),
}).refine((data) => {
  // Notes required if category is 'other'
  if (data.reason_category === 'other') {
    return data.reason_notes && data.reason_notes.length >= 10
  }
  return true
}, {
  message: 'reason_notes is required and must be at least 10 characters when category is "other"',
  path: ['reason_notes'],
}).strict()

export const adminBadLeadListQuerySchema = z.object({
  status: badLeadStatusSchema.optional(),
  niche_id: z.string().uuid().optional(),
  provider_id: z.string().uuid().optional(),
  reason_category: badLeadReasonCategorySchema.optional(),
  reported_from: z.string().datetime().optional(),
  reported_to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const adminBadLeadActionSchema = z.object({
  admin_memo: z.string().min(10).max(1000),
}).strict()

export const providerBadLeadHistoryQuerySchema = z.object({
  status: badLeadStatusSchema.optional(),
  reported_from: z.string().datetime().optional(),
  reported_to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const adminMetricsQuerySchema = z.object({
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  niche_id: z.string().uuid().optional(),
  provider_id: z.string().uuid().optional(),
})

