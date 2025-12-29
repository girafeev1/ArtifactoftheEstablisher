/**
 * Airwallex Transactions API Route
 *
 * GET /api/airwallex/transactions - Fetch transactions from Airwallex
 *
 * Query params:
 * - accountId: Filter by account ID
 * - startDate: ISO date string (optional, fetches all if not provided)
 * - endDate: ISO date string (defaults to now)
 * - pageNum: Page number (default 0)
 * - pageSize: Page size (default 50, max 100)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  createAirwallexClient,
  AirwallexApiException,
} from '../../../lib/airwallex/client'
import { getStoredToken } from './auth'
import type { AirwallexTransaction } from '../../../lib/airwallex/types'

interface TransactionsResponse {
  success: boolean
  data?: {
    transactions: AirwallexTransaction[]
    hasMore: boolean
    pageNum: number
    totalFetched: number
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

    // Get stored token
    const stored = getStoredToken(userId)
    if (!stored) {
      return res.status(401).json({
        success: false,
        error: 'Airwallex not connected. Please connect first.',
      })
    }

    // Parse query params
    const {
      accountId,
      startDate,
      endDate,
      pageNum = '0',
      pageSize = '50',
    } = req.query

    // Date range: optional start date, default end date is now
    // If no startDate provided, fetch ALL transactions (no from_created_at filter)
    const fromDate = startDate
      ? new Date(startDate as string).toISOString()
      : undefined
    const toDate = endDate
      ? new Date(endDate as string).toISOString()
      : new Date().toISOString()

    // Create client and fetch transactions (pass accountId for x-on-behalf-of header)
    const client = createAirwallexClient(stored.token.token, undefined, undefined, stored.accountId)
    const { transactions, hasMore } = await client.getTransactions({
      account_id: accountId as string | undefined,
      from_created_at: fromDate,
      to_created_at: toDate,
      page_num: parseInt(pageNum as string, 10),
      page_size: Math.min(parseInt(pageSize as string, 10), 100),
    })

    console.log('[api/airwallex/transactions] Fetched transactions:', {
      userId,
      count: transactions.length,
      hasMore,
      dateRange: { from: fromDate, to: toDate },
    })

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        hasMore,
        pageNum: parseInt(pageNum as string, 10),
        totalFetched: transactions.length,
      },
    })
  } catch (error) {
    console.error('[api/airwallex/transactions] Error:', error)

    if (error instanceof AirwallexApiException) {
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
