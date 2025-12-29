/**
 * Transaction Deduplication Module
 *
 * Prevents duplicate transactions from being imported from API sources.
 * Uses hash-based deduplication stored in Firestore.
 */

import { createHash } from 'crypto'
import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { projectsDb } from '../firebase'
import type { ApiImportProvider } from './types'

// ============================================================================
// Types
// ============================================================================

export interface TransactionHashInput {
  externalId?: string // External transaction ID from API (preferred)
  date: Date | string
  amount: number
  description: string
  source: ApiImportProvider
}

export interface StoredHash {
  hash: string
  transactionId: string // Reference to the bank transaction
  source: ApiImportProvider
  externalId?: string
  createdAt: Timestamp
}

export interface DeduplicationResult {
  isDuplicate: boolean
  existingTransactionId?: string
  hash: string
}

// ============================================================================
// Constants
// ============================================================================

const IMPORT_HASHES_COLLECTION = 'accounting'
const IMPORT_HASHES_SUBCOLLECTION = 'import-hashes'

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Generate a unique hash for a transaction
 *
 * If externalId is provided (from API), use it as the primary identifier.
 * Otherwise, generate a content-based hash from date + amount + description.
 */
export function generateTransactionHash(input: TransactionHashInput): string {
  const { externalId, date, amount, description, source } = input

  // Normalize date to YYYY-MM-DD format
  const normalizedDate = date instanceof Date
    ? date.toISOString().split('T')[0]
    : new Date(date).toISOString().split('T')[0]

  // Normalize amount to 2 decimal places
  const normalizedAmount = Math.abs(amount).toFixed(2)

  // Normalize description: lowercase, trim, remove extra spaces
  const normalizedDesc = description
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .substring(0, 200) // Limit length for consistent hashing

  // Build the hash input
  let hashInput: string
  if (externalId) {
    // Use external ID as primary key (most reliable)
    hashInput = `${source}:${externalId}`
  } else {
    // Content-based hash as fallback
    hashInput = `${source}:${normalizedDate}:${normalizedAmount}:${normalizedDesc}`
  }

  return createHash('sha256').update(hashInput).digest('hex')
}

// ============================================================================
// Firestore Operations
// ============================================================================

/**
 * Get the import hashes collection reference
 */
function getHashesCollection() {
  return collection(projectsDb, IMPORT_HASHES_COLLECTION, 'transactions', IMPORT_HASHES_SUBCOLLECTION)
}

/**
 * Check if a transaction hash already exists
 */
export async function checkDuplicate(
  input: TransactionHashInput
): Promise<DeduplicationResult> {
  const hash = generateTransactionHash(input)

  try {
    const hashDoc = await getDoc(doc(getHashesCollection(), hash))

    if (hashDoc.exists()) {
      const data = hashDoc.data() as StoredHash
      return {
        isDuplicate: true,
        existingTransactionId: data.transactionId,
        hash,
      }
    }

    return {
      isDuplicate: false,
      hash,
    }
  } catch (error) {
    console.error('[deduplication] Error checking duplicate:', error)
    // On error, assume not duplicate to allow import
    return {
      isDuplicate: false,
      hash,
    }
  }
}

/**
 * Check multiple transactions for duplicates in batch
 */
export async function checkDuplicatesBatch(
  inputs: TransactionHashInput[]
): Promise<Map<string, DeduplicationResult>> {
  const results = new Map<string, DeduplicationResult>()

  // Generate hashes for all inputs
  const hashToInput = new Map<string, TransactionHashInput>()
  for (const input of inputs) {
    const hash = generateTransactionHash(input)
    hashToInput.set(hash, input)
  }

  const hashes = Array.from(hashToInput.keys())

  // Query existing hashes in batches (Firestore limits 'in' queries to 30)
  const batchSize = 30
  const existingHashes = new Set<string>()
  const existingData = new Map<string, StoredHash>()

  for (let i = 0; i < hashes.length; i += batchSize) {
    const batch = hashes.slice(i, i + batchSize)

    try {
      // Query by document IDs (hashes)
      for (const hash of batch) {
        const hashDoc = await getDoc(doc(getHashesCollection(), hash))
        if (hashDoc.exists()) {
          existingHashes.add(hash)
          existingData.set(hash, hashDoc.data() as StoredHash)
        }
      }
    } catch (error) {
      console.error('[deduplication] Error in batch check:', error)
    }
  }

  // Build results
  for (const [hash, input] of hashToInput) {
    const key = input.externalId || `${input.date}:${input.amount}:${input.description}`

    if (existingHashes.has(hash)) {
      const data = existingData.get(hash)
      results.set(key, {
        isDuplicate: true,
        existingTransactionId: data?.transactionId,
        hash,
      })
    } else {
      results.set(key, {
        isDuplicate: false,
        hash,
      })
    }
  }

  return results
}

/**
 * Store a hash after successful transaction import
 */
export async function storeHash(
  hash: string,
  transactionId: string,
  source: ApiImportProvider,
  externalId?: string
): Promise<void> {
  try {
    const hashData: StoredHash = {
      hash,
      transactionId,
      source,
      externalId,
      createdAt: Timestamp.now(),
    }

    await setDoc(doc(getHashesCollection(), hash), hashData)
  } catch (error) {
    console.error('[deduplication] Error storing hash:', error)
    // Don't throw - hash storage failure shouldn't block import
  }
}

/**
 * Store multiple hashes in batch
 */
export async function storeHashesBatch(
  entries: Array<{
    hash: string
    transactionId: string
    source: ApiImportProvider
    externalId?: string
  }>
): Promise<void> {
  // Use individual setDoc calls (Firestore batch writes have limits)
  const promises = entries.map(entry =>
    storeHash(entry.hash, entry.transactionId, entry.source, entry.externalId)
  )

  await Promise.allSettled(promises)
}

/**
 * Find transactions by external ID (for cross-source duplicate detection)
 */
export async function findByExternalId(
  externalId: string,
  source: ApiImportProvider
): Promise<string | null> {
  try {
    const q = query(
      getHashesCollection(),
      where('externalId', '==', externalId),
      where('source', '==', source)
    )

    const snapshot = await getDocs(q)

    if (!snapshot.empty) {
      const data = snapshot.docs[0].data() as StoredHash
      return data.transactionId
    }

    return null
  } catch (error) {
    console.error('[deduplication] Error finding by external ID:', error)
    return null
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a transaction might be a duplicate based on fuzzy matching
 * Used for cross-source detection (e.g., API import vs CSV import)
 *
 * Returns true if:
 * - Same date (±1 day)
 * - Same amount (within 0.01 tolerance)
 * - Similar description (Levenshtein distance threshold)
 */
export function isFuzzyDuplicate(
  existing: { date: Date; amount: number; description: string },
  incoming: { date: Date; amount: number; description: string },
  options: {
    dateTolerance?: number // days, default 1
    amountTolerance?: number // default 0.01
  } = {}
): boolean {
  const { dateTolerance = 1, amountTolerance = 0.01 } = options

  // Check date within tolerance
  const dateA = existing.date instanceof Date ? existing.date : new Date(existing.date)
  const dateB = incoming.date instanceof Date ? incoming.date : new Date(incoming.date)
  const daysDiff = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24)

  if (daysDiff > dateTolerance) {
    return false
  }

  // Check amount within tolerance
  const amountDiff = Math.abs(existing.amount - incoming.amount)
  if (amountDiff > amountTolerance) {
    return false
  }

  // If date and amount match, consider it a potential duplicate
  // Description matching is less reliable due to formatting differences
  return true
}
