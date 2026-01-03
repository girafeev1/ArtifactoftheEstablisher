/**
 * Permission Checking Utilities
 *
 * Functions to check user permissions based on their role.
 * Respects RBAC_ENABLED flag - when disabled, all checks pass.
 */

import {
  RBAC_ENABLED,
  DEFAULT_BYPASS_ROLE,
} from './config'
import {
  ROLE_PERMISSIONS,
  type UserRole,
  type UserStatus,
  type Permission,
} from './types'

// ============================================================================
// Permission Check Functions
// ============================================================================

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

/**
 * Check if a user can perform an action (respects RBAC_ENABLED)
 *
 * @param role - User's role
 * @param status - User's status
 * @param permission - Permission to check
 * @returns true if user can perform the action
 */
export function canPerform(
  role: UserRole | undefined,
  status: UserStatus | undefined,
  permission: Permission
): boolean {
  // When RBAC is disabled, allow all authenticated users
  if (!RBAC_ENABLED) {
    return true
  }

  // Must have a role and be active
  if (!role || !status) {
    return false
  }

  // Suspended or pending users cannot perform any actions
  if (status !== 'active') {
    return false
  }

  return roleHasPermission(role, permission)
}

/**
 * Check if user has ANY of the specified permissions
 */
export function canPerformAny(
  role: UserRole | undefined,
  status: UserStatus | undefined,
  permissions: Permission[]
): boolean {
  if (!RBAC_ENABLED) {
    return true
  }

  return permissions.some((p) => canPerform(role, status, p))
}

/**
 * Check if user has ALL of the specified permissions
 */
export function canPerformAll(
  role: UserRole | undefined,
  status: UserStatus | undefined,
  permissions: Permission[]
): boolean {
  if (!RBAC_ENABLED) {
    return true
  }

  return permissions.every((p) => canPerform(role, status, p))
}

/**
 * Check if a user is allowed to access the system at all
 */
export function isAccessAllowed(
  role: UserRole | undefined,
  status: UserStatus | undefined
): boolean {
  // When RBAC is disabled, any authenticated user is allowed
  if (!RBAC_ENABLED) {
    return true
  }

  // Must have role and be active
  if (!role || !status) {
    return false
  }

  // Only active users can access
  return status === 'active'
}

/**
 * Check if user is an admin
 */
export function isAdmin(role: UserRole | undefined): boolean {
  if (!RBAC_ENABLED) {
    return true // Everyone is effectively admin when disabled
  }
  return role === 'admin'
}

/**
 * Check if user is pending approval
 */
export function isPending(
  role: UserRole | undefined,
  status: UserStatus | undefined
): boolean {
  if (!RBAC_ENABLED) {
    return false // No one is pending when disabled
  }
  return role === 'pending' || status === 'pending'
}

// ============================================================================
// Vendor Access Checks
// ============================================================================

/**
 * Check if a vendor has access to a specific project
 */
export function vendorCanAccessProject(
  role: UserRole | undefined,
  vendorProjectIds: string[] | undefined,
  vendorExpiresAt: number | undefined,
  projectPath: string // Format: "year/projectId"
): boolean {
  if (!RBAC_ENABLED) {
    return true
  }

  // Non-vendors don't use this check
  if (role !== 'vendor') {
    return true
  }

  // Check if vendor has access to this project
  if (!vendorProjectIds || !vendorProjectIds.includes(projectPath)) {
    return false
  }

  // Check if access has expired
  if (vendorExpiresAt && Date.now() > vendorExpiresAt) {
    return false
  }

  return true
}

// ============================================================================
// Role Utilities
// ============================================================================

/**
 * Get the effective role (handles RBAC bypass)
 */
export function getEffectiveRole(role: UserRole | undefined): UserRole {
  if (!RBAC_ENABLED) {
    return DEFAULT_BYPASS_ROLE
  }
  return role || 'pending'
}

/**
 * Get the effective status (handles RBAC bypass)
 */
export function getEffectiveStatus(status: UserStatus | undefined): UserStatus {
  if (!RBAC_ENABLED) {
    return 'active'
  }
  return status || 'pending'
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Check if a role is internal (not vendor or pending)
 */
export function isInternalRole(role: UserRole): boolean {
  return role === 'admin' || role === 'accounting' || role === 'projects' || role === 'viewer'
}

// ============================================================================
// Permission Groups (for UI)
// ============================================================================

/**
 * Permission group definitions for UI display
 */
export const PERMISSION_GROUPS = {
  projects: ['projects:read', 'projects:write', 'projects:delete'] as Permission[],
  invoices: ['invoices:read', 'invoices:write', 'invoices:delete'] as Permission[],
  transactions: ['transactions:read', 'transactions:write', 'transactions:delete'] as Permission[],
  banking: ['bank_accounts:read', 'bank_accounts:write'] as Permission[],
  coaching: ['sessions:read', 'sessions:write', 'students:read', 'students:write'] as Permission[],
  admin: ['users:read', 'users:write', 'users:approve', 'audit:read'] as Permission[],
}

/**
 * Human-readable permission labels
 */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'projects:read': 'View projects',
  'projects:write': 'Edit projects',
  'projects:delete': 'Delete projects',
  'invoices:read': 'View invoices',
  'invoices:write': 'Edit invoices',
  'invoices:delete': 'Delete invoices',
  'transactions:read': 'View transactions',
  'transactions:write': 'Edit transactions',
  'transactions:delete': 'Delete transactions',
  'bank_accounts:read': 'View bank accounts',
  'bank_accounts:write': 'Edit bank accounts',
  'sessions:read': 'View sessions',
  'sessions:write': 'Edit sessions',
  'students:read': 'View students',
  'students:write': 'Edit students',
  'users:read': 'View users',
  'users:write': 'Edit users',
  'users:approve': 'Approve users',
  'audit:read': 'View audit logs',
}
