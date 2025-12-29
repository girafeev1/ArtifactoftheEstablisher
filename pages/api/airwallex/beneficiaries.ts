/**
 * Airwallex Beneficiaries API Route
 *
 * GET /api/airwallex/beneficiaries - List all beneficiaries
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  createAirwallexClient,
  AirwallexApiException,
} from '../../../lib/airwallex/client'
import { getStoredToken } from './auth'
import type { AirwallexBeneficiary } from '../../../lib/airwallex/types'

interface BeneficiariesResponse {
  success: boolean
  data?: {
    beneficiaries: AirwallexBeneficiary[]
    hasMore: boolean
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BeneficiariesResponse>
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
    const { pageNum = '0', pageSize = '50' } = req.query

    // Create client and fetch beneficiaries (pass accountId for x-on-behalf-of header)
    const client = createAirwallexClient(stored.token.token, undefined, undefined, stored.accountId)
    const { beneficiaries, hasMore } = await client.getBeneficiaries(
      parseInt(pageNum as string, 10),
      Math.min(parseInt(pageSize as string, 10), 100)
    )

    console.log('[api/airwallex/beneficiaries] Fetched beneficiaries:', {
      userId,
      count: beneficiaries.length,
      hasMore,
    })

    return res.status(200).json({
      success: true,
      data: {
        beneficiaries,
        hasMore,
      },
    })
  } catch (error) {
    console.error('[api/airwallex/beneficiaries] Error:', error)

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
