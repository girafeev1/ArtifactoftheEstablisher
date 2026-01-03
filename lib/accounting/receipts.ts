/**
 * Receipt Operations
 *
 * CRUD operations for receipts (supporting documents) stored in Firestore.
 * Supports three linking methods: reference match, manual selection, and inbox.
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
  limit as firestoreLimit,
} from 'firebase/firestore'
import { projectsDb } from '../firebase'
import type {
  Receipt,
  ReceiptInput,
  ReceiptStatus,
  BankTransaction,
} from './types'
import {
  ACCOUNTING_COLLECTION,
  RECEIPTS_SUBCOLLECTION,
  TRANSACTIONS_SUBCOLLECTION,
} from './types'
import { deleteReceiptFromStorage } from '../storage/receipts'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the Firestore collection reference for receipts.
 * Path: accounting/receipts/entries/{receiptId}
 */
function getReceiptsCollection() {
  return collection(projectsDb, ACCOUNTING_COLLECTION, RECEIPTS_SUBCOLLECTION, 'entries')
}

/**
 * Get the Firestore collection reference for transactions.
 * Path: accounting/transactions/entries/{transactionId}
 */
function getTransactionsCollection() {
  return collection(projectsDb, ACCOUNTING_COLLECTION, TRANSACTIONS_SUBCOLLECTION, 'entries')
}

/**
 * Convert Firestore document to Receipt object
 */
function docToReceipt(docSnap: any): Receipt {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    ...data,
    uploadedAt: data.uploadedAt instanceof Timestamp ? data.uploadedAt : Timestamp.now(),
    matchedAt: data.matchedAt instanceof Timestamp ? data.matchedAt : undefined,
  } as Receipt
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new receipt document.
 *
 * @param input - Receipt input data
 * @param transactionId - Optional transaction ID to link immediately
 * @returns Created receipt with ID
 */
