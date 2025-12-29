/**
 * Bank Transaction Operations
 *
 * CRUD operations for bank transactions stored in Firestore.
 * Supports evidence-based payment tracking with manual entry and CSV import.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
  writeBatch,
} from 'firebase/firestore'
import { projectsDb } from '../firebase'
import type {
  BankTransaction,
  BankTransactionInput,
  MatchedInvoice,
  TransactionStatus,
  TransactionSource,
  PaymentMethod,
  ImportBatch,
} from './types'
import { ACCOUNTING_COLLECTION, TRANSACTIONS_SUBCOLLECTION } from './types'
import { fetchInvoicesForProject } from '../projectInvoices'
import { updateProjectInDatabase } from '../projectsDatabase'
// Journal entries are now derived on-the-fly from invoices and transactions
// No longer need to import journal posting functions
// Payment data is also derived from transactions at read time (no storage on invoices)

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the Firestore collection reference for transactions.
 */
function getTransactionsCollection() {
  // Path: accounting/transactions/entries/{transactionId}
  return collection(projectsDb, ACCOUNTING_COLLECTION, TRANSACTIONS_SUBCOLLECTION, 'entries')
}

/**
 * Get the total amount paid for an invoice from all matched transactions.
 * Used for validation during matching and for deriving payment status.
 *
 * @param invoiceNumber - The invoice number to look up
 * @param projectId - The project ID
 * @param year - The year
 * @param excludeTransactionId - Optional transaction ID to exclude (for re-matching scenarios)
 * @returns Total amount paid from transactions
 */
export async function getInvoiceAmountPaidFromTransactions(
  invoiceNumber: string,
  projectId: string,
  year: string,
  excludeTransactionId?: string
): Promise<number> {
  // Fetch all matched and partial transactions
  const matchedQuery = query(
    getTransactionsCollection(),
    where('status', 'in', ['matched', 'partial'])
  )
  const snapshot = await getDocs(matchedQuery)

  let totalPaid = 0
  snapshot.forEach((doc) => {
    if (excludeTransactionId && doc.id === excludeTransactionId) {
      return // Skip excluded transaction
    }
    const data = doc.data() as BankTransaction
    const matchedInvoices = data.matchedInvoices || []
    for (const inv of matchedInvoices) {
      if (
        inv.invoiceNumber === invoiceNumber &&
        inv.projectId === projectId &&
        inv.year === year
      ) {
        totalPaid += inv.amount
      }
    }
  })

  return totalPaid
}

/**
 * Get payment info for an invoice from transactions.
 * Returns the first matching transaction's date and bank account for display.
 *
 * @param invoiceNumber - The invoice number
 * @param projectId - The project ID
 * @param year - The year
 * @returns Payment info or null if no payments found
 */
export async function getInvoicePaymentInfo(
  invoiceNumber: string,
  projectId: string,
  year: string
): Promise<{ paidOn: Date; paidTo: string; amountPaid: number } | null> {
  const matchedQuery = query(
    getTransactionsCollection(),
    where('status', 'in', ['matched', 'partial']),
    orderBy('transactionDate', 'desc')
  )
  const snapshot = await getDocs(matchedQuery)

  let amountPaid = 0
  let latestDate: Date | null = null
  let bankAccountId: string | null = null

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as BankTransaction
    const matchedInvoices = data.matchedInvoices || []
    for (const inv of matchedInvoices) {
      if (
        inv.invoiceNumber === invoiceNumber &&
        inv.projectId === projectId &&
        inv.year === year
      ) {
        amountPaid += inv.amount
        // Use the most recent transaction's date and bank
        if (!latestDate) {
          latestDate = data.transactionDate instanceof Timestamp
            ? data.transactionDate.toDate()
            : new Date(data.transactionDate as any)
          bankAccountId = data.bankAccountId
        }
      }
    }
  })

  if (amountPaid > 0 && latestDate && bankAccountId) {
    return { paidOn: latestDate, paidTo: bankAccountId, amountPaid }
  }
  return null
}

/**
 * Convert a Date to a Firestore Timestamp.
 */
function toTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date)
}

// ============================================================================
// Transaction CRUD Operations
// ============================================================================

/**
 * Create a new bank transaction.
 */
export async function createTransaction(
  input: BankTransactionInput,
  createdBy: string
): Promise<BankTransaction> {
  const transactionsCol = getTransactionsCollection()

  const transactionData: Omit<BankTransaction, 'id'> = {
    transactionDate: toTimestamp(input.transactionDate),
    amount: input.amount,
    isDebit: input.isDebit ?? false,
    currency: input.currency,
    bankAccountId: input.bankAccountId,
    paymentMethod: input.paymentMethod,
    referenceNumber: input.referenceNumber,
    payerName: input.payerName,
    payerReference: input.payerReference,
    status: 'unmatched' as TransactionStatus,
    source: input.source,
    importBatch: input.importBatch
      ? {
          filename: input.importBatch.filename,
          importedAt: input.importBatch.importedAt
            ? toTimestamp(input.importBatch.importedAt)
            : (serverTimestamp() as unknown as Timestamp),
          importedBy: input.importBatch.importedBy || createdBy,
        }
      : undefined,
    subsidiaryId: input.subsidiaryId,
    memo: input.memo,
    supportingDocument: input.supportingDocument,
    createdAt: serverTimestamp() as unknown as Timestamp,
    createdBy,
  }

  // Remove undefined fields
  const cleanData = Object.fromEntries(
    Object.entries(transactionData).filter(([, v]) => v !== undefined)
  )

  const docRef = await addDoc(transactionsCol, cleanData)

  const created = await getDoc(docRef)
  return { ...created.data(), id: created.id } as BankTransaction
}

/**
 * Create multiple transactions in batch (for CSV import).
 */
export async function createTransactionsBatch(
  inputs: BankTransactionInput[],
  createdBy: string,
  importBatch: Omit<ImportBatch, 'importedAt'> & { importedAt?: Date }
): Promise<{ created: number; errors: string[] }> {
  const transactionsCol = getTransactionsCollection()
  const batch = writeBatch(projectsDb)
  const errors: string[] = []
  let created = 0

  const batchData: ImportBatch = {
    filename: importBatch.filename,
    importedAt: importBatch.importedAt
      ? toTimestamp(importBatch.importedAt)
      : (serverTimestamp() as unknown as Timestamp),
    importedBy: importBatch.importedBy,
  }

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    try {
      const docRef = doc(transactionsCol)

      const transactionData: Omit<BankTransaction, 'id'> = {
        transactionDate: toTimestamp(input.transactionDate),
        amount: input.amount,
        isDebit: input.isDebit ?? false,
        currency: input.currency,
        bankAccountId: input.bankAccountId,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber,
        payerName: input.payerName,
        payerReference: input.payerReference,
        status: 'unmatched' as TransactionStatus,
        source: 'csv_import' as TransactionSource,
        importBatch: batchData,
        subsidiaryId: input.subsidiaryId,
        memo: input.memo,
        createdAt: serverTimestamp() as unknown as Timestamp,
        createdBy,
      }

      // Remove undefined fields
      const cleanData = Object.fromEntries(
        Object.entries(transactionData).filter(([, v]) => v !== undefined)
      )

      batch.set(docRef, cleanData)
      created++
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (created > 0) {
    await batch.commit()
  }

  return { created, errors }
}

/**
 * Get a transaction by ID.
 */
export async function getTransaction(id: string): Promise<BankTransaction | null> {
  const transactionRef = doc(getTransactionsCollection(), id)
  const snapshot = await getDoc(transactionRef)

  if (!snapshot.exists()) {
    return null
  }

  return { ...snapshot.data(), id: snapshot.id } as BankTransaction
}

/**
 * List transactions with optional filters.
 */
export async function listTransactions(options?: {
  startDate?: Date
  endDate?: Date
  status?: TransactionStatus
  bankAccountId?: string
  subsidiaryId?: string
  source?: TransactionSource
  limitCount?: number
}): Promise<BankTransaction[]> {
  const transactionsCol = getTransactionsCollection()
  const constraints: Parameters<typeof query>[1][] = []

  if (options?.startDate) {
    constraints.push(where('transactionDate', '>=', toTimestamp(options.startDate)))
  }

  if (options?.endDate) {
    constraints.push(where('transactionDate', '<=', toTimestamp(options.endDate)))
  }

  if (options?.status) {
    constraints.push(where('status', '==', options.status))
  }

  if (options?.bankAccountId) {
    constraints.push(where('bankAccountId', '==', options.bankAccountId))
  }

  if (options?.subsidiaryId) {
    constraints.push(where('subsidiaryId', '==', options.subsidiaryId))
  }

  if (options?.source) {
    constraints.push(where('source', '==', options.source))
  }

  constraints.push(orderBy('transactionDate', 'desc'))

  if (options?.limitCount) {
    constraints.push(limit(options.limitCount))
  }

  const q = query(transactionsCol, ...constraints)
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as BankTransaction))
}

