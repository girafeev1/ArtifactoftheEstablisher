/**
 * Airwallex Accounts API Route
 *
 * GET /api/airwallex/accounts - List all Airwallex accounts/wallets
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  createAirwallexClient,
  AirwallexApiException,
} from '../../../lib/airwallex/client'
import { getStoredToken } from './auth'
import type { AirwallexAccount } from '../../../lib/airwallex/types'

interface BalanceSummary {
  currency: string
  available: number
  total: number
  pending: number
}

interface AccountsResponse {
  success: boolean
  data?: {
    accounts: AirwallexAccount[]
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

    // Get stored token
    const stored = getStoredToken(userId)
    if (!stored) {
      return res.status(401).json({
        success: false,
        error: 'Airwallex not connected. Please connect first.',
      })
    }

    // Create client and fetch accounts (pass accountId for x-on-behalf-of header)
    const client = createAirwallexClient(stored.token.token, undefined, undefined, stored.accountId)
    const { accounts } = await client.getAccounts()

    // Calculate summary by currency
    const balancesByCurrency: BalanceSummary[] = []
    const currencyMap = new Map<string, BalanceSummary>()

    for (const account of accounts) {
      const existing = currencyMap.get(account.currency)
      if (existing) {
        existing.available += account.available_balance || 0
        existing.total += account.total_balance || 0
        existing.pending += account.pending_balance || 0
      } else {
        currencyMap.set(account.currency, {
          currency: account.currency,
          available: account.available_balance || 0,
          total: account.total_balance || 0,
          pending: account.pending_balance || 0,
        })
      }
    }

    currencyMap.forEach((summary) => balancesByCurrency.push(summary))
    // Filter out zero-balance currencies and sort by total balance descending
    const nonZeroBalances = balancesByCurrency.filter(b => b.total > 0 || b.pending > 0)
    nonZeroBalances.sort((a, b) => b.total - a.total)

    // Replace with filtered list
    balancesByCurrency.length = 0
    balancesByCurrency.push(...nonZeroBalances)

    console.log('[api/airwallex/accounts] Fetched accounts:', {
      userId,
      count: accounts.length,
      currencies: balancesByCurrency.map(b => b.currency),
    })

    return res.status(200).json({
      success: true,
      data: {
        accounts,
        summary: {
          totalAccounts: accounts.length,
          currencies: balancesByCurrency.map(b => b.currency),
          balancesByCurrency,
        },
      },
    })
  } catch (error) {
    console.error('[api/airwallex/accounts] Error:', error)

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
