/**
 * GCP Billing Evidence API
 *
 * GET /api/gcp-billing/evidence - Find GCP billing evidence for a transaction
 *
 * Query params:
 * - transactionId: string (required)
 * - transactionDate: YYYY-MM-DD (required)
 * - amount: number (required)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  isGCPBillingConfigured,
  findTransactionEvidence,
} from '../../../lib/gcpBilling'
import type { GCPTransactionEvidence } from '../../../lib/gcpBilling'

interface ApiResponse {
  success: boolean
  data?: GCPTransactionEvidence | null
  error?: string
  configured: boolean
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      configured: isGCPBillingConfigured(),
    })
  }

  try {
    // Auth check
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)

    if (!session?.user?.email) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        configured: isGCPBillingConfigured(),
      })
    }

    // Check if GCP Billing is configured
    if (!isGCPBillingConfigured()) {
      return res.status(200).json({
        success: true,
        data: null,
        configured: false,
      })
    }

    const { transactionId, transactionDate, amount } = req.query

    // Validate required params
    if (
      !transactionId ||
      !transactionDate ||
      !amount ||
      typeof transactionId !== 'string' ||
      typeof transactionDate !== 'string' ||
      typeof amount !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error: 'transactionId, transactionDate, and amount are required',
        configured: true,
      })
    }

    const evidence = await findTransactionEvidence(
      transactionDate,
      parseFloat(amount),
      transactionId
    )

    return res.status(200).json({
      success: true,
      data: evidence,
      configured: true,
    })
  } catch (error) {
    console.error('[api/gcp-billing/evidence] Error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find GCP billing evidence',
      configured: isGCPBillingConfigured(),
    })
  }
}