/**
 * Update a transaction.
 */
export async function updateTransaction(
  id: string,
  updates: Partial<
    Pick<
      BankTransaction,
      | 'payerName'
      | 'payerReference'
      | 'referenceNumber'
      | 'memo'
      | 'supportingDocument'
      | 'paymentMethod'
      | 'accountCode'
      | 'status'
      | 'displayName'
    >
  >,
  updatedBy: string
): Promise<BankTransaction> {
  const transactionRef = doc(getTransactionsCollection(), id)
  const existing = await getDoc(transactionRef)

  if (!existing.exists()) {
    throw new Error(`Transaction ${id} not found`)
  }

  await updateDoc(transactionRef, {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy,
  })

  const updated = await getDoc(transactionRef)
  return { ...updated.data(), id: updated.id } as BankTransaction
}

/**
 * Delete a transaction (only allowed for unmatched transactions).
 */
export async function deleteTransaction(id: string): Promise<void> {
  const transactionRef = doc(getTransactionsCollection(), id)
  const existing = await getDoc(transactionRef)

  if (!existing.exists()) {
    throw new Error(`Transaction ${id} not found`)
  }

  const data = existing.data() as BankTransaction
  if (data.status !== 'unmatched') {
    throw new Error(`Cannot delete a matched or partially matched transaction`)
  }

  await deleteDoc(transactionRef)
}

// ============================================================================
// Invoice Matching Operations
// ============================================================================

/**
 * Calculate invoice total from item data (same logic as matchable-invoices API).
 */
function calculateInvoiceTotal(data: Record<string, any>): number {
  let total = 0
  const itemsCount = data.itemsCount || 0

  for (let i = 1; i <= itemsCount; i++) {
    const price = data[`item${i}UnitPrice`] || 0
    const qty = data[`item${i}Quantity`] || 0
    const discount = data[`item${i}Discount`] || 0
    total += (price * qty) - discount
  }

  const taxPercent = data.taxOrDiscountPercent || 0
  total = total * (1 + taxPercent / 100)

  return Math.round(total * 100) / 100
}

/**
 * Match a transaction to one or more invoices.
 *
 * This function implements bidirectional linking:
 * - Transaction stores matchedInvoices[] with paidJournalId for voiding
 * - Invoice stores linkedTransactions[] for payment tracking
 *
 * Invoice is marked 'Cleared' only when fully paid (amountPaid >= total).
 *
 * @param transactionId - The transaction to match
 * @param invoices - Array of invoices with amounts to apply
 * @param updatedBy - User performing the match
 * @returns Updated transaction with enriched matchedInvoices
 */
