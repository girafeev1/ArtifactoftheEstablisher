/**
 * GCP Billing Costs API
 *
 * GET /api/gcp-billing/costs - Get cost breakdown for a date range
 *
 * Query params:
 * - startDate: YYYY-MM-DD (required)
 * - endDate: YYYY-MM-DD (required)
 * - type: 'daily' | 'breakdown' | 'monthly' (default: 'breakdown')
 * - invoiceMonth: YYYYMM (for type=monthly)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  isGCPBillingConfigured,
  getDailyCosts,
  getCostBreakdown,
  getMonthlyInvoice,
} from '../../../lib/gcpBilling'

interface ApiResponse {
  success: boolean
  data?: unknown
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
      return res.status(503).json({
        success: false,
        error: 'GCP Billing is not configured. Please set GCP_BILLING_PROJECT_ID and GCP_BILLING_DATASET_ID.',
        configured: false,
      })
    }

    const { startDate, endDate, type = 'breakdown', invoiceMonth } = req.query

    // Validate required params
    if (type === 'monthly') {
      if (!invoiceMonth || typeof invoiceMonth !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'invoiceMonth is required for monthly type (format: YYYYMM)',
          configured: true,
        })
      }

      const invoice = await getMonthlyInvoice(invoiceMonth)
      return res.status(200).json({
        success: true,
        data: invoice,
        configured: true,
      })
    }

    // For daily and breakdown, we need date range
    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required (format: YYYY-MM-DD)',
        configured: true,
      })
    }

    const query = { startDate, endDate }

    if (type === 'daily') {
      const dailyCosts = await getDailyCosts(query)
      return res.status(200).json({
        success: true,
        data: dailyCosts,
        configured: true,
      })
    }

    // Default: breakdown
    const breakdown = await getCostBreakdown(query)
    return res.status(200).json({
      success: true,
      data: breakdown,
      configured: true,
    })
  } catch (error) {
    console.error('[api/gcp-billing/costs] Error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch GCP billing data',
      configured: isGCPBillingConfigured(),
    })
  }
}
