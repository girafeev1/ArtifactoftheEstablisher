/**
 * OCBC Transfer API Route
 * POST /api/ocbc/transfer - Initiate a fund transfer
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { createOCBCClient, OCBCApiException } from '../../../lib/ocbc/client'
import type { OCBCTransferRequest, OCBCTransferResponse, TransferType } from '../../../lib/ocbc/types'

interface TransferApiResponse {
  success: boolean
  data?: OCBCTransferResponse
  error?: string
}

const VALID_TRANSFER_TYPES: TransferType[] = ['FPS', 'CHATS', 'INTERNAL', 'RTGS', 'TT']

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TransferApiResponse>
) {
  try {
    // Auth check
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)

    if (!session?.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    // Only POST method allowed
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' })
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

    // Validate request body
    const {
      fromAccountNo,
      toAccountNo,
      beneficiaryId,
      amount,
      currency,
      transferType,
      reference,
      narrative,
      fpsProxyType,
      fpsProxyValue,
    } = req.body as Partial<OCBCTransferRequest>

    // Basic validation
    if (!fromAccountNo) {
      return res.status(400).json({
        success: false,
        error: 'fromAccountNo is required',
      })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required',
      })
    }

    if (!currency) {
      return res.status(400).json({
        success: false,
        error: 'currency is required',
      })
    }

    if (!transferType || !VALID_TRANSFER_TYPES.includes(transferType)) {
      return res.status(400).json({
        success: false,
        error: `transferType must be one of: ${VALID_TRANSFER_TYPES.join(', ')}`,
      })
    }

    // For FPS transfers, need either beneficiaryId or FPS proxy details
    if (transferType === 'FPS' && !beneficiaryId && (!fpsProxyType || !fpsProxyValue)) {
      return res.status(400).json({
        success: false,
        error: 'FPS transfer requires either beneficiaryId or FPS proxy details (fpsProxyType + fpsProxyValue)',
      })
    }

    // For non-FPS transfers, need either beneficiaryId or toAccountNo
    if (transferType !== 'FPS' && !beneficiaryId && !toAccountNo) {
      return res.status(400).json({
        success: false,
        error: 'Transfer requires either beneficiaryId or toAccountNo',
      })
    }

    const client = createOCBCClient(ocbcAccessToken, ocbcSessionToken)

    const transferRequest: OCBCTransferRequest = {
      fromAccountNo,
      toAccountNo,
      beneficiaryId,
      amount,
      currency,
      transferType,
      reference,
      narrative,
      fpsProxyType,
      fpsProxyValue,
    }

    const result = await client.initiateTransfer(transferRequest)

    // Log the transfer for audit
    console.log('[api/ocbc/transfer] Transfer initiated:', {
      userId: session.user.email,
      fromAccountNo,
      amount,
      currency,
      transferType,
      transactionId: result.transactionId,
      status: result.status,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[api/ocbc/transfer] Error:', error)

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
