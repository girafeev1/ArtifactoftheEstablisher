/**
 * Airwallex Card Transactions API Route
 *
 * GET /api/airwallex/card-transactions - Fetch card transactions with merchant details
 *
 * Query params:
 * - cardId: Filter by card ID (optional)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (defaults to now)
 * - pageNum: Page number (default 0)
 * - pageSize: Page size (default 50, max 100)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  createAirwallexClient,
  authenticate,
  AirwallexApiException,
} from '../../../lib/airwallex/client'
import { getStoredToken } from './auth'
import type { AirwallexCardTransaction } from '../../../lib/airwallex/types'
import { MCC_CATEGORIES } from '../../../lib/airwallex/types'
import { airwallexConfig } from '../../../lib/config/integrations'

// Build readable description from card transaction data
function buildReadableDescription(tx: AirwallexCardTransaction): string {
  const parts: string[] = []

  // Transaction type prefix
  const typePrefix = tx.transaction_type === 'AUTHORIZATION' ? 'Authorization' :
                     tx.transaction_type === 'CLEARING' ? 'Purchase' :
                     tx.transaction_type === 'REFUND' ? 'Refund' :
                     tx.transaction_type === 'REVERSAL' ? 'Reversal' :
                     tx.transaction_type === 'ORIGINAL_CREDIT' ? 'Credit' : 'Transaction'

  // Merchant info
  if (tx.merchant?.name) {
    parts.push(`${typePrefix} from ${tx.merchant.name}`)
  } else {
    parts.push(typePrefix)
  }

  // Location
  const locationParts: string[] = []
  if (tx.merchant?.city) locationParts.push(tx.merchant.city)
  if (tx.merchant?.country) locationParts.push(tx.merchant.country)
  if (locationParts.length > 0) {
    parts.push(locationParts.join(', '))
  }

  // Card info
  if (tx.card_nickname && tx.masked_card_number) {
    const lastFour = tx.masked_card_number.slice(-4)
    parts.push(`(${tx.card_nickname}, ****${lastFour})`)
  } else if (tx.masked_card_number) {
    const lastFour = tx.masked_card_number.slice(-4)
    parts.push(`(Card ****${lastFour})`)
  }

  return parts.join(', ')
}

// Get category name from MCC code
function getMerchantCategory(mccCode?: string): string | undefined {
  if (!mccCode) return undefined
  return MCC_CATEGORIES[mccCode] || `Category ${mccCode}`
}

interface EnrichedCardTransaction extends AirwallexCardTransaction {
  readable_description: string
  merchant_category_name?: string
}

interface CardTransactionsResponse {
  success: boolean
  data?: {
    transactions: EnrichedCardTransaction[]
    hasMore: boolean
    pageNum: number
    totalFetched: number
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CardTransactionsResponse>
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

    // Get stored token (for account context)
    const stored = getStoredToken(userId)
    if (!stored) {
      return res.status(401).json({
        success: false,
        error: 'Airwallex not connected. Please connect first.',
      })
    }

    // Issuing API requires dedicated Issuing credentials
    if (!airwallexConfig.hasIssuingCredentials) {
      return res.status(400).json({
        success: false,
        error: 'Issuing API requires dedicated credentials. Please configure AIRWALLEX_ISSUING_CLIENT_ID and AIRWALLEX_ISSUING_API_KEY.',
      })
    }

    // Parse query params
    const {
      cardId,
      startDate,
      endDate,
      pageNum = '0',
      pageSize = '50',
    } = req.query

    // Date range
    const fromDate = startDate
      ? new Date(startDate as string).toISOString().split('T')[0]
      : undefined
    const toDate = endDate
      ? new Date(endDate as string).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]

    // Authenticate with dedicated Issuing API credentials
    console.log('[api/airwallex/card-transactions] Authenticating with Issuing API credentials...')
    const issuingToken = await authenticate(
      airwallexConfig.issuingClientId,
      airwallexConfig.issuingApiKey,
      airwallexConfig.baseUrl
    )

    // Create client with Issuing token
    const client = createAirwallexClient(issuingToken.token, airwallexConfig.issuingClientId)
    const { transactions, hasMore } = await client.getCardTransactions({
      card_id: cardId as string | undefined,
      from_created_date: fromDate,
      to_created_date: toDate,
      page_num: parseInt(pageNum as string, 10),
      page_size: Math.min(parseInt(pageSize as string, 10), 100),
    })

    // Enrich transactions with readable descriptions
    const enrichedTransactions: EnrichedCardTransaction[] = transactions.map(tx => ({
      ...tx,
      readable_description: buildReadableDescription(tx),
      merchant_category_name: getMerchantCategory(tx.merchant?.category_code),
    }))

    console.log('[api/airwallex/card-transactions] Fetched transactions:', {
      userId,
      count: transactions.length,
      hasMore,
      dateRange: { from: fromDate, to: toDate },
    })

    return res.status(200).json({
      success: true,
      data: {
        transactions: enrichedTransactions,
        hasMore,
        pageNum: parseInt(pageNum as string, 10),
        totalFetched: transactions.length,
      },
    })
  } catch (error) {
    console.error('[api/airwallex/card-transactions] Error:', error)

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
