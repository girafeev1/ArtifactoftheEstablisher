/**
 * API: GET /api/accounting/subsidiaries
 * Returns list of subsidiaries for the accounting filter
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { getAuthOptions } from '../auth/[...nextauth]'
import { fetchSubsidiaries } from '../../../lib/subsidiaries'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const subsidiaries = await fetchSubsidiaries()

    // Transform to the format needed by the accounting filter
    const formatted = subsidiaries.map((sub) => ({
      id: sub.identifier.toLowerCase(),
      abbr: sub.identifier,
      name: sub.englishName || sub.identifier,
    }))

    return res.status(200).json({ subsidiaries: formatted })
  } catch (err) {
    console.error('[accounting/subsidiaries] Error:', err)
    return res.status(500).json({ error: 'Failed to fetch subsidiaries' })
  }
}
