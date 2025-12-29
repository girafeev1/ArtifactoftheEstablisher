/**
 * Airwallex Sync API Route
 *
 * POST /api/airwallex/sync - Import Airwallex transactions into Accounting
 *
 * Request body:
 * - startDate: ISO date string (optional, defaults to 30 days ago)
 * - endDate: ISO date string (optional, defaults to now)
 * - accountId: Airwallex account ID (optional)
 *
 * This endpoint:
 * 1. Fetches transactions from Airwallex API
 * 2. Deduplicates against existing imports
 * 3. Transforms to BankTransaction format
 * 4. Saves to Firestore
 * 5. Returns summary of imported transactions
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { Timestamp } from 'firebase/firestore'
import { v4 as uuidv4 } from 'uuid'

import {
  createAirwallexClient,
  AirwallexApiException,
} from '../../../lib/airwallex/client'
import { getStoredToken } from './auth'
import { setLastSynced } from '../../../lib/airwallex/tokenStore'
import type { AirwallexTransaction } from '../../../lib/airwallex/types'
import type { BankTransactionInput, PaymentMethod } from '../../../lib/accounting/types'
import { createTransactionsBatch } from '../../../lib/accounting/transactions'
import {
  generateTransactionHash,
  checkDuplicatesBatch,
  storeHashesBatch,
} from '../../../lib/accounting/deduplication'

interface SyncResponse {
  success: boolean
  data?: {
    imported: number
    skipped: number
    errors: string[]
    syncId: string
    dateRange: { start: string; end: string }
  }
  error?: string
}

/**
 * Transform Airwallex transaction to BankTransaction format
 */
function transformTransaction(
  tx: AirwallexTransaction,
  syncId: string,
  userId: string
): BankTransactionInput {
  // Determine if debit or credit
  const isDebit = tx.type === 'debit'

  // Extract payer name from counterparty or description
  const payerName = tx.counterparty?.name ||
    tx.description ||
    (isDebit ? 'Outgoing Payment' : 'Incoming Payment')

  // Infer payment method from transaction
  let paymentMethod: PaymentMethod = 'bank_transfer'
  const desc = (tx.description || '').toLowerCase()
  if (desc.includes('card') || desc.includes('visa') || desc.includes('mastercard')) {
    paymentMethod = 'credit_card'
  } else if (desc.includes('cash')) {
    paymentMethod = 'cash'
  }

  return {
    transactionDate: new Date(tx.created_at),
    amount: Math.abs(tx.amount),
    isDebit,
    currency: tx.currency || 'USD',
    bankAccountId: 'ERL-AWX-S', // Airwallex account
    paymentMethod,
    referenceNumber: tx.reference || tx.id,
    payerName,
    payerReference: tx.counterparty?.account_number,
    displayName: undefined, // Will be set by user or auto-linker
    originalDescription: tx.description,
    subsidiaryId: 'erl',
    source: 'api_import',
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SyncResponse>
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
    const { startDate, endDate, accountId } = req.body

    // Default date range: last 30 days
    const defaultStartDate = new Date()
    defaultStartDate.setDate(defaultStartDate.getDate() - 30)

    const fromDate = startDate ? new Date(startDate) : defaultStartDate
    const toDate = endDate ? new Date(endDate) : new Date()

    // Generate sync ID for this batch
    const syncId = uuidv4()

    console.log('[api/airwallex/sync] Starting sync:', {
      userId,
      syncId,
      dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    })

    // Fetch all transactions from Airwallex (pass accountId for x-on-behalf-of header)
    const client = createAirwallexClient(stored.token.token, undefined, undefined, stored.accountId)
    const transactions = await client.getAllTransactions(
      fromDate.toISOString(),
      toDate.toISOString(),
      accountId
    )

    console.log('[api/airwallex/sync] Fetched transactions:', transactions.length)

    if (transactions.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          imported: 0,
          skipped: 0,
          errors: [],
          syncId,
          dateRange: { start: fromDate.toISOString(), end: toDate.toISOString() },
        },
      })
    }

    // Check for duplicates
    const hashInputs = transactions.map(tx => ({
      externalId: tx.id,
      date: new Date(tx.created_at),
      amount: tx.amount,
      description: tx.description || '',
      source: 'airwallex' as const,
    }))

    const duplicateResults = await checkDuplicatesBatch(hashInputs)

    // Filter out duplicates
    const newTransactions: AirwallexTransaction[] = []
    const skippedCount = { count: 0 }

    for (const tx of transactions) {
      const key = tx.id
      const result = duplicateResults.get(key)

      if (result?.isDuplicate) {
        skippedCount.count++
      } else {
        newTransactions.push(tx)
      }
    }

    console.log('[api/airwallex/sync] After deduplication:', {
      total: transactions.length,
      new: newTransactions.length,
      skipped: skippedCount.count,
    })

    if (newTransactions.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          imported: 0,
          skipped: skippedCount.count,
          errors: [],
          syncId,
          dateRange: { start: fromDate.toISOString(), end: toDate.toISOString() },
        },
      })
    }

    // Transform to BankTransaction format
    const bankTransactions: BankTransactionInput[] = newTransactions.map(tx =>
      transformTransaction(tx, syncId, userId)
    )

    // Save to Firestore
    const importBatch = {
      filename: 'airwallex-api',
      importedBy: userId,
      provider: 'airwallex' as const,
      syncId,
    }
    const result = await createTransactionsBatch(bankTransactions, userId, importBatch)

    // Store hashes for successful imports
    if (result.created > 0) {
      const hashEntries = newTransactions.slice(0, result.created).map((tx) => {
        const hashInput = {
          externalId: tx.id,
          date: new Date(tx.created_at),
          amount: tx.amount,
          description: tx.description || '',
          source: 'airwallex' as const,
        }

        return {
          hash: generateTransactionHash(hashInput),
          transactionId: tx.id, // Use external ID as transaction reference
          source: 'airwallex' as const,
          externalId: tx.id,
        }
      })

      await storeHashesBatch(hashEntries)
    }

    // Update last synced timestamp
    setLastSynced(userId, Date.now())

    console.log('[api/airwallex/sync] Sync complete:', {
      syncId,
      imported: result.created,
      skipped: skippedCount.count,
      errors: result.errors.length,
    })

    return res.status(200).json({
      success: true,
      data: {
        imported: result.created,
        skipped: skippedCount.count,
        errors: result.errors,
        syncId,
        dateRange: { start: fromDate.toISOString(), end: toDate.toISOString() },
      },
    })
  } catch (error) {
    console.error('[api/airwallex/sync] Error:', error)

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
