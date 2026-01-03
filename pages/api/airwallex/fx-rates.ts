/**
 * Airwallex FX Rates API Route
 *
 * GET /api/airwallex/fx-rates - Get FX rates for currency conversion
 * Query params:
 *   - sell_currency: Currency to convert from (required)
 *   - buy_currency: Currency to convert to (required, can be comma-separated for multiple)
 *   - sell_amount: Amount to convert (optional, defaults to 1)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  createAirwallexClient,
  AirwallexApiException,
} from '../../../lib/airwallex/client'
import { getStoredToken } from './auth'
import type { AirwallexFxRateResponse } from '../../../lib/airwallex/types'

interface FxRateResult {
  buy_currency: string
  sell_currency: string
  rate: number
  buy_amount: number
  sell_amount: number
}

interface FxRatesResponse {
  success: boolean
  data?: {
    rates: FxRateResult[]
    sell_currency: string
    sell_amount: number
    fetched_at: string
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FxRatesResponse>
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
    const { sell_currency, buy_currency, sell_amount } = req.query

    if (!sell_currency || typeof sell_currency !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sell_currency is required',
      })
    }

    if (!buy_currency || typeof buy_currency !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'buy_currency is required',
      })
    }

    const amount = sell_amount ? parseFloat(sell_amount as string) : 1
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'sell_amount must be a positive number',
      })
    }

    // Support comma-separated buy currencies
    const buyCurrencies = buy_currency.split(',').map(c => c.trim().toUpperCase())
    const sellCurrency = sell_currency.toUpperCase()

    // Create client and fetch rates (pass accountId for x-on-behalf-of header)
    const client = createAirwallexClient(stored.token.token, undefined, undefined, stored.accountId)

    const results: FxRateResult[] = []

    // Fetch rates for each buy currency
    for (const targetCurrency of buyCurrencies) {
      if (targetCurrency === sellCurrency) {
        // Same currency - rate is 1
        results.push({
          buy_currency: targetCurrency,
          sell_currency: sellCurrency,
          rate: 1,
          buy_amount: amount,
          sell_amount: amount,
        })
        continue
      }

      try {
        const rateResponse = await client.getFxRate({
          sell_currency: sellCurrency,
          buy_currency: targetCurrency,
          sell_amount: amount,
        })

        // Extract amounts from rate_details if available
        // rate_details contains the actual conversion result
        const rateDetail = rateResponse.rate_details?.[0]

        // buy_amount tells us how much targetCurrency we get for sellAmount of sellCurrency
        // This is the most reliable field for calculating the conversion rate
        const buyAmount = rateDetail?.buy_amount ?? 0
        const sellAmount = rateDetail?.sell_amount ?? amount

        // Calculate the effective rate: how much buy_currency per 1 sell_currency
        // This ensures we always have the rate in the direction we requested
        const effectiveRate = sellAmount > 0 ? buyAmount / sellAmount : 0

        results.push({
          buy_currency: targetCurrency,
          sell_currency: sellCurrency,
          rate: effectiveRate,
          buy_amount: buyAmount,
          sell_amount: sellAmount,
        })
      } catch (error) {
        console.warn(`[api/airwallex/fx-rates] Failed to get rate for ${sellCurrency}/${targetCurrency}:`, error)
        // Skip this currency pair if it fails
      }
    }

    console.log('[api/airwallex/fx-rates] Fetched rates:', {
      userId,
      sellCurrency,
      buyCurrencies,
      amount,
      resultCount: results.length,
    })

    return res.status(200).json({
      success: true,
      data: {
        rates: results,
        sell_currency: sellCurrency,
        sell_amount: amount,
        fetched_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[api/airwallex/fx-rates] Error:', error)

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
