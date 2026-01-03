/**
 * API: /api/accounting/receipts/[id]
 *
 * GET - Get a single receipt with download URL
 * PATCH - Update receipt metadata (memo, referenceNumber)
 * DELETE - Delete receipt and storage file
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../auth/[...nextauth]'
import {
  getReceipt,
  updateReceipt,
  deleteReceipt,
} from '../../../../lib/accounting/receipts'
import { getReceiptDownloadUrl } from '../../../../lib/storage/receipts'

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
    if (req.method === 'GET') {
      const receipt = await getReceipt(id)
      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' })
      }

      // Get signed download URL
      let downloadUrl: string | null = null
      try {
        downloadUrl = await getReceiptDownloadUrl(receipt.storagePath)
      } catch (error) {
        console.warn(`[api/receipts/${id}] Failed to get download URL:`, error)
      }

      return res.status(200).json({ receipt, downloadUrl })
    }

    if (req.method === 'PATCH') {
      const { memo, referenceNumber } = req.body

      const receipt = await updateReceipt(
        id,
        { memo, referenceNumber },
        session.user.email
      )

      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' })
      }

      return res.status(200).json({ receipt })
    }

    if (req.method === 'DELETE') {
      await deleteReceipt(id, session.user.email)
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error(`[api/accounting/receipts/${id}] Error:`, error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
