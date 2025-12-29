import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  getDerivedJournalEntries,
  getDerivedJournalEntry,
} from '../../../lib/accounting/derivedJournals'

/**
 * Journal Entries API
 *
 * Journal entries are now DERIVED from invoices and transactions, not stored.
 * This provides:
 * - Simplicity: No create/void cycle
 * - Consistency: Always reflects current state
 * - Flexibility: Re-matching doesn't require journal management
 *
 * POST and DELETE are no longer supported as entries are computed on-the-fly.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      const { id, subsidiaryId, limit } = req.query

      // Get single entry by ID
      if (id && typeof id === 'string') {
        const entry = await getDerivedJournalEntry(id)
        if (!entry) {
          return res.status(404).json({ error: 'Journal entry not found' })
        }
        return res.status(200).json({ entry })
      }

      // Get all derived entries
      const entries = await getDerivedJournalEntries({
        subsidiaryId: subsidiaryId as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      })

      return res.status(200).json({ entries })
    }

    // POST and DELETE are no longer supported - entries are derived
    if (req.method === 'POST' || req.method === 'DELETE') {
      return res.status(400).json({
        error: 'Journal entries are now derived from invoices and transactions. Manual creation/deletion is not supported.',
      })
    }

    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    console.error('[api/accounting/journals] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
