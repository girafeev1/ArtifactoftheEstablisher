/**
 * Admin Users API - List Users
 *
 * GET /api/admin/users
 * Returns list of all users with optional filtering
 *
 * Query params:
 * - status: 'pending' | 'active' | 'suspended'
 * - role: UserRole
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../auth/[...nextauth]'
import {
  listUsers,
  countUsersByStatus,
  RBAC_ENABLED,
  isAdmin,
} from '../../../../lib/rbac'
import type { UserStatus, UserRole, UserProfile } from '../../../../lib/rbac/types'

interface ListUsersResponse {
  users: UserProfile[]
  counts: Record<UserStatus, number>
  total: number
}

interface ErrorResponse {
  error: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListUsersResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check authentication
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Check admin permission (only when RBAC is enabled)
  if (RBAC_ENABLED && !isAdmin(session.user.role ?? undefined)) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' })
  }

  try {
    // Parse query params
    const status = req.query.status as UserStatus | undefined
    const role = req.query.role as UserRole | undefined
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    // Fetch users and counts
    const [users, counts] = await Promise.all([
      listUsers({ status, role, limit, offset }),
      countUsersByStatus(),
    ])

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

    return res.status(200).json({
      users,
      counts,
      total,
    })
  } catch (error) {
    console.error('[admin/users] Failed to list users:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list users',
    })
  }
}
