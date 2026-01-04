/**
 * Zod validation schemas for EPIC 08 - Provider Lead Management
 * 
 * @see .cursor/docs/Delivery/Epic_08_Provider_Lead_Management.md
 */

import { z } from 'zod'

export const assignmentStatusSchema = z.enum(['active', 'accepted', 'rejected', 'refunded'])

export const providerInboxQuerySchema = z.object({
  status: assignmentStatusSchema.optional(),
  niche_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  search: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const acceptLeadSchema = z.object({
  // No body required for accept
}).strict()

export const rejectLeadSchema = z.object({
  rejection_reason: z.string().min(10).max(500),
}).strict()

export const notificationPreferencesSchema = z.object({
  notify_on_new_lead: z.boolean().optional(),
  notify_on_lead_status_change: z.boolean().optional(),
  notify_on_bad_lead_decision: z.boolean().optional(),
}).strict()

export const leadExportRequestSchema = z.object({
  filters: z.object({
    status: assignmentStatusSchema.optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    niche_id: z.string().uuid().optional(),
  }).optional(),
}).strict()

