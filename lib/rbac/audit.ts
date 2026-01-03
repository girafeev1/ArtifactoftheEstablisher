/**
 * Unified Audit Logging
 *
 * Provides centralized audit logging for all CRUD operations.
 * Logs are stored in Firestore at: mel-sessions/auditLogs/{id}
 */

import { getAdminFirestore } from '../firebaseAdmin'
import { AUDIT_WHEN_DISABLED, RBAC_ENABLED } from './config'
import type {
  AuditLogEntry,
  CreateAuditLogInput,
  AuditAction,
  AuditEntity,
  AuditChange,
  UserRole,
} from './types'

// Firestore config
const DEFAULT_DATABASE_ID = process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'mel-sessions'
const AUDIT_COLLECTION = 'auditLogs'

/**
 * Get the Firestore instance for audit operations
 */
function getAuditDb() {
  return getAdminFirestore(DEFAULT_DATABASE_ID)
}

// ============================================================================
// Audit Log Creation
// ============================================================================

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<string | null> {
  // Skip if RBAC and auditing are both disabled
  if (!RBAC_ENABLED && !AUDIT_WHEN_DISABLED) {
    return null
  }

  try {
    const db = getAuditDb()
    const entry: Omit<AuditLogEntry, 'id'> = {
      ...input,
      timestamp: new Date() as any, // Firestore will convert
    }

    const docRef = await db.collection(AUDIT_COLLECTION).add(entry)
    console.log(`[audit] Created log: ${input.action} ${input.entity}/${input.entityId}`)
    return docRef.id
  } catch (error) {
    console.error('[audit] Failed to create log:', error)
    // Don't throw - audit failures shouldn't break operations
    return null
  }
}

/**
 * Helper to compute field changes between old and new objects
 */
export function computeChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  fieldsToTrack?: string[]
): AuditChange[] {
  const changes: AuditChange[] = []
  const allFields = new Set([
    ...Object.keys(oldData),
    ...Object.keys(newData),
  ])

  for (const field of allFields) {
    // Skip if we have a specific list and this field isn't in it
    if (fieldsToTrack && !fieldsToTrack.includes(field)) {
      continue
    }

    // Skip internal fields
    if (field.startsWith('_') || field === 'updatedAt' || field === 'updatedBy') {
      continue
    }

    const oldValue = oldData[field]
    const newValue = newData[field]

    // Check if value changed
    if (!isEqual(oldValue, newValue)) {
      changes.push({
        field,
        oldValue: sanitizeValue(oldValue),
        newValue: sanitizeValue(newValue),
      })
    }
  }

  return changes
}

/**
 * Simple deep equality check
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    // Handle Date
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime()
    }
    // Handle Timestamp-like objects
    if (hasToMillis(a) && hasToMillis(b)) {
      return a.toMillis() === b.toMillis()
    }
    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((val, idx) => isEqual(val, b[idx]))
    }
    // Handle objects
    const keysA = Object.keys(a as object)
    const keysB = Object.keys(b as object)
    if (keysA.length !== keysB.length) return false
    return keysA.every((key) =>
      isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    )
  }

  return false
}

function hasToMillis(obj: unknown): obj is { toMillis: () => number } {
  return typeof obj === 'object' && obj !== null && 'toMillis' in obj
}

/**
 * Sanitize value for storage (convert Timestamps, limit size)
 */
function sanitizeValue(value: unknown): unknown {
  if (value == null) return null

  // Convert Timestamp-like to ISO string
  if (hasToMillis(value)) {
    return new Date(value.toMillis()).toISOString()
  }

  // Convert Date to ISO string
  if (value instanceof Date) {
    return value.toISOString()
  }

  // Limit string length
  if (typeof value === 'string' && value.length > 1000) {
    return value.substring(0, 1000) + '...'
  }

  // Limit array length
  if (Array.isArray(value) && value.length > 100) {
    return [...value.slice(0, 100), `... and ${value.length - 100} more`]
  }

  return value
}

// ============================================================================
// Audit Log Queries
// ============================================================================

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(options: {
  entity?: AuditEntity
  entityId?: string
  userId?: string
  action?: AuditAction
  fromDate?: Date
  toDate?: Date
  limit?: number
  offset?: number
}): Promise<AuditLogEntry[]> {
  const db = getAuditDb()
  let query = db.collection(AUDIT_COLLECTION).orderBy('timestamp', 'desc')

  if (options.entity) {
    query = query.where('entity', '==', options.entity)
  }

  if (options.entityId) {
    query = query.where('entityId', '==', options.entityId)
  }

  if (options.userId) {
    query = query.where('userId', '==', options.userId)
  }

  if (options.action) {
    query = query.where('action', '==', options.action)
  }

  if (options.fromDate) {
    query = query.where('timestamp', '>=', options.fromDate)
  }

  if (options.toDate) {
    query = query.where('timestamp', '<=', options.toDate)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  if (options.offset) {
    query = query.offset(options.offset)
  }

  const snapshot = await query.get()
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AuditLogEntry[]
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditLogs(
  entity: AuditEntity,
  entityId: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  return queryAuditLogs({ entity, entityId, limit })
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(
  userId: string,
  limit = 50
): Promise<AuditLogEntry[]> {
  return queryAuditLogs({ userId, limit })
}

// ============================================================================
// Convenience Functions for Common Operations
// ============================================================================

/**
 * Log a create operation
 */
export async function logCreate(
  entity: AuditEntity,
  entityId: string,
  entityPath: string,
  userId: string,
  userEmail: string,
  userRole: UserRole,
  metadata?: { ipAddress?: string; userAgent?: string; requestPath?: string }
): Promise<string | null> {
  return createAuditLog({
    action: 'create',
    entity,
    entityId,
    entityPath,
    userId,
    userEmail,
    userRole,
    metadata,
  })
}

/**
 * Log an update operation with changes
 */
export async function logUpdate(
  entity: AuditEntity,
  entityId: string,
  entityPath: string,
  userId: string,
  userEmail: string,
  userRole: UserRole,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  metadata?: { ipAddress?: string; userAgent?: string; requestPath?: string }
): Promise<string | null> {
  const changes = computeChanges(oldData, newData)

  // Don't log if no changes
  if (changes.length === 0) {
    return null
  }

  return createAuditLog({
    action: 'update',
    entity,
    entityId,
    entityPath,
    userId,
    userEmail,
    userRole,
    changes,
    metadata,
  })
}

/**
 * Log a delete operation
 */
export async function logDelete(
  entity: AuditEntity,
  entityId: string,
  entityPath: string,
  userId: string,
  userEmail: string,
  userRole: UserRole,
  metadata?: { ipAddress?: string; userAgent?: string; requestPath?: string }
): Promise<string | null> {
  return createAuditLog({
    action: 'delete',
    entity,
    entityId,
    entityPath,
    userId,
    userEmail,
    userRole,
    metadata,
  })
}

/**
 * Log a read operation (optional, use sparingly for sensitive data)
 */
export async function logRead(
  entity: AuditEntity,
  entityId: string,
  entityPath: string,
  userId: string,
  userEmail: string,
  userRole: UserRole,
  metadata?: { ipAddress?: string; userAgent?: string; requestPath?: string }
): Promise<string | null> {
  return createAuditLog({
    action: 'read',
    entity,
    entityId,
    entityPath,
    userId,
    userEmail,
    userRole,
    metadata,
  })
}
