/**
 * Admin Audit Logs API
 *
 * GET /api/admin/audit-logs
 * Returns audit log entries with optional filtering
 *
 * Query params:
 * - entity: AuditEntity
 * - entityId: string
 * - userId: string
 * - action: AuditAction
 * - fromDate: ISO date string
 * - toDate: ISO date string
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  queryAuditLogs,
  RBAC_ENABLED,
  isAdmin,
} from '../../../lib/rbac'
import type { AuditLogEntry, AuditEntity, AuditAction } from '../../../lib/rbac/types'

interface ListAuditLogsResponse {
  logs: AuditLogEntry[]
  hasMore: boolean
}

interface ErrorResponse {
  error: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListAuditLogsResponse | ErrorResponse>
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
    const entity = req.query.entity as AuditEntity | undefined
    const entityId = req.query.entityId as string | undefined
    const userId = req.query.userId as string | undefined
    const action = req.query.action as AuditAction | undefined
    const fromDate = req.query.fromDate
      ? new Date(req.query.fromDate as string)
      : undefined
    const toDate = req.query.toDate
      ? new Date(req.query.toDate as string)
      : undefined
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    // Fetch logs (request one extra to check if there are more)
    const logs = await queryAuditLogs({
      entity,
      entityId,
      userId,
      action,
      fromDate,
      toDate,
      limit: limit + 1,
      offset,
    })

    const hasMore = logs.length > limit
    const returnedLogs = hasMore ? logs.slice(0, limit) : logs

    return res.status(200).json({
      logs: returnedLogs,
      hasMore,
    })
  } catch (error) {
    console.error('[admin/audit-logs] Failed to query logs:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to query audit logs',
    })
  }
}
