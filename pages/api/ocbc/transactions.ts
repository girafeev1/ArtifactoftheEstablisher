/**
 * OCBC Transactions API Route
 * GET /api/ocbc/transactions - Get transaction history
 * Query params: accountNo, startDate, endDate, page, pageSize
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { createOCBCClient, OCBCApiException } from '../../../lib/ocbc/client'
import type { OCBCTransaction } from '../../../lib/ocbc/types'

interface TransactionsResponse {
  success: boolean
  data?: {
    transactions: OCBCTransaction[]
    totalRecords?: number
    hasMore?: boolean
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TransactionsResponse>
) {
  try {
    // Auth check
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)

    if (!session?.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    // Only GET method allowed
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method not allowed' })
    }

    // Get OCBC tokens
    const ocbcAccessToken = (session as any).ocbcAccessToken
    const ocbcSessionToken = (session as any).ocbcSessionToken

    if (!ocbcAccessToken) {
      return res.status(401).json({
        success: false,
        error: 'OCBC authentication required. Please connect your OCBC account.'
      })
    }

    // Parse query params
    const {
      accountNo,
      startDate,
      endDate,
      page,
      pageSize,
    } = req.query

    if (!accountNo || typeof accountNo !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'accountNo is required',
      })
    }

    const client = createOCBCClient(ocbcAccessToken, ocbcSessionToken)

    const result = await client.getTransactionHistory({
      accountNo,
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[api/ocbc/transactions] Error:', error)

    if (error instanceof OCBCApiException) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
