/**
 * RBAC Configuration
 *
 * Controls whether RBAC enforcement is enabled.
 * When disabled, all authenticated users have full access.
 */

/**
 * Whether RBAC enforcement is enabled.
 *
 * When false:
 * - All authenticated users are allowed access
 * - Role checks log but don't block
 * - Firestore rules only check authentication
 *
 * When true:
 * - Users must have appropriate role/status
 * - Pending users are blocked
 * - Full permission checking is enforced
 */
export const RBAC_ENABLED = process.env.RBAC_ENABLED === 'true'

/**
 * Check if RBAC is enabled (for use in conditionals)
 */
export function isRbacEnabled(): boolean {
  return RBAC_ENABLED
}

/**
 * Log RBAC status on startup (server-side only)
 */
export function logRbacStatus(): void {
  if (typeof window === 'undefined') {
    console.log(
      `[RBAC] Enforcement is ${RBAC_ENABLED ? 'ENABLED' : 'DISABLED'}. ` +
      `Set RBAC_ENABLED=true in environment to enforce role-based access.`
    )
  }
}

/**
 * Default role for new users when RBAC is disabled
 * (Used when we want to bypass pending status)
 */
export const DEFAULT_BYPASS_ROLE = 'admin' as const

/**
 * Whether to create user profiles even when RBAC is disabled
 * This allows populating the users collection for later enablement
 */
export const CREATE_PROFILES_WHEN_DISABLED = true

/**
 * Whether to sync custom claims even when RBAC is disabled
 * This prepares the auth tokens for when RBAC is enabled
 */
export const SYNC_CLAIMS_WHEN_DISABLED = true

/**
 * Whether to log audit entries even when RBAC is disabled
 */
export const AUDIT_WHEN_DISABLED = true