export async function createReceipt(
  input: ReceiptInput,
  transactionId?: string
): Promise<Receipt> {
  const status: ReceiptStatus = transactionId ? 'matched' : 'inbox'

  const receiptData = {
    storagePath: input.storagePath,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    thumbnailPath: input.thumbnailPath || null,
    status,
    transactionId: transactionId || null,
    referenceNumber: input.referenceNumber || null,
    source: input.source,
    telegramUserId: input.telegramUserId || null,
    telegramFileId: input.telegramFileId || null,
    subsidiaryId: input.subsidiaryId,
    uploadedAt: serverTimestamp(),
    uploadedBy: input.uploadedBy,
    matchedAt: transactionId ? serverTimestamp() : null,
    matchedBy: transactionId ? input.uploadedBy : null,
    memo: input.memo || null,
  }

  const docRef = await addDoc(getReceiptsCollection(), receiptData)

  // If matched to a transaction, update the transaction's receiptIds
  if (transactionId) {
    await addReceiptIdToTransaction(transactionId, docRef.id, input.uploadedBy)
  }

  return {
    id: docRef.id,
    ...receiptData,
    uploadedAt: Timestamp.now(),
    matchedAt: transactionId ? Timestamp.now() : undefined,
  } as Receipt
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get a single receipt by ID.
 *
 * @param receiptId - Receipt document ID
 * @returns Receipt or null if not found
 */
export async function getReceipt(receiptId: string): Promise<Receipt | null> {
  const docRef = doc(getReceiptsCollection(), receiptId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return null
  }

  return docToReceipt(docSnap)
}

/**
 * List receipts with optional filters.
 *
 * @param options - Filter options
 * @returns Array of receipts
 */
export async function listReceipts(options?: {
  status?: ReceiptStatus
  subsidiaryId?: string
  transactionId?: string
  limit?: number
}): Promise<Receipt[]> {
  let q = query(getReceiptsCollection(), orderBy('uploadedAt', 'desc'))

  if (options?.status) {
    q = query(q, where('status', '==', options.status))
  }

  if (options?.subsidiaryId) {
    q = query(q, where('subsidiaryId', '==', options.subsidiaryId))
  }

  if (options?.transactionId) {
    q = query(q, where('transactionId', '==', options.transactionId))
  }

  if (options?.limit) {
    q = query(q, firestoreLimit(options.limit))
  }

  const snapshot = await getDocs(q)
  return snapshot.docs.map(docToReceipt)
}

/**
 * List inbox (unmatched) receipts for a subsidiary.
 *
 * @param subsidiaryId - Optional subsidiary filter
 * @returns Array of inbox receipts
 */
export async function listInboxReceipts(subsidiaryId?: string): Promise<Receipt[]> {
  return listReceipts({ status: 'inbox', subsidiaryId })
}

/**
 * Get all receipts linked to a specific transaction.
 *
 * @param transactionId - Transaction ID
 * @returns Array of linked receipts
 */
export async function getReceiptsForTransaction(transactionId: string): Promise<Receipt[]> {
  return listReceipts({ transactionId })
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Update a receipt's metadata (memo, etc.).
 *
 * @param receiptId - Receipt ID
 * @param updates - Fields to update
 * @param updatedBy - User performing the update
 */
export async function updateReceipt(
  receiptId: string,
  updates: { memo?: string; referenceNumber?: string },
  updatedBy: string
): Promise<Receipt | null> {
  const receiptRef = doc(getReceiptsCollection(), receiptId)
  const docSnap = await getDoc(receiptRef)

  if (!docSnap.exists()) {
    return null
  }

  await updateDoc(receiptRef, {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy,
  })

  return getReceipt(receiptId)
}

/**
 * Match a receipt to a transaction.
 *
 * @param receiptId - Receipt ID
 * @param transactionId - Transaction ID to link to
 * @param matchedBy - User performing the match
 * @returns Updated receipt
 */
export async function matchReceiptToTransaction(
  receiptId: string,
  transactionId: string,
  matchedBy: string
): Promise<Receipt | null> {
  const receipt = await getReceipt(receiptId)
  if (!receipt) {
    throw new Error(`Receipt not found: ${receiptId}`)
  }

  // If already matched to a different transaction, unmatch first
  if (receipt.transactionId && receipt.transactionId !== transactionId) {
    await removeReceiptIdFromTransaction(receipt.transactionId, receiptId, matchedBy)
  }

  // Update receipt
  const receiptRef = doc(getReceiptsCollection(), receiptId)
  await updateDoc(receiptRef, {
    status: 'matched',
    transactionId,
    matchedAt: serverTimestamp(),
    matchedBy,
  })

  // Update transaction's receiptIds
  await addReceiptIdToTransaction(transactionId, receiptId, matchedBy)

  return getReceipt(receiptId)
}

/**
 * Unmatch a receipt from its transaction.
 *
 * @param receiptId - Receipt ID
 * @param unmatchedBy - User performing the unmatch
 * @returns Updated receipt
 */
export async function unmatchReceipt(
  receiptId: string,
  unmatchedBy: string
): Promise<Receipt | null> {
  const receipt = await getReceipt(receiptId)
  if (!receipt) {
    throw new Error(`Receipt not found: ${receiptId}`)
  }

  if (!receipt.transactionId) {
    // Already unmatched
    return receipt
  }

  // Remove from transaction's receiptIds
  await removeReceiptIdFromTransaction(receipt.transactionId, receiptId, unmatchedBy)

  // Update receipt
  const receiptRef = doc(getReceiptsCollection(), receiptId)
  await updateDoc(receiptRef, {
    status: 'inbox',
    transactionId: null,
    matchedAt: null,
    matchedBy: null,
  })

  return getReceipt(receiptId)
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete a receipt and its storage file.
 *
 * @param receiptId - Receipt ID
 * @param deletedBy - User performing the deletion
 */
export async function deleteReceipt(
  receiptId: string,
  deletedBy: string
): Promise<void> {
  const receipt = await getReceipt(receiptId)
  if (!receipt) {
    throw new Error(`Receipt not found: ${receiptId}`)
  }

  // If matched, remove from transaction first
  if (receipt.transactionId) {
    await removeReceiptIdFromTransaction(receipt.transactionId, receiptId, deletedBy)
  }

  // Delete from storage
  try {
    await deleteReceiptFromStorage(receipt.storagePath)
  } catch (error) {
    console.warn(`[receipts] Failed to delete storage file: ${receipt.storagePath}`, error)
    // Continue with Firestore deletion even if storage deletion fails
  }

  // Delete from Firestore
  const receiptRef = doc(getReceiptsCollection(), receiptId)
  await deleteDoc(receiptRef)
}

// ============================================================================
// Reference Matching
// ============================================================================

/**
 * Try to match a receipt to a transaction by reference number.
 *
 * @param referenceNumber - Reference number to search for
 * @param subsidiaryId - Subsidiary to search within
 * @returns Transaction ID if found, null otherwise
 */
export async function findTransactionByReference(
  referenceNumber: string,
  subsidiaryId: string
): Promise<string | null> {
  const q = query(
    getTransactionsCollection(),
    where('referenceNumber', '==', referenceNumber),
    where('subsidiaryId', '==', subsidiaryId),
    firestoreLimit(1)
  )

  const snapshot = await getDocs(q)
  if (snapshot.empty) {
    return null
  }

  return snapshot.docs[0].id
}

/**
 * Create a receipt and automatically match by reference number if possible.
 *
 * @param input - Receipt input data
 * @returns Created receipt (matched if reference found)
 */
export async function createReceiptWithAutoMatch(
  input: ReceiptInput
): Promise<Receipt> {
  let transactionId: string | undefined

  // Try to match by reference number
  if (input.referenceNumber) {
    const foundId = await findTransactionByReference(
      input.referenceNumber,
      input.subsidiaryId
    )
    if (foundId) {
      transactionId = foundId
    }
  }

  return createReceipt(input, transactionId)
}

// ============================================================================
// Transaction Helper Functions
// ============================================================================

/**
 * Add a receipt ID to a transaction's receiptIds array.
 */
async function addReceiptIdToTransaction(
  transactionId: string,
  receiptId: string,
  updatedBy: string
): Promise<void> {
  const txRef = doc(getTransactionsCollection(), transactionId)
  const txSnap = await getDoc(txRef)

  if (!txSnap.exists()) {
    console.warn(`[receipts] Transaction not found: ${transactionId}`)
    return
  }

  const txData = txSnap.data() as BankTransaction
  const currentIds = txData.receiptIds || []

  if (!currentIds.includes(receiptId)) {
    await updateDoc(txRef, {
      receiptIds: [...currentIds, receiptId],
      updatedAt: serverTimestamp(),
      updatedBy,
    })
  }
}

/**
 * Remove a receipt ID from a transaction's receiptIds array.
 */
async function removeReceiptIdFromTransaction(
  transactionId: string,
  receiptId: string,
  updatedBy: string
): Promise<void> {
  const txRef = doc(getTransactionsCollection(), transactionId)
  const txSnap = await getDoc(txRef)

  if (!txSnap.exists()) {
    console.warn(`[receipts] Transaction not found: ${transactionId}`)
    return
  }

  const txData = txSnap.data() as BankTransaction
  const currentIds = txData.receiptIds || []

  if (currentIds.includes(receiptId)) {
    await updateDoc(txRef, {
      receiptIds: currentIds.filter((id) => id !== receiptId),
      updatedAt: serverTimestamp(),
      updatedBy,
    })
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get receipt statistics for a subsidiary.
 *
 * @param subsidiaryId - Subsidiary ID
 * @returns Count of receipts by status
 */
export async function getReceiptStats(subsidiaryId?: string): Promise<{
  inbox: number
  matched: number
  orphaned: number
  total: number
}> {
  const receipts = await listReceipts({ subsidiaryId })

  const stats = {
    inbox: 0,
    matched: 0,
    orphaned: 0,
    total: receipts.length,
  }

  for (const receipt of receipts) {
    if (receipt.status === 'inbox') stats.inbox++
    else if (receipt.status === 'matched') stats.matched++
    else if (receipt.status === 'orphaned') stats.orphaned++
  }

  return stats
}
