/**
 * OCBC Accounts API Route
 * GET /api/ocbc/accounts - List all corporate accounts
 * GET /api/ocbc/accounts?accountNo=xxx - Get specific account balance
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { createOCBCClient, OCBCApiException } from '../../../lib/ocbc/client'
import type { OCBCAccount } from '../../../lib/ocbc/types'

interface AccountsResponse {
  success: boolean
  data?: OCBCAccount[] | { balance: number; availableBalance: number }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AccountsResponse>
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

    // Get OCBC tokens from session or storage
    // TODO: Implement token retrieval from secure storage
    const ocbcAccessToken = (session as any).ocbcAccessToken
    const ocbcSessionToken = (session as any).ocbcSessionToken

    if (!ocbcAccessToken) {
      return res.status(401).json({
        success: false,
        error: 'OCBC authentication required. Please connect your OCBC account.'
      })
    }

    const client = createOCBCClient(ocbcAccessToken, ocbcSessionToken)
    const { accountNo } = req.query

    if (accountNo && typeof accountNo === 'string') {
      // Get specific account balance
      const balance = await client.getAccountBalance(accountNo)
      return res.status(200).json({
        success: true,
        data: {
          balance: balance.ledgerBalance,
          availableBalance: balance.availableBalance,
        },
      })
    } else {
      // Get all accounts
      const accounts = await client.getAccounts()
      return res.status(200).json({
        success: true,
        data: accounts,
      })
    }
  } catch (error) {
    console.error('[api/ocbc/accounts] Error:', error)

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
