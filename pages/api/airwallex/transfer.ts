/**
 * Airwallex Transfer API Route
 *
 * POST /api/airwallex/transfer - Create a new transfer/payment
 *
 * Body:
 * - source_id: string (account to pay from)
 * - beneficiary_id: string (recipient)
 * - amount: number
 * - currency: string
 * - reference?: string
 * - reason?: string
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  createAirwallexClient,
  AirwallexApiException,
} from '../../../lib/airwallex/client'
import { getStoredToken } from './auth'
import type { AirwallexPayment } from '../../../lib/airwallex/types'

interface TransferResponse {
  success: boolean
  data?: AirwallexPayment
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TransferResponse>
) {
  if (req.method !== 'POST') {
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

    // Parse request body
    const {
      source_id,
      beneficiary_id,
      amount,
      currency,
      reference,
      reason,
    } = req.body

    // Validate required fields
    if (!source_id || !beneficiary_id || !amount || !currency) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: source_id, beneficiary_id, amount, currency',
      })
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number',
      })
    }

    // Create client and make payment (pass accountId for x-on-behalf-of header)
    const client = createAirwallexClient(stored.token.token, undefined, undefined, stored.accountId)
    const payment = await client.createPayment({
      source_id,
      beneficiary_id,
      amount,
      currency,
      reference,
      reason,
    })

    console.log('[api/airwallex/transfer] Created transfer:', {
      userId,
      paymentId: payment.id,
      amount,
      currency,
      status: payment.status,
    })

    return res.status(200).json({
      success: true,
      data: payment,
    })
  } catch (error) {
    console.error('[api/airwallex/transfer] Error:', error)

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
