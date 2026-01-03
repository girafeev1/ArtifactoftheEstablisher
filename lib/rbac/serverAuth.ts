/**
 * Server-Side RBAC Utilities
 *
 * Helper functions for checking RBAC in getServerSideProps.
 * These respect the RBAC_ENABLED flag.
 */

import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import { getSession } from 'next-auth/react'
import { RBAC_ENABLED } from './config'
import { canPerform, isAccessAllowed } from './permissions'
import type { Permission, UserRole, UserStatus } from './types'

/**
 * Result of RBAC check
 */
export interface RbacCheckResult {
  /** Whether the user passed the check */
  allowed: boolean
  /** Redirect to this path if not allowed */
  redirectTo?: string
  /** User's role (if authenticated) */
  role?: UserRole
  /** User's status (if authenticated) */
  status?: UserStatus
  /** User's ID (if authenticated) */
  userId?: string
  /** User's email (if authenticated) */
  userEmail?: string
}

/**
 * Options for RBAC check
 */
export interface RbacCheckOptions {
  /** Required permission(s) - user must have at least one */
  requireAnyPermission?: Permission[]
  /** Required permission(s) - user must have all */
  requireAllPermissions?: Permission[]
  /** Allow only these roles */
  allowedRoles?: UserRole[]
  /** Custom redirect path (default: /auth/pending for pending, /auth/signin for unauthenticated) */
  redirectTo?: string
}

/**
 * Check RBAC in getServerSideProps
 *
 * Usage:
 * ```ts
 * export const getServerSideProps = async (ctx) => {
 *   const rbac = await checkRbac(ctx, { requireAnyPermission: ['projects:read'] })
 *   if (!rbac.allowed) {
 *     return { redirect: { destination: rbac.redirectTo!, permanent: false } }
 *   }
 *   // User is allowed, continue...
 * }
 * ```
 */
export async function checkRbac(
  ctx: GetServerSidePropsContext,
  options: RbacCheckOptions = {}
): Promise<RbacCheckResult> {
  const session = await getSession(ctx)

  // Not authenticated
  if (!session?.user) {
    return {
      allowed: false,
      redirectTo: '/auth/signin',
    }
  }

  const { role, status, id: userId, email: userEmail } = session.user

  // When RBAC is disabled, allow all authenticated users
  if (!RBAC_ENABLED) {
    return {
      allowed: true,
      role: role as UserRole,
      status: status as UserStatus,
      userId,
      userEmail: userEmail || undefined,
    }
  }

  // Check if user has basic access (not pending/suspended)
  if (!isAccessAllowed(role ?? undefined, status ?? undefined)) {
    return {
      allowed: false,
      redirectTo: options.redirectTo || '/auth/pending',
      role: role as UserRole,
      status: status as UserStatus,
      userId,
      userEmail: userEmail || undefined,
    }
  }

  // Check role whitelist
  if (options.allowedRoles && !options.allowedRoles.includes(role as UserRole)) {
    return {
      allowed: false,
      redirectTo: options.redirectTo || '/',
      role: role as UserRole,
      status: status as UserStatus,
      userId,
      userEmail: userEmail || undefined,
    }
  }

  // Check ANY permission
  if (options.requireAnyPermission) {
    const hasAny = options.requireAnyPermission.some((p) =>
      canPerform(role ?? undefined, status ?? undefined, p)
    )
    if (!hasAny) {
      return {
        allowed: false,
        redirectTo: options.redirectTo || '/',
        role: role as UserRole,
        status: status as UserStatus,
        userId,
        userEmail: userEmail || undefined,
      }
    }
  }

  // Check ALL permissions
  if (options.requireAllPermissions) {
    const hasAll = options.requireAllPermissions.every((p) =>
      canPerform(role ?? undefined, status ?? undefined, p)
    )
    if (!hasAll) {
      return {
        allowed: false,
        redirectTo: options.redirectTo || '/',
        role: role as UserRole,
        status: status as UserStatus,
        userId,
        userEmail: userEmail || undefined,
      }
    }
  }

  // All checks passed
  return {
    allowed: true,
    role: role as UserRole,
    status: status as UserStatus,
    userId,
    userEmail: userEmail || undefined,
  }
}

/**
 * Helper to create a redirect response for getServerSideProps
 */
export function redirectTo(destination: string): GetServerSidePropsResult<never> {
  return {
    redirect: {
      destination,
      permanent: false,
    },
  }
}

/**
 * Wrapper for getServerSideProps that adds RBAC checking
 *
 * Usage:
 * ```ts
 * export const getServerSideProps = withRbac(
 *   async (ctx, rbac) => {
 *     // rbac.role, rbac.userId available here
 *     return { props: { ... } }
 *   },
 *   { requireAnyPermission: ['projects:read'] }
 * )
 * ```
 */
export function withRbac<P extends { [key: string]: any }>(
  handler: (
    ctx: GetServerSidePropsContext,
    rbac: RbacCheckResult
  ) => Promise<GetServerSidePropsResult<P>>,
  options: RbacCheckOptions = {}
) {
  return async (
    ctx: GetServerSidePropsContext
  ): Promise<GetServerSidePropsResult<P>> => {
    const rbac = await checkRbac(ctx, options)

    if (!rbac.allowed) {
      return redirectTo(rbac.redirectTo || '/auth/signin')
    }

    return handler(ctx, rbac)
  }
}
