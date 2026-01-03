/**
 * Admin Users API - Get/Update User
 *
 * GET /api/admin/users/[uid]
 * Returns a single user profile
 *
 * PATCH /api/admin/users/[uid]
 * Updates a user profile (role, status, vendorAccess)
 *
 * DELETE /api/admin/users/[uid]
 * Suspends a user (soft delete)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../auth/[...nextauth]'
import {
  getUserProfile,
  updateUserProfile,
  suspendUser,
  RBAC_ENABLED,
  isAdmin,
} from '../../../../lib/rbac'
import type { UserProfile, UserRole, UserStatus, VendorAccess } from '../../../../lib/rbac/types'

interface SuccessResponse {
  user: UserProfile
}

interface ErrorResponse {
  error: string
}

interface UpdateBody {
  role?: UserRole
  status?: UserStatus
  vendorAccess?: VendorAccess
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse | { success: boolean }>
) {
  const { uid } = req.query

  if (typeof uid !== 'string') {
    return res.status(400).json({ error: 'Invalid user ID' })
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

  const adminEmail = session.user.email || 'unknown'

  try {
    switch (req.method) {
      case 'GET': {
        const user = await getUserProfile(uid)
        if (!user) {
          return res.status(404).json({ error: 'User not found' })
        }
        return res.status(200).json({ user })
      }

      case 'PATCH': {
        const body = req.body as UpdateBody

        // Validate role if provided
        if (body.role !== undefined) {
          const validRoles: UserRole[] = ['pending', 'admin', 'accounting', 'projects', 'viewer', 'vendor']
          if (!validRoles.includes(body.role)) {
            return res.status(400).json({ error: 'Invalid role' })
          }
        }

        // Validate status if provided
        if (body.status !== undefined) {
          const validStatuses: UserStatus[] = ['pending', 'active', 'suspended']
          if (!validStatuses.includes(body.status)) {
            return res.status(400).json({ error: 'Invalid status' })
          }
        }

        const updated = await updateUserProfile(
          uid,
          {
            role: body.role,
            status: body.status,
            vendorAccess: body.vendorAccess,
          },
          adminEmail
        )

        if (!updated) {
          return res.status(404).json({ error: 'User not found' })
        }

        return res.status(200).json({ user: updated })
      }

      case 'DELETE': {
        // Soft delete = suspend
        const suspended = await suspendUser(uid, adminEmail)
        if (!suspended) {
          return res.status(404).json({ error: 'User not found' })
        }
        return res.status(200).json({ success: true })
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error(`[admin/users/${uid}] Error:`, error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
