/**
 * API: POST /api/accounting/receipts/upload
 *
 * Upload a receipt file and create a receipt document.
 *
 * Request body (JSON):
 *   - file: Base64 encoded file data
 *   - filename: Original filename
 *   - mimeType: MIME type of the file
 *   - subsidiaryId: Subsidiary ID (default: 'erl')
 *   - referenceNumber: Optional reference for auto-matching
 *   - transactionId: Optional transaction ID for direct linking
 *   - linkMethod: 'reference' | 'manual' | 'inbox' (default: 'inbox')
 *   - memo: Optional memo
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../auth/[...nextauth]'
import { uploadReceiptToStorage } from '../../../../lib/storage/receipts'
import {
  createReceipt,
  createReceiptWithAutoMatch,
  findTransactionByReference,
} from '../../../../lib/accounting/receipts'
import { RECEIPT_ALLOWED_MIME_TYPES } from '../../../../lib/accounting/types'

// Increase body size limit to 10MB for file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

interface UploadRequestBody {
  file: string // Base64 encoded
  filename: string
  mimeType: string
  subsidiaryId?: string
  referenceNumber?: string
  transactionId?: string
  linkMethod?: 'reference' | 'manual' | 'inbox'
  memo?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const body = req.body as UploadRequestBody

    // Validate required fields
    if (!body.file || !body.filename || !body.mimeType) {
      return res.status(400).json({
        error: 'file, filename, and mimeType are required',
      })
    }

    // Validate MIME type
    if (!RECEIPT_ALLOWED_MIME_TYPES.includes(body.mimeType as any)) {
      return res.status(400).json({
        error: `Invalid file type. Allowed types: ${RECEIPT_ALLOWED_MIME_TYPES.join(', ')}`,
      })
    }

    // Decode base64 file
    const fileBuffer = Buffer.from(body.file, 'base64')
    const fileSize = fileBuffer.length

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (fileSize > maxSize) {
      return res.status(400).json({
        error: `File too large. Maximum size is 10MB.`,
      })
    }

    const subsidiaryId = body.subsidiaryId || 'erl'
    const linkMethod = body.linkMethod || 'inbox'

    // Upload to Firebase Storage
    const { storagePath, downloadUrl } = await uploadReceiptToStorage(
      fileBuffer,
      body.filename,
      body.mimeType,
      subsidiaryId
    )

    // Determine transaction ID based on link method
    let transactionId: string | undefined

    if (linkMethod === 'manual' && body.transactionId) {
      transactionId = body.transactionId
    } else if (linkMethod === 'reference' && body.referenceNumber) {
      // Try to find matching transaction
      const foundId = await findTransactionByReference(body.referenceNumber, subsidiaryId)
      if (foundId) {
        transactionId = foundId
      }
    }

    // Create receipt document
    const receipt = await createReceipt(
      {
        storagePath,
        originalFilename: body.filename,
        mimeType: body.mimeType,
        fileSize,
        referenceNumber: body.referenceNumber,
        source: 'web',
        subsidiaryId,
        uploadedBy: session.user.email,
        memo: body.memo,
      },
      transactionId
    )

    return res.status(201).json({
      receipt,
      downloadUrl,
      matched: !!transactionId,
    })
  } catch (error) {
    console.error('[api/accounting/receipts/upload] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
