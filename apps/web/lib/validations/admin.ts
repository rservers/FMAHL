import { z } from 'zod'

/**
 * Admin validation schemas for EPIC 01
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

// ============================================
// USER MANAGEMENT
// ============================================

export const updateUserStatusSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'deactivated']),
  reason: z.string().optional(),
})

export const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'provider', 'end_user']),
  // Note: 'system' role cannot be assigned via API
})

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  role: z.enum(['admin', 'provider', 'end_user', 'system']).optional(),
  status: z.enum(['pending', 'active', 'suspended', 'deactivated']).optional(),
  search: z.string().optional(), // Search by email or name
  sort_by: z.enum(['created_at', 'email', 'last_login_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
})

// ============================================
// AUDIT LOGS
// ============================================

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  actor_id: z.string().uuid().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
})

// ============================================
// TYPE EXPORTS
// ============================================

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>

