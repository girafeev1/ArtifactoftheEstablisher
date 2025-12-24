import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../auth/[...nextauth]'
import {
  parseCSV,
  validateCSV,
  getCSVPreview,
  createTransactionsBatch,
} from '../../../../lib/accounting'
import type { PaymentMethod } from '../../../../lib/accounting'
import type { BankPreset, CSVParseOptions } from '../../../../lib/accounting/csvParser'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const {
      csv,
      bankAccountId,
      subsidiaryId,
      preset,
      defaultCurrency,
      defaultPaymentMethod,
      filename,
      preview,
      columnMapping,
    } = req.body

    // Validate required fields
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'CSV content is required' })
    }

    // bankAccountId is optional for 'generic' preset (Claude Import) - read from CSV instead
    const isClaudeImport = preset === 'generic'
    if (!bankAccountId && !isClaudeImport) {
      return res.status(400).json({ error: 'bankAccountId is required' })
    }

    if (!subsidiaryId) {
      return res.status(400).json({ error: 'subsidiaryId is required' })
    }

    // Build parse options
    const options: CSVParseOptions = {
      bankAccountId,
      subsidiaryId,
      preset: preset as BankPreset | undefined,
      defaultCurrency: defaultCurrency || 'HKD',
      defaultPaymentMethod: (defaultPaymentMethod as PaymentMethod) || 'bank_transfer',
      columnMapping,
    }

    // Preview mode - just validate and show sample
    if (preview === true) {
      const validation = validateCSV(csv)

      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid CSV format',
          details: validation.errors,
        })
      }

      const previewData = getCSVPreview(csv, options, 5)

      return res.status(200).json({
        valid: true,
        rowCount: validation.rowCount,
        columnCount: validation.columnCount,
        headers: previewData.headers,
        preview: previewData.parsed,
      })
    }

    // Full import mode
    const validation = validateCSV(csv)

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid CSV format',
        details: validation.errors,
      })
    }

    const parseResult = parseCSV(csv, options)

    if (parseResult.transactions.length === 0) {
      return res.status(400).json({
        error: 'No valid transactions found in CSV',
        details: parseResult.errors,
        skipped: parseResult.skipped,
      })
    }

    // Create transactions in batch
    const result = await createTransactionsBatch(
      parseResult.transactions,
      session.user.email || 'unknown',
      {
        filename: filename || 'import.csv',
        importedBy: session.user.email || 'unknown',
      }
    )

    return res.status(200).json({
      success: true,
      created: result.created,
      errors: result.errors,
      parseErrors: parseResult.errors,
      skipped: parseResult.skipped,
      total: parseResult.total,
    })
  } catch (error) {
    console.error('[api/accounting/transactions/import] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
