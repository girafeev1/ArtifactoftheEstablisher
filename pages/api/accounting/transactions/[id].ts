import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../auth/[...nextauth]'
import {
  getTransaction,
  updateTransaction,
  deleteTransaction,
  matchTransactionToInvoices,
  unmatchTransaction,
} from '../../../../lib/accounting'
import type { MatchedInvoice } from '../../../../lib/accounting'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Transaction ID is required' })
  }

  try {
    if (req.method === 'GET') {
      const transaction = await getTransaction(id)

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' })
      }

      return res.status(200).json({ transaction })
    }

    if (req.method === 'PATCH') {
      const updates = req.body

      const transaction = await updateTransaction(id, updates, session.user.email || 'unknown')
      return res.status(200).json({ transaction })
    }

    if (req.method === 'DELETE') {
      await deleteTransaction(id)
      return res.status(204).end()
    }

    if (req.method === 'POST') {
      // Handle match/unmatch operations
      const { action, invoices } = req.body

      if (action === 'match') {
        if (!invoices || !Array.isArray(invoices)) {
          return res.status(400).json({ error: 'invoices array is required for matching' })
        }

        const transaction = await matchTransactionToInvoices(
          id,
          invoices as MatchedInvoice[],
          session.user.email || 'unknown'
        )
        return res.status(200).json({ transaction })
      }

      if (action === 'unmatch') {
        const transaction = await unmatchTransaction(id, session.user.email || 'unknown')
        return res.status(200).json({ transaction })
      }

      return res.status(400).json({ error: 'Invalid action. Use "match" or "unmatch"' })
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE, POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    console.error(`[api/accounting/transactions/${id}] Error:`, error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
