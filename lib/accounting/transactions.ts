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
 * Match a transaction to one or more invoices.
 *
 * @param transactionId - The transaction to match
 * @param invoices - Array of invoices with amounts to apply
 * @param updatedBy - User performing the match
 * @returns Updated transaction
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

  // Validate total matched amount doesn't exceed transaction amount
  const totalMatched = invoices.reduce((sum, inv) => sum + inv.amount, 0)
  if (totalMatched > transaction.amount + 0.01) {
    // Allow small floating point variance
    throw new Error(
      `Total matched amount (${totalMatched}) exceeds transaction amount (${transaction.amount})`
    )
  }

  // Determine status
  let newStatus: TransactionStatus
  if (Math.abs(totalMatched - transaction.amount) < 0.01) {
    newStatus = 'matched'
  } else if (totalMatched > 0) {
    newStatus = 'partial'
  } else {
    newStatus = 'unmatched'
  }

  await updateDoc(transactionRef, {
    matchedInvoices: invoices,
    status: newStatus,
    updatedAt: serverTimestamp(),
    updatedBy,
  })

  const updated = await getDoc(transactionRef)
  return { ...updated.data(), id: updated.id } as BankTransaction
}

/**
 * Unmatch a transaction from all invoices.
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
 * Get transaction statistics for a date range.
 */
export async function getTransactionStats(options?: {
  startDate?: Date
  endDate?: Date
  subsidiaryId?: string
}): Promise<{
  totalTransactions: number
  totalAmount: number
  unmatchedCount: number
  unmatchedAmount: number
  matchedCount: number
  matchedAmount: number
  partialCount: number
  partialAmount: number
}> {
  const transactions = await listTransactions(options)

  const stats = {
    totalTransactions: transactions.length,
    totalAmount: 0,
    unmatchedCount: 0,
    unmatchedAmount: 0,
    matchedCount: 0,
    matchedAmount: 0,
    partialCount: 0,
    partialAmount: 0,
  }

  for (const t of transactions) {
    stats.totalAmount += t.amount

    switch (t.status) {
      case 'unmatched':
        stats.unmatchedCount++
        stats.unmatchedAmount += t.amount
        break
      case 'matched':
        stats.matchedCount++
        stats.matchedAmount += t.amount
        break
      case 'partial':
        stats.partialCount++
        stats.partialAmount += t.amount
        break
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
