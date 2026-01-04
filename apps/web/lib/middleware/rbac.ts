import { NextRequest, NextResponse } from 'next/server'
import { authenticate, type AuthenticatedUser, type AuthOptions } from './auth'
import type { UserRole } from '../jwt'

/**
 * Role-Based Access Control (RBAC) Middleware for EPIC 01
 * 
 * Provides:
 * - Role-based route protection
 * - Admin-only routes
 * - Provider-scoped resources
 * - Resource ownership checks
 * 
 * @see .cursor/docs/Delivery/Epic_01_Platform_Foundation.md
 */

/**
 * Role hierarchy for permission checks
 * Higher roles can access lower role resources
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  system: 4,
  admin: 3,
  provider: 2,
  end_user: 1,
}

/**
 * Check if a user has at least the specified role level
 */
export function hasMinimumRole(user: AuthenticatedUser, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minimumRole]
}

/**
 * Create a route handler that requires specific roles
 * 
 * Usage:
 * ```ts
 * export const GET = requireRole(['admin'], async (request, user) => {
 *   return NextResponse.json({ users: [] })
 * })
 * ```
 */
export function requireRole(
  allowedRoles: UserRole[],
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  options: Omit<AuthOptions, 'allowedRoles'> = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const result = await authenticate(request, { ...options, allowedRoles })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode || 403 }
      )
    }

    return handler(request, result.user!)
  }
}

/**
 * Admin-only route handler
 * 
 * Usage:
 * ```ts
 * export const GET = adminOnly(async (request, user) => {
 *   return NextResponse.json({ adminData: {} })
 * })
 * ```
 */
export function adminOnly(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  options: Omit<AuthOptions, 'allowedRoles'> = {}
) {
  return requireRole(['admin'], handler, options)
}

/**
 * Provider-only route handler
 * 
 * Usage:
 * ```ts
 * export const GET = providerOnly(async (request, user) => {
 *   return NextResponse.json({ providerData: {} })
 * })
 * ```
 */
export function providerOnly(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  options: Omit<AuthOptions, 'allowedRoles'> = {}
) {
  return requireRole(['provider'], handler, options)
}

/**
 * Admin or Provider route handler
 */
export function adminOrProvider(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  options: Omit<AuthOptions, 'allowedRoles'> = {}
) {
  return requireRole(['admin', 'provider'], handler, options)
}

/**
 * Resource ownership check options
 */
export interface OwnershipOptions {
  /** Function to get the owner ID from the request (e.g., from URL params or body) */
  getResourceOwnerId: (request: NextRequest) => Promise<string | null>
  /** Whether admins bypass ownership checks (default: true) */
  adminBypass?: boolean
}

/**
 * Create a route handler that checks resource ownership
 * 
 * Usage:
 * ```ts
 * export const GET = requireOwnership(
 *   { getResourceOwnerId: async (req) => getProviderIdFromUrl(req) },
 *   async (request, user) => {
 *     return NextResponse.json({ resource: {} })
 *   }
 * )
 * ```
 */
export function requireOwnership(
  ownershipOptions: OwnershipOptions,
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  authOptions: AuthOptions = {}
) {
  const { getResourceOwnerId, adminBypass = true } = ownershipOptions

  return async (request: NextRequest): Promise<NextResponse> => {
    const result = await authenticate(request, authOptions)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode || 401 }
      )
    }

    const user = result.user!

    // Admins bypass ownership checks by default
    if (adminBypass && user.role === 'admin') {
      return handler(request, user)
    }

    // System role bypasses ownership checks
    if (user.role === 'system') {
      return handler(request, user)
    }

    // Check ownership
    const ownerId = await getResourceOwnerId(request)
    if (!ownerId) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      )
    }

    if (ownerId !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to access this resource' },
        { status: 403 }
      )
    }

    return handler(request, user)
  }
}

/**
 * Combine multiple middleware checks
 * 
 * Usage:
 * ```ts
 * export const GET = combineMiddleware(
 *   [requireRole(['admin']), requireMFA],
 *   async (request, user) => {
 *     return NextResponse.json({ data: {} })
 *   }
 * )
 * ```
 */
export function combineMiddleware(
  middlewares: Array<(request: NextRequest) => Promise<{ success: boolean; error?: string; statusCode?: number; user?: AuthenticatedUser }>>,
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    let user: AuthenticatedUser | undefined

    for (const middleware of middlewares) {
      const result = await middleware(request)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: result.statusCode || 403 }
        )
      }
      if (result.user) {
        user = result.user
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return handler(request, user)
  }
}

/**
 * Permission definitions for fine-grained access control
 */
export const Permissions = {
  // User management
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE_STATUS: 'user:manage_status',
  USER_MANAGE_ROLE: 'user:manage_role',

  // Lead management
  LEAD_READ: 'lead:read',
  LEAD_CREATE: 'lead:create',
  LEAD_APPROVE: 'lead:approve',
  LEAD_REJECT: 'lead:reject',

  // Provider management
  PROVIDER_READ: 'provider:read',
  PROVIDER_UPDATE: 'provider:update',

  // Audit logs
  AUDIT_READ: 'audit:read',

  // Billing
  BILLING_READ: 'billing:read',
  BILLING_MANAGE: 'billing:manage',
} as const

export type Permission = typeof Permissions[keyof typeof Permissions]

/**
 * Role-permission mapping
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: Object.values(Permissions), // Admin has all permissions
  provider: [
    Permissions.LEAD_READ,
    Permissions.PROVIDER_READ,
    Permissions.PROVIDER_UPDATE,
    Permissions.BILLING_READ,
  ],
  end_user: [
    Permissions.LEAD_CREATE,
  ],
  system: Object.values(Permissions), // System has all permissions
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: AuthenticatedUser, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[user.role] || []
  return rolePermissions.includes(permission)
}

/**
 * Check if a user has all specified permissions
 */
export function hasAllPermissions(user: AuthenticatedUser, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(user, permission))
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(user: AuthenticatedUser, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(user, permission))
}