export async function matchTransactionToInvoices(
  transactionId: string,
  invoices: MatchedInvoice[],
  updatedBy: string
): Promise<BankTransaction> {
  const transactionRef = doc(getTransactionsCollection(), transactionId)
  const existing = await getDoc(transactionRef)

  if (!existing.exists()) {
    throw new Error(`Transaction ${transactionId} not found`)
  }

  const transaction = existing.data() as BankTransaction

  // Get existing matched invoices to combine with new ones
  const existingMatchedInvoices: MatchedInvoice[] = transaction.matchedInvoices || []
  const existingMatchedAmount = existingMatchedInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  // Calculate total with new invoices
  const newInvoicesAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0)
  const totalMatched = existingMatchedAmount + newInvoicesAmount

  // Validate total matched amount doesn't exceed transaction amount
  if (totalMatched > transaction.amount + 0.01) {
    throw new Error(
      `Total matched amount (${totalMatched}) exceeds transaction amount (${transaction.amount})`
    )
  }

  // Determine transaction status based on TOTAL matched (existing + new)
  let newStatus: TransactionStatus
  if (Math.abs(totalMatched - transaction.amount) < 0.01) {
    newStatus = 'matched'
  } else if (totalMatched > 0) {
    newStatus = 'partial'
  } else {
    newStatus = 'unmatched'
  }

  const transactionDate = transaction.transactionDate
  const bankAccountId = transaction.bankAccountId

  // Process each invoice - validate only, no writes to invoice
  // Payment data is now derived from transactions at read time
  const enrichedInvoices: MatchedInvoice[] = []

  for (const inv of invoices) {
    try {
      const invoiceRef = doc(
        projectsDb,
        'projects',
        inv.year,
        'projects',
        inv.projectId,
        'invoice',
        inv.invoiceNumber
      )

      const invoiceDoc = await getDoc(invoiceRef)
      if (!invoiceDoc.exists()) {
        console.error(`Invoice ${inv.invoiceNumber} not found`)
        continue
      }

      const invoiceData = invoiceDoc.data()
      const invoiceTotal = calculateInvoiceTotal(invoiceData)

      // Check existing payment from OTHER transactions on this invoice
      // by finding all matched transactions that reference this invoice
      const existingPaymentAmount = await getInvoiceAmountPaidFromTransactions(
        inv.invoiceNumber,
        inv.projectId,
        inv.year,
        transactionId // exclude current transaction being matched
      )

      const newAmountPaid = existingPaymentAmount + inv.amount

      // Validate not overpaying
      if (newAmountPaid > invoiceTotal + 0.01) {
        throw new Error(
          `Invoice ${inv.invoiceNumber}: would overpay (${newAmountPaid} > ${invoiceTotal})`
        )
      }

      // NOTE: No invoice update needed!
      // Journal entries and payment status are derived at read time from:
      // 1. Transaction's matchedInvoices[] for payment data
      // 2. Invoice's paymentStatus for Draft/Due status

      enrichedInvoices.push(inv)

    } catch (error) {
      console.error(`Failed to process invoice ${inv.invoiceNumber}:`, error)
      throw error // Re-throw to prevent partial matching
    }
  }

  // Update transaction with combined matchedInvoices (existing + new)
  const allMatchedInvoices = [...existingMatchedInvoices, ...enrichedInvoices]

  // Build descriptive displayName from the first matched invoice's project data
  let newDisplayName: string | undefined
  if (allMatchedInvoices.length > 0) {
    const firstInv = allMatchedInvoices[0]
    try {
      const projectRef = doc(projectsDb, 'projects', firstInv.year, 'projects', firstInv.projectId)
      const projectDoc = await getDoc(projectRef)
      if (projectDoc.exists()) {
        const projectData = projectDoc.data()
        const parts: string[] = ['Payment']

        // Add client company if available
        if (projectData.clientCompany) {
          parts.push(projectData.clientCompany)
        }

        // Add presenter/workType if available
        if (projectData.presenterWorkType) {
          parts.push(projectData.presenterWorkType)
        }

        // Add project title if available
        if (projectData.projectTitle) {
          parts.push(projectData.projectTitle)
        }

        // Add invoice number(s)
        if (allMatchedInvoices.length === 1) {
          newDisplayName = `${parts.join(' - ')} #${firstInv.invoiceNumber}`
        } else {
          // Multiple invoices - list all invoice numbers
          const invoiceNumbers = allMatchedInvoices.map(inv => inv.invoiceNumber).join(', #')
          newDisplayName = `${parts.join(' - ')} #${invoiceNumbers}`
        }
      }
    } catch (err) {
      console.warn('[matchTransactionToInvoices] Failed to fetch project data for displayName:', err)
    }
  }

  await updateDoc(transactionRef, {
    matchedInvoices: allMatchedInvoices,
    status: newStatus,
    ...(newDisplayName && { displayName: newDisplayName }),
    updatedAt: serverTimestamp(),
    updatedBy,
  })

  // Auto-complete project work status when all invoices are cleared
  // Collect unique projects from matched invoices
  const projectsToCheck = new Map<string, { year: string; projectId: string }>()
  for (const inv of enrichedInvoices) {
    const key = `${inv.year}/${inv.projectId}`
    if (!projectsToCheck.has(key)) {
      projectsToCheck.set(key, { year: inv.year, projectId: inv.projectId })
    }
  }

  // Check each project - if all invoices are cleared, set workStatus to 'completed'
  // Build a map of amounts from the current transaction (which might not be queryable yet)
  const currentTransactionAmounts = new Map<string, number>()
  for (const inv of allMatchedInvoices) {
    const key = `${inv.year}/${inv.projectId}/${inv.invoiceNumber}`
    currentTransactionAmounts.set(key, (currentTransactionAmounts.get(key) || 0) + inv.amount)
  }

  for (const { year, projectId } of projectsToCheck.values()) {
    try {
      const allInvoices = await fetchInvoicesForProject(year, projectId)
      // Filter out soft-deleted invoices
      const activeInvoices = allInvoices.filter((inv) => !inv.deletedAt)

      if (activeInvoices.length === 0) {
        continue // No active invoices, skip
      }

      let allCleared = true
      for (const invoice of activeInvoices) {
        const invoiceTotal = invoice.total ?? 0
        if (invoiceTotal <= 0) {
          continue // Zero-amount invoice, skip
        }

        // Get amount paid from OTHER transactions (exclude current one to avoid double-counting)
        const otherTransactionsAmount = await getInvoiceAmountPaidFromTransactions(
          invoice.invoiceNumber,
          projectId,
          year,
          transactionId // exclude current transaction
        )

        // Add amount from current transaction (using our known data)
        const currentTxKey = `${year}/${projectId}/${invoice.invoiceNumber}`
        const currentTransactionAmount = currentTransactionAmounts.get(currentTxKey) || 0
        const totalAmountPaid = otherTransactionsAmount + currentTransactionAmount

        const isFullyPaid = Math.abs(totalAmountPaid - invoiceTotal) < 0.01
        if (!isFullyPaid) {
          allCleared = false
          break
        }
      }

      if (allCleared) {
        // All invoices are cleared - update project workStatus to 'completed'
        await updateProjectInDatabase({
          year,
          projectId,
          updates: { workStatus: 'completed' },
          editedBy: `system (auto-complete via ${updatedBy})`,
        })
        console.info('[transactions] Auto-completed project workStatus', {
          year,
          projectId,
          invoiceCount: activeInvoices.length,
          triggeredBy: updatedBy,
        })
      }
    } catch (error) {
      // Non-blocking - log error but don't fail the transaction matching
      console.error('[transactions] Failed to auto-complete project status', {
        year,
        projectId,
        error: error instanceof Error ? error.message : error,
      })
    }
  }

  const updated = await getDoc(transactionRef)
  return { ...updated.data(), id: updated.id } as BankTransaction
}

