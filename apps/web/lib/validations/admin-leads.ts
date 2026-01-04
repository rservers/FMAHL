/**
 * Zod validation schemas for admin lead management (EPIC 03)
 * 
 * @see .cursor/docs/Delivery/Epic_03_Admin_Lead_Review_Approval.md
 */

import { z } from 'zod'

/**
 * Approve lead request schema
 */
export const approveLeadSchema = z.object({
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
  notify_user: z.boolean().default(false),
})

/**
 * Reject lead request schema
 */
export const rejectLeadSchema = z.object({
  reason: z
    .string()
    .min(1, 'Rejection reason is required')
    .max(500, 'Reason must be 500 characters or less'),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
  notify_user: z.boolean().default(false),
})

/**
 * Bulk approve request schema
 */
export const bulkApproveSchema = z.object({
  lead_ids: z
    .array(z.string().uuid('Invalid lead ID format'))
    .min(1, 'At least one lead ID is required')
    .max(50, 'Maximum 50 leads per bulk operation'),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
})

/**
 * Bulk reject request schema
 */
export const bulkRejectSchema = z.object({
  lead_ids: z
    .array(z.string().uuid('Invalid lead ID format'))
    .min(1, 'At least one lead ID is required')
    .max(50, 'Maximum 50 leads per bulk operation'),
  reason: z
    .string()
    .min(1, 'Rejection reason is required')
    .max(500, 'Reason must be 500 characters or less'),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
})

/**
 * Lead list query schema
 */
export const leadListQuerySchema = z.object({
  status: z
    .enum(['pending_approval', 'approved', 'rejected'], {
      message: 'Status must be pending_approval, approved, or rejected',
    })
    .optional(),
  niche_id: z.string().uuid('Invalid niche ID format').optional(),
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
})

