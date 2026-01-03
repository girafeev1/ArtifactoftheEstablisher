/**
 * API: /api/accounting/receipts
 *
 * GET - List receipts with optional filters
 * Query params:
 *   - status: 'inbox' | 'matched' | 'orphaned'
 *   - subsidiaryId: Filter by subsidiary
 *   - transactionId: Filter by linked transaction
 *   - limit: Max number of results
 *   - stats: 'true' to get statistics instead of list
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../auth/[...nextauth]'
import {
  listReceipts,
  getReceiptStats,
} from '../../../../lib/accounting/receipts'
import { getReceiptDownloadUrl } from '../../../../lib/storage/receipts'
import type { ReceiptStatus } from '../../../../lib/accounting/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      const {
        status,
        subsidiaryId,
        transactionId,
        limit,
        stats,
      } = req.query

      // Get stats summary
      if (stats === 'true') {
        const receiptStats = await getReceiptStats(subsidiaryId as string | undefined)
        return res.status(200).json({ stats: receiptStats })
      }

      // List receipts
      const receipts = await listReceipts({
        status: status as ReceiptStatus | undefined,
        subsidiaryId: subsidiaryId as string | undefined,
        transactionId: transactionId as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      })

      // Add download URLs to each receipt
      const receiptsWithUrls = await Promise.all(
        receipts.map(async (receipt) => {
          let downloadUrl: string | null = null
          try {
            downloadUrl = await getReceiptDownloadUrl(receipt.storagePath)
          } catch (err) {
            console.warn(`[api/receipts] Failed to get URL for ${receipt.id}:`, err)
          }
          return { ...receipt, downloadUrl }
        })
      )

      return res.status(200).json({ receipts: receiptsWithUrls })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('[api/accounting/receipts] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