/**
 * Unmatch a transaction from all invoices.
 *
 * Simply clears the transaction's matchedInvoices[].
 * Invoice payment status is derived from transactions at read time,
 * so no invoice update is needed.
 *
 * Journal entries are also derived - PAID entries simply won't be generated
 * for unmatched transactions.
 *
 * @param transactionId - The transaction to unmatch
 * @param updatedBy - User performing the unmatch
 * @returns Updated transaction
 */
export async function unmatchTransaction(
  transactionId: string,
  updatedBy: string
): Promise<BankTransaction> {
  const transactionRef = doc(getTransactionsCollection(), transactionId)
  const existing = await getDoc(transactionRef)

  if (!existing.exists()) {
    throw new Error(`Transaction ${transactionId} not found`)
  }

  // Simply clear the transaction's matched invoices
  // Payment status for invoices is derived at read time from transactions
  await updateDoc(transactionRef, {
    matchedInvoices: [],
    status: 'unmatched' as TransactionStatus,
    updatedAt: serverTimestamp(),
    updatedBy,
  })

  const updated = await getDoc(transactionRef)
  return { ...updated.data(), id: updated.id } as BankTransaction
}

/**
 * Find transactions matched to a specific invoice.
 */
export async function findTransactionsForInvoice(
  invoiceNumber: string
): Promise<BankTransaction[]> {
  // Note: This requires fetching all matched/partial transactions and filtering
  // because Firestore doesn't support array-contains with nested field queries
  const transactions = await listTransactions({ status: 'matched' })
  const partialTransactions = await listTransactions({ status: 'partial' })

  const allMatched = [...transactions, ...partialTransactions]

  return allMatched.filter(
    (t) => t.matchedInvoices?.some((inv) => inv.invoiceNumber === invoiceNumber)
  )
}

