/**
 * Fubon Bank Transactions API Route
 *
 * GET /api/fubon/transactions - List transactions
 *
 * Query params:
 * - accountId: Filter by account
 * - fromDate: Start date (ISO 8601)
 * - toDate: End date (ISO 8601)
 * - pageSize: Number of items per page
 * - pageIdx: Page index
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  createFubonClient,
  normalizeTransactions,
  FubonApiException,
} from '../../../lib/fubon'
import type { NormalizedFubonTransaction } from '../../../lib/fubon'
import { getStoredFubonToken } from './auth'

interface TransactionsResponse {
  success: boolean
  data?: {
    transactions: NormalizedFubonTransaction[]
    hasMore: boolean
    totalElements: number
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TransactionsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    // Auth check
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)

    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const userId = session.user.email

    // Get stored connection
    const stored = getStoredFubonToken(userId)
    if (!stored) {
      return res.status(401).json({
        success: false,
        error: 'Fubon not connected. Please connect first.',
      })
    }

    // Parse query params
    const {
      accountId,
      fromDate,
      toDate,
      pageSize = '50',
      pageIdx = '1',
    } = req.query

    // Create client
    const client = createFubonClient(stored.consentId, stored.tspUserId)

    // Fetch transactions
    let result
    if (accountId && typeof accountId === 'string') {
      result = await client.getAccountTransactions(accountId, {
        pageSize: parseInt(pageSize as string, 10),
        pageIdx: parseInt(pageIdx as string, 10),
      })
    } else {
      result = await client.getTransactions({
        fromDateTime: fromDate as string | undefined,
        toDateTime: toDate as string | undefined,
        pageSize: parseInt(pageSize as string, 10),
        pageIdx: parseInt(pageIdx as string, 10),
      })
    }

    // Normalize transactions
    const normalizedTransactions = normalizeTransactions(result.transactions)

    console.log('[api/fubon/transactions] Fetched transactions:', {
      userId,
      count: normalizedTransactions.length,
      hasMore: result.hasMore,
      accountId: accountId || 'all',
    })

    return res.status(200).json({
      success: true,
      data: {
        transactions: normalizedTransactions,
        hasMore: result.hasMore,
        totalElements: result.totalElements,
      },
    })
  } catch (error) {
    console.error('[api/fubon/transactions] Error:', error)

    if (error instanceof FubonApiException) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
