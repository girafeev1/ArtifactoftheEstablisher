/**
 * OCBC Beneficiaries API Route
 * GET /api/ocbc/beneficiaries - List all beneficiaries
 * POST /api/ocbc/beneficiaries - Add a new beneficiary
 * DELETE /api/ocbc/beneficiaries - Remove a beneficiary
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { createOCBCClient, OCBCApiException } from '../../../lib/ocbc/client'
import type { OCBCBeneficiary, OCBCAddBeneficiaryRequest } from '../../../lib/ocbc/types'

interface BeneficiariesResponse {
  success: boolean
  data?: OCBCBeneficiary[] | { beneficiaryId: string } | { removed: boolean }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BeneficiariesResponse>
) {
  try {
    // Auth check
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)

    if (!session?.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    // Get OCBC tokens
    const ocbcAccessToken = (session as any).ocbcAccessToken
    const ocbcSessionToken = (session as any).ocbcSessionToken

    if (!ocbcAccessToken) {
      return res.status(401).json({
        success: false,
        error: 'OCBC authentication required. Please connect your OCBC account.'
      })
    }

    const client = createOCBCClient(ocbcAccessToken, ocbcSessionToken)

    switch (req.method) {
      case 'GET': {
        const beneficiaries = await client.getBeneficiaries()
        return res.status(200).json({
          success: true,
          data: beneficiaries,
        })
      }

      case 'POST': {
        const {
          beneficiaryName,
          accountNo,
          bankCode,
          fpsProxyType,
          fpsProxyValue,
          nickname,
        } = req.body as Partial<OCBCAddBeneficiaryRequest>

        if (!beneficiaryName) {
          return res.status(400).json({
            success: false,
            error: 'beneficiaryName is required',
          })
        }

        // Need either account details or FPS proxy
        if (!accountNo && !fpsProxyValue) {
          return res.status(400).json({
            success: false,
            error: 'Either accountNo or FPS proxy details (fpsProxyType + fpsProxyValue) is required',
          })
        }

        const beneficiaryId = await client.addBeneficiary({
          beneficiaryName,
          accountNo,
          bankCode,
          fpsProxyType,
          fpsProxyValue,
          nickname,
        })

        console.log('[api/ocbc/beneficiaries] Beneficiary added:', {
          userId: session.user.email,
          beneficiaryName,
          beneficiaryId,
        })

        return res.status(201).json({
          success: true,
          data: { beneficiaryId: beneficiaryId || '' },
        })
      }

      case 'DELETE': {
        const { beneficiaryId } = req.body

        if (!beneficiaryId) {
          return res.status(400).json({
            success: false,
            error: 'beneficiaryId is required',
          })
        }

        const removed = await client.removeBeneficiary(beneficiaryId)

        console.log('[api/ocbc/beneficiaries] Beneficiary removed:', {
          userId: session.user.email,
          beneficiaryId,
        })

        return res.status(200).json({
          success: true,
          data: { removed },
        })
      }

      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
        })
    }
  } catch (error) {
    console.error('[api/ocbc/beneficiaries] Error:', error)

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