/**
 * Get the total amount paid towards a specific invoice.
 */
export async function getTotalPaidForInvoice(invoiceNumber: string): Promise<number> {
  const transactions = await findTransactionsForInvoice(invoiceNumber)

  return transactions.reduce((total, t) => {
    const matchedInvoice = t.matchedInvoices?.find((inv) => inv.invoiceNumber === invoiceNumber)
    return total + (matchedInvoice?.amount || 0)
  }, 0)
}

// ============================================================================
// Summary/Stats Operations
// ============================================================================

/**
 * Transaction statistics with separate credit/debit breakdowns.
 */
export interface TransactionStats {
  // Credit stats (isDebit === false, incoming payments)
  creditCount: number
  creditAmount: number
  unmatchedCreditCount: number
  unmatchedCreditAmount: number
  matchedCreditCount: number
  matchedCreditAmount: number
  partialCreditCount: number
  partialCreditAmount: number

  // Debit stats (isDebit === true, outgoing payments)
  debitCount: number
  debitAmount: number
  unmatchedDebitCount: number
  unmatchedDebitAmount: number
  matchedDebitCount: number
  matchedDebitAmount: number
  partialDebitCount: number
  partialDebitAmount: number

  // Net amount (credits - debits)
  netAmount: number
}

/**
 * Get transaction statistics for a date range.
 * Returns separate credit/debit breakdowns for counts and amounts.
 */
export async function getTransactionStats(options?: {
  startDate?: Date
  endDate?: Date
  subsidiaryId?: string
}): Promise<TransactionStats> {
  const transactions = await listTransactions(options)

  const stats: TransactionStats = {
    // Credit stats
    creditCount: 0,
    creditAmount: 0,
    unmatchedCreditCount: 0,
    unmatchedCreditAmount: 0,
    matchedCreditCount: 0,
    matchedCreditAmount: 0,
    partialCreditCount: 0,
    partialCreditAmount: 0,

    // Debit stats
    debitCount: 0,
    debitAmount: 0,
    unmatchedDebitCount: 0,
    unmatchedDebitAmount: 0,
    matchedDebitCount: 0,
    matchedDebitAmount: 0,
    partialDebitCount: 0,
    partialDebitAmount: 0,

    // Net
    netAmount: 0,
  }

  for (const t of transactions) {
    const isDebit = t.isDebit === true

    if (isDebit) {
      stats.debitCount++
      stats.debitAmount += t.amount
      stats.netAmount -= t.amount

      switch (t.status) {
        case 'unmatched':
          stats.unmatchedDebitCount++
          stats.unmatchedDebitAmount += t.amount
          break
        case 'matched':
          stats.matchedDebitCount++
          stats.matchedDebitAmount += t.amount
          break
        case 'partial':
          stats.partialDebitCount++
          stats.partialDebitAmount += t.amount
          break
      }
    } else {
      stats.creditCount++
      stats.creditAmount += t.amount
      stats.netAmount += t.amount

      switch (t.status) {
        case 'unmatched':
          stats.unmatchedCreditCount++
          stats.unmatchedCreditAmount += t.amount
          break
        case 'matched':
          stats.matchedCreditCount++
          stats.matchedCreditAmount += t.amount
          break
        case 'partial':
          stats.partialCreditCount++
          stats.partialCreditAmount += t.amount
          break
      }
    }
  }

  return stats
}

