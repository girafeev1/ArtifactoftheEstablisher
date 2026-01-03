/**
 * Admin Users API - Approve User
 *
 * POST /api/admin/users/[uid]/approve
 * Approves a pending user and assigns them a role
 *
 * Body:
 * - role: UserRole (required, cannot be 'pending')
 * - vendorAccess?: VendorAccess (required if role is 'vendor')
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../../auth/[...nextauth]'
import {
  approveUser,
  getUserProfile,
  RBAC_ENABLED,
  isAdmin,
} from '../../../../../lib/rbac'
import type { UserProfile, UserRole, VendorAccess } from '../../../../../lib/rbac/types'

interface SuccessResponse {
  user: UserProfile
}

interface ErrorResponse {
  error: string
}

interface ApproveBody {
  role: UserRole
  vendorAccess?: VendorAccess
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
    const body = req.body as ApproveBody

    // Validate role
    if (!body.role) {
      return res.status(400).json({ error: 'Role is required' })
    }

    if (body.role === 'pending') {
      return res.status(400).json({ error: 'Cannot approve user with pending role' })
    }

    const validRoles: UserRole[] = ['admin', 'accounting', 'projects', 'viewer', 'vendor']
    if (!validRoles.includes(body.role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    // Vendor role requires vendorAccess
    if (body.role === 'vendor') {
      if (!body.vendorAccess || !body.vendorAccess.projectIds?.length) {
        return res.status(400).json({
          error: 'Vendor role requires vendorAccess with at least one project',
        })
      }
    }

    // Check if user exists
    const existing = await getUserProfile(uid)
    if (!existing) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Approve the user
    const approved = await approveUser(
      uid,
      body.role,
      adminEmail,
      body.role === 'vendor' ? body.vendorAccess : undefined
    )

    if (!approved) {
      return res.status(500).json({ error: 'Failed to approve user' })
    }

    console.log(`[admin/users/${uid}/approve] User approved by ${adminEmail} with role ${body.role}`)

    return res.status(200).json({ user: approved })
  } catch (error) {
    console.error(`[admin/users/${uid}/approve] Error:`, error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to approve user',
    })
  }
}
