/**
 * RBAC Module
 *
 * Role-Based Access Control for the application.
 * Re-exports all RBAC utilities for convenient importing.
 */

// Configuration
export {
  RBAC_ENABLED,
  isRbacEnabled,
  logRbacStatus,
  DEFAULT_BYPASS_ROLE,
  CREATE_PROFILES_WHEN_DISABLED,
  SYNC_CLAIMS_WHEN_DISABLED,
  AUDIT_WHEN_DISABLED,
} from './config'

// Types
export type {
  InternalRole,
  ExternalRole,
  PendingRole,
  UserRole,
  UserStatus,
  Permission,
  VendorAccess,
  UserProfile,
  CreateUserProfileInput,
  UpdateUserProfileInput,
  CustomClaims,
  AuditAction,
  AuditEntity,
  AuditChange,
  AuditLogEntry,
  CreateAuditLogInput,
} from './types'

export {
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
} from './types'

// Permissions
export {
  roleHasPermission,
  canPerform,
  canPerformAny,
  canPerformAll,
  isAccessAllowed,
  isAdmin,
  isPending,
  vendorCanAccessProject,
  getEffectiveRole,
  getEffectiveStatus,
  getPermissionsForRole,
  isInternalRole,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
} from './permissions'

// Claims & Profile Management
export {
  setUserCustomClaims,
  getUserCustomClaims,
  buildClaimsFromProfile,
  syncUserClaims,
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  approveUser,
  suspendUser,
  reactivateUser,
  getOrCreateUserProfile,
  listUsers,
  countUsersByStatus,
} from './claims'

// Server-side auth utilities
export {
  checkRbac,
  redirectTo,
  withRbac,
} from './serverAuth'

export type {
  RbacCheckResult,
  RbacCheckOptions,
} from './serverAuth'

// Audit logging
export {
  createAuditLog,
  computeChanges,
  queryAuditLogs,
  getEntityAuditLogs,
  getUserAuditLogs,
  logCreate,
  logUpdate,
  logDelete,
  logRead,
} from './audit'
