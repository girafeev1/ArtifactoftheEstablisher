/**
 * RBAC Type Definitions
 *
 * Defines roles, permissions, and user profile structures for the
 * Role-Based Access Control system.
 */

import type { Timestamp } from 'firebase/firestore'

// ============================================================================
// Role Types
// ============================================================================

/**
 * Internal staff roles (mutually exclusive)
 */
export type InternalRole = 'admin' | 'accounting' | 'projects' | 'viewer'

/**
 * External roles
 */
export type ExternalRole = 'vendor'

/**
 * Special status role for unapproved users
 */
export type PendingRole = 'pending'

/**
 * All possible user roles
 */
export type UserRole = InternalRole | ExternalRole | PendingRole

/**
 * User account status
 */
export type UserStatus = 'pending' | 'active' | 'suspended'

// ============================================================================
// Permission Types
// ============================================================================

/**
 * Available permissions in the system
 */
export type Permission =
  // Project permissions
  | 'projects:read'
  | 'projects:write'
  | 'projects:delete'
  // Invoice permissions
  | 'invoices:read'
  | 'invoices:write'
  | 'invoices:delete'
  // Transaction permissions
  | 'transactions:read'
  | 'transactions:write'
  | 'transactions:delete'
  // Bank account permissions
  | 'bank_accounts:read'
  | 'bank_accounts:write'
  // Coaching/session permissions
  | 'sessions:read'
  | 'sessions:write'
  | 'students:read'
  | 'students:write'
  // User management permissions
  | 'users:read'
  | 'users:write'
  | 'users:approve'
  // Audit permissions
  | 'audit:read'

/**
 * Permission matrix: which roles have which permissions
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  pending: [],

  admin: [
    'projects:read', 'projects:write', 'projects:delete',
    'invoices:read', 'invoices:write', 'invoices:delete',
    'transactions:read', 'transactions:write', 'transactions:delete',
    'bank_accounts:read', 'bank_accounts:write',
    'sessions:read', 'sessions:write',
    'students:read', 'students:write',
    'users:read', 'users:write', 'users:approve',
    'audit:read',
  ],

  accounting: [
    'projects:read',
    'invoices:read', 'invoices:write',
    'transactions:read', 'transactions:write',
    'bank_accounts:read',
    'sessions:read',
    'students:read',
  ],

  projects: [
    'projects:read', 'projects:write',
    'invoices:read', 'invoices:write',
    'transactions:read',
    'sessions:read', 'sessions:write',
    'students:read', 'students:write',
  ],

  viewer: [
    'projects:read',
    'invoices:read',
    'transactions:read',
    'sessions:read',
    'students:read',
  ],

  vendor: [
    'projects:read',
    'invoices:read',
  ],
}

// ============================================================================
// User Profile Types
// ============================================================================

/**
 * Vendor-specific access configuration
 */
export interface VendorAccess {
  /** Project IDs the vendor can access (format: "year/projectId") */
  projectIds: string[]
  /** When access expires (null = no expiry) */
  expiresAt: Timestamp | null
  /** Admin who granted access */
  grantedBy?: string
  /** When access was granted */
  grantedAt?: Timestamp
  /** Optional notes about the access grant */
  notes?: string
}

/**
 * User profile stored in Firestore (users/{uid})
 */
export interface UserProfile {
  /** Firebase Auth UID */
  uid: string
  /** User's email address */
  email: string
  /** Display name from auth provider */
  displayName: string | null
  /** Profile photo URL from auth provider */
  photoURL: string | null
  /** User's assigned role */
  role: UserRole
  /** Account status */
  status: UserStatus
  /** Vendor-specific access (only for vendor role) */
  vendorAccess?: VendorAccess
  /** When the user first signed in */
  createdAt: Timestamp
  /** When the user was approved */
  approvedAt?: Timestamp
  /** Admin email who approved the user */
  approvedBy?: string
  /** Last login timestamp */
  lastLoginAt?: Timestamp
  /** Last update timestamp */
  updatedAt?: Timestamp
  /** Who made the last update */
  updatedBy?: string
}

/**
 * Input for creating a new user profile
 */
export interface CreateUserProfileInput {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
}

/**
 * Input for updating a user profile
 */
export interface UpdateUserProfileInput {
  role?: UserRole
  status?: UserStatus
  vendorAccess?: VendorAccess
  updatedBy: string
}

// ============================================================================
// Custom Claims Types
// ============================================================================

/**
 * Custom claims stored in Firebase Auth token
 */
export interface CustomClaims {
  /** User's role */
  role: UserRole
  /** Account status */
  status: UserStatus
  /** Vendor project access (only for vendors) */
  vendorProjectIds?: string[]
  /** Vendor access expiry (Unix timestamp in ms) */
  vendorExpiresAt?: number
}

// ============================================================================
// Audit Log Types
// ============================================================================

/**
 * Types of actions that can be audited
 */
export type AuditAction = 'create' | 'read' | 'update' | 'delete'

/**
 * Entity types that can be audited
 */
export type AuditEntity =
  | 'user'
  | 'project'
  | 'invoice'
  | 'transaction'
  | 'bank_account'
  | 'session'
  | 'student'
  | 'receipt'

/**
 * Field change record for update actions
 */
export interface AuditChange {
  field: string
  oldValue: unknown
  newValue: unknown
}

/**
 * Audit log entry stored in Firestore (auditLogs/{id})
 */
export interface AuditLogEntry {
  /** Auto-generated document ID */
  id?: string
  /** What action was performed */
  action: AuditAction
  /** What type of entity was affected */
  entity: AuditEntity
  /** The entity's document ID */
  entityId: string
  /** Full Firestore path to the entity */
  entityPath: string
  /** Firebase UID of the user who performed the action */
  userId: string
  /** Email of the user */
  userEmail: string
  /** Role of the user at the time of action */
  userRole: UserRole
  /** When the action occurred */
  timestamp: Timestamp
  /** Field-level changes (for updates) */
  changes?: AuditChange[]
  /** Request metadata */
  metadata?: {
    ipAddress?: string
    userAgent?: string
    requestPath?: string
  }
}

/**
 * Input for creating an audit log entry
 */
export interface CreateAuditLogInput {
  action: AuditAction
  entity: AuditEntity
  entityId: string
  entityPath: string
  userId: string
  userEmail: string
  userRole: UserRole
  changes?: AuditChange[]
  metadata?: {
    ipAddress?: string
    userAgent?: string
    requestPath?: string
  }
}

// ============================================================================
// Role Display Helpers
// ============================================================================

/**
 * Human-readable role names
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  pending: 'Pending Approval',
  admin: 'Administrator',
  accounting: 'Accounting',
  projects: 'Projects',
  viewer: 'Viewer',
  vendor: 'Vendor',
}

/**
 * Role descriptions
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  pending: 'Awaiting administrator approval',
  admin: 'Full access to all system features',
  accounting: 'Finance, invoices, and transaction management',
  projects: 'Project and client management',
  viewer: 'Read-only access to all data',
  vendor: 'Limited access to assigned projects only',
}

/**
 * Role badge colors (Ant Design tag colors)
 */
export const ROLE_COLORS: Record<UserRole, string> = {
  pending: 'orange',
  admin: 'red',
  accounting: 'blue',
  projects: 'green',
  viewer: 'default',
  vendor: 'purple',
}

/**
 * Status badge colors
 */
export const STATUS_COLORS: Record<UserStatus, string> = {
  pending: 'orange',
  active: 'green',
  suspended: 'red',
}

/**
 * Status labels
 */
export const STATUS_LABELS: Record<UserStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  suspended: 'Suspended',
}
