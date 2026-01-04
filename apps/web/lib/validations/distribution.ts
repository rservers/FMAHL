/**
 * Distribution Validation Schemas for EPIC 06
 * 
 * @see .cursor/docs/Delivery/Epic_06_Distribution_Engine.md
 */

import { z } from 'zod'

/**
 * Schema for manual distribution trigger request
 */
export const distributeLeadRequestSchema = z.object({
  reason: z.string().optional().default('manual_trigger'),
})

/**
 * Schema for distribution status query params
 */
export const distributionStatusQuerySchema = z.object({
  leadId: z.string().uuid(),
})

/**
 * Schema for assignments list query params
 */
export const assignmentsListQuerySchema = z.object({
  leadId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type DistributeLeadRequest = z.infer<typeof distributeLeadRequestSchema>
export type DistributionStatusQuery = z.infer<typeof distributionStatusQuerySchema>
export type AssignmentsListQuery = z.infer<typeof assignmentsListQuerySchema>