/**
 * Get unique payer names for autocomplete suggestions.
 */
export async function getPayerNames(subsidiaryId?: string): Promise<string[]> {
  const transactions = await listTransactions({
    subsidiaryId,
    limitCount: 500,
  })

  const payerSet = new Set<string>()
  for (const t of transactions) {
    if (t.payerName) {
      payerSet.add(t.payerName)
    }
  }

  return Array.from(payerSet).sort()
}

// ============================================================================
// Project Status Sync
// ============================================================================

/**
 * Sync project work status for projects where all invoices are cleared.
 * This can be called retroactively to update projects that were cleared
 * before the auto-complete feature was implemented.
 *
 * @param year - Optional year filter
 * @param syncedBy - User performing the sync
 * @returns List of projects that were updated
 */
export async function syncProjectWorkStatuses(options?: {
  year?: string
  syncedBy?: string
}): Promise<{ year: string; projectId: string; updated: boolean; reason?: string }[]> {
  const { year, syncedBy = 'system' } = options || {}
  const results: { year: string; projectId: string; updated: boolean; reason?: string }[] = []

  // Get years to check
  const currentYear = new Date().getFullYear()
  const yearsToCheck = year
    ? [year]
    : [String(currentYear), String(currentYear - 1), String(currentYear - 2)]

  // Get all matched/partial transactions to build payment map
  const matchedQuery = query(
    getTransactionsCollection(),
    where('status', 'in', ['matched', 'partial'])
  )
  const transactionSnapshot = await getDocs(matchedQuery)

  // Build a map of invoice payments: year/projectId/invoiceNumber -> total amount paid
  const paymentMap = new Map<string, number>()
  const projectsWithPayments = new Set<string>()

  transactionSnapshot.forEach((doc) => {
    const data = doc.data() as BankTransaction
    const matchedInvoices = data.matchedInvoices || []
    for (const inv of matchedInvoices) {
      const key = `${inv.year}/${inv.projectId}/${inv.invoiceNumber}`
      paymentMap.set(key, (paymentMap.get(key) || 0) + inv.amount)
      projectsWithPayments.add(`${inv.year}/${inv.projectId}`)
    }
  })

  // Check each project with payments
  for (const projectKey of projectsWithPayments) {
    const [projYear, projectId] = projectKey.split('/')
    if (!yearsToCheck.includes(projYear)) continue

    try {
      const allInvoices = await fetchInvoicesForProject(projYear, projectId)
      const activeInvoices = allInvoices.filter((inv) => !inv.deletedAt)

      if (activeInvoices.length === 0) {
        results.push({ year: projYear, projectId, updated: false, reason: 'No active invoices' })
        continue
      }

      let allCleared = true
      for (const invoice of activeInvoices) {
        const invoiceTotal = invoice.total ?? 0
        if (invoiceTotal <= 0) continue

        const paymentKey = `${projYear}/${projectId}/${invoice.invoiceNumber}`
        const amountPaid = paymentMap.get(paymentKey) || 0
        const isFullyPaid = Math.abs(amountPaid - invoiceTotal) < 0.01

        if (!isFullyPaid) {
          allCleared = false
          break
        }
      }

      if (allCleared) {
        await updateProjectInDatabase({
          year: projYear,
          projectId,
          updates: { workStatus: 'completed' },
          editedBy: `system (sync by ${syncedBy})`,
        })
        results.push({ year: projYear, projectId, updated: true })
        console.info('[transactions] Synced project workStatus to completed', {
          year: projYear,
          projectId,
          syncedBy,
        })
      } else {
        results.push({ year: projYear, projectId, updated: false, reason: 'Not all invoices cleared' })
      }
    } catch (error) {
      results.push({
        year: projYear,
        projectId,
        updated: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}
