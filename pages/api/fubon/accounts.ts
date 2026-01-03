/**
 * Fubon Bank Accounts API Route
 *
 * GET /api/fubon/accounts - List all accounts with balances
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  createFubonClient,
  normalizeAccounts,
  FubonApiException,
} from '../../../lib/fubon'
import type { NormalizedFubonAccount } from '../../../lib/fubon'
import { getStoredFubonToken } from './auth'

interface BalanceSummary {
  currency: string
  available: number
  total: number
}

interface AccountsResponse {
  success: boolean
  data?: {
    accounts: NormalizedFubonAccount[]
    summary: {
      totalAccounts: number
      currencies: string[]
      balancesByCurrency: BalanceSummary[]
    }
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AccountsResponse>
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

    // Create client and fetch data
    const client = createFubonClient(stored.consentId, stored.tspUserId)

    // Fetch accounts and balances in parallel
    const [accountsResult, balancesResult] = await Promise.all([
      client.getAccounts(),
      client.getBalances(),
    ])

    // Normalize accounts with balances
    const normalizedAccounts = normalizeAccounts(
      accountsResult.accounts,
      balancesResult.accounts
    )

    // Calculate summary by currency
    const currencyMap = new Map<string, BalanceSummary>()

    for (const account of normalizedAccounts) {
      const existing = currencyMap.get(account.currency)
      if (existing) {
        existing.available += account.availableBalance
        existing.total += account.totalBalance
      } else {
        currencyMap.set(account.currency, {
          currency: account.currency,
          available: account.availableBalance,
          total: account.totalBalance,
        })
      }
    }

    const balancesByCurrency: BalanceSummary[] = []
    currencyMap.forEach((summary) => balancesByCurrency.push(summary))

    // Sort by total balance descending
    balancesByCurrency.sort((a, b) => b.total - a.total)

    console.log('[api/fubon/accounts] Fetched accounts:', {
      userId,
      count: normalizedAccounts.length,
      currencies: balancesByCurrency.map((b) => b.currency),
    })

    return res.status(200).json({
      success: true,
      data: {
        accounts: normalizedAccounts,
        summary: {
          totalAccounts: normalizedAccounts.length,
          currencies: balancesByCurrency.map((b) => b.currency),
          balancesByCurrency,
        },
      },
    })
  } catch (error) {
    console.error('[api/fubon/accounts] Error:', error)

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
