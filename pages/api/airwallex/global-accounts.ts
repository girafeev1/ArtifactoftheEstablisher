/**
 * Airwallex Global Accounts API Route
 *
 * GET /api/airwallex/global-accounts - List all global accounts (virtual bank accounts)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  createAirwallexClient,
  AirwallexApiException,
} from '../../../lib/airwallex/client'
import { getStoredToken } from './auth'
import type { AirwallexGlobalAccount } from '../../../lib/airwallex/types'

interface GlobalAccountsResponse {
  success: boolean
  data?: {
    globalAccounts: AirwallexGlobalAccount[]
    summary: {
      totalAccounts: number
      currencies: string[]
      bankLocations: string[]
    }
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GlobalAccountsResponse>
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

    // Create client and fetch global accounts (pass accountId for x-on-behalf-of header)
    const client = createAirwallexClient(stored.token.token, undefined, undefined, stored.accountId)
    const { globalAccounts: allAccounts } = await client.getGlobalAccounts()

    // Filter out closed/inactive accounts - only show ACTIVE accounts
    const globalAccounts = allAccounts.filter(account => account.status === 'ACTIVE')

    console.log('[api/airwallex/global-accounts] Filtering accounts:', {
      userId,
      totalFetched: allAccounts.length,
      activeCount: globalAccounts.length,
      filtered: allAccounts.filter(a => a.status !== 'ACTIVE').map(a => ({
        id: a.id,
        status: a.status,
        name: a.account_name,
      })),
    })

    // Extract unique currencies and bank locations from active accounts only
    const currencySet = new Set<string>()
    const locationSet = new Set<string>()

    for (const account of globalAccounts) {
      // Extract currencies from supported features
      for (const feature of account.supported_features || []) {
        currencySet.add(feature.currency)
      }
      // Extract bank location from institution
      if (account.institution?.address?.country_code) {
        locationSet.add(account.institution.address.country_code)
      }
    }

    console.log('[api/airwallex/global-accounts] Returning active global accounts:', {
      userId,
      count: globalAccounts.length,
      currencies: Array.from(currencySet),
    })

    return res.status(200).json({
      success: true,
      data: {
        globalAccounts,
        summary: {
          totalAccounts: globalAccounts.length,
          currencies: Array.from(currencySet).sort(),
          bankLocations: Array.from(locationSet),
        },
      },
    })
  } catch (error) {
    console.error('[api/airwallex/global-accounts] Error:', error)

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
