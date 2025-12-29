/**
 * API: POST /api/accounting/sync-project-statuses
 * Syncs project work statuses for projects where all invoices are cleared.
 *
 * This endpoint updates workStatus to 'completed' for projects that have
 * all their invoices fully paid via matched transactions.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { syncProjectWorkStatuses } from '../../../lib/accounting'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)

    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { year } = req.body

    const results = await syncProjectWorkStatuses({
      year,
      syncedBy: session.user.email || 'unknown',
    })

    const updatedCount = results.filter(r => r.updated).length
    const totalChecked = results.length

    return res.status(200).json({
      success: true,
      message: `Updated ${updatedCount} of ${totalChecked} projects`,
      updatedCount,
      totalChecked,
      results,
    })
  } catch (error) {
    console.error('[sync-project-statuses] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to sync project statuses',
    })
  }
}
