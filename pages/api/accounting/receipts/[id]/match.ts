/**
 * API: /api/accounting/receipts/[id]/match
 *
 * POST - Match receipt to a transaction
 *   Body: { transactionId: string }
 *
 * DELETE - Unmatch receipt from its transaction
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../../auth/[...nextauth]'
import {
  matchReceiptToTransaction,
  unmatchReceipt,
  getReceipt,
} from '../../../../../lib/accounting/receipts'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Receipt ID is required' })
  }

  try {
    if (req.method === 'POST') {
      const { transactionId } = req.body

      if (!transactionId || typeof transactionId !== 'string') {
        return res.status(400).json({ error: 'transactionId is required' })
      }

      const receipt = await matchReceiptToTransaction(
        id,
        transactionId,
        session.user.email
      )

      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' })
      }

      return res.status(200).json({ receipt, matched: true })
    }

    if (req.method === 'DELETE') {
      const receipt = await unmatchReceipt(id, session.user.email)

      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' })
      }

      return res.status(200).json({ receipt, matched: false })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error(`[api/accounting/receipts/${id}/match] Error:`, error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
