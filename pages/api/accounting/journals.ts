import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  listJournalEntries,
  getJournalEntry,
  createJournalEntry,
  voidJournalEntry,
} from '../../../lib/accounting'
import type { JournalEntryInput } from '../../../lib/accounting'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const identity = session.user.email ?? session.user.name ?? 'unknown'

  try {
    if (req.method === 'GET') {
      const { id, startDate, endDate, sourceType, status, subsidiaryId, limit } = req.query

      if (id && typeof id === 'string') {
        const entry = await getJournalEntry(id)
        if (!entry) {
          return res.status(404).json({ error: 'Journal entry not found' })
        }
        return res.status(200).json({ entry })
      }

      const entries = await listJournalEntries({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        sourceType: sourceType as any,
        status: status as any,
        subsidiaryId: subsidiaryId as string | undefined,
        limitCount: limit ? parseInt(limit as string, 10) : undefined,
      })

      return res.status(200).json({ entries })
    }

    if (req.method === 'POST') {
      const body = req.body

      if (!body.postingDate || !body.lines || !Array.isArray(body.lines)) {
        return res.status(400).json({
          error: 'postingDate and lines array are required',
        })
      }

      const input: JournalEntryInput = {
        postingDate: new Date(body.postingDate),
        description: body.description, // Optional - can be generated from source metadata
        source: body.source ?? { type: 'manual' },
        lines: body.lines,
        subsidiaryId: body.subsidiaryId,
        createdBy: identity,
      }

      const entry = await createJournalEntry(input)
      return res.status(201).json({ entry })
    }

    if (req.method === 'DELETE') {
      // Void a journal entry (creates reversing entry)
      const { id } = req.query
      const { reason } = req.body ?? {}

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Journal entry ID is required' })
      }

      const result = await voidJournalEntry(id, identity, reason)
      return res.status(200).json({
        message: 'Journal entry voided',
        original: result.original,
        reversal: result.reversal,
      })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    console.error('[api/accounting/journals] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
