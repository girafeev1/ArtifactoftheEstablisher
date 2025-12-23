/**
 * Journal Entry Operations
 *
 * CRUD operations for journal entries stored in Firestore.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore'
import { projectsDb } from '../firebase'
import type {
  JournalEntry,
  JournalEntryInput,
  JournalLine,
  JournalSource,
  JournalStatus,
} from './types'
import { ACCOUNTING_COLLECTION, SETTINGS_DOC_ID, JOURNALS_SUBCOLLECTION } from './types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the Firestore collection reference for journals.
 */
function getJournalsCollection() {
  // Path: accounting/journals/entries/{entryId}
  return collection(projectsDb, ACCOUNTING_COLLECTION, JOURNALS_SUBCOLLECTION, 'entries')
}

/**
 * Validate that a journal entry is balanced (debits = credits).
 */
export function validateJournalBalance(lines: JournalLine[]): {
  isBalanced: boolean
  totalDebits: number
  totalCredits: number
  difference: number
} {
  const totalDebits = lines.reduce((sum, line) => sum + (line.debit || 0), 0)
  const totalCredits = lines.reduce((sum, line) => sum + (line.credit || 0), 0)
  const difference = Math.abs(totalDebits - totalCredits)

  // Allow for floating point precision issues (within 0.01)
  const isBalanced = difference < 0.01

  return { isBalanced, totalDebits, totalCredits, difference }
}

/**
 * Convert a Date to a Firestore Timestamp.
 */
function toTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date)
}

// ============================================================================
// Journal Entry CRUD Operations
// ============================================================================

/**
 * Create a new journal entry.
 * Validates that debits = credits before saving.
 */
export async function createJournalEntry(input: JournalEntryInput): Promise<JournalEntry> {
  // Validate balance
  const balance = validateJournalBalance(input.lines)
  if (!balance.isBalanced) {
    throw new Error(
      `Journal entry is not balanced. Debits: ${balance.totalDebits}, Credits: ${balance.totalCredits}, Difference: ${balance.difference}`
    )
  }

  // Validate that each line has either debit or credit (not both, not neither)
  for (const line of input.lines) {
    const hasDebit = line.debit > 0
    const hasCredit = line.credit > 0
    if (hasDebit && hasCredit) {
      throw new Error(`Journal line for account ${line.accountCode} has both debit and credit`)
    }
    if (!hasDebit && !hasCredit) {
      throw new Error(`Journal line for account ${line.accountCode} has neither debit nor credit`)
    }
  }

  const journalsCol = getJournalsCollection()

  const journalData = {
    postingDate: toTimestamp(input.postingDate),
    description: input.description,
    status: 'posted' as JournalStatus,
    source: input.source,
    lines: input.lines,
    createdAt: serverTimestamp(),
    createdBy: input.createdBy,
  }

  const docRef = await addDoc(journalsCol, journalData)

  const created = await getDoc(docRef)
  return { ...created.data(), id: created.id } as JournalEntry
}

/**
 * Get a journal entry by ID.
 */
export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  const journalRef = doc(getJournalsCollection(), id)
  const snapshot = await getDoc(journalRef)

  if (!snapshot.exists()) {
    return null
  }

  return { ...snapshot.data(), id: snapshot.id } as JournalEntry
}

/**
 * List journal entries with optional filters.
 */
export async function listJournalEntries(options?: {
  startDate?: Date
  endDate?: Date
  sourceType?: JournalSource['type']
  sourcePath?: string
  status?: JournalStatus
  limitCount?: number
}): Promise<JournalEntry[]> {
  const journalsCol = getJournalsCollection()
  const constraints: Parameters<typeof query>[1][] = []

  if (options?.startDate) {
    constraints.push(where('postingDate', '>=', toTimestamp(options.startDate)))
  }

  if (options?.endDate) {
    constraints.push(where('postingDate', '<=', toTimestamp(options.endDate)))
  }

  if (options?.status) {
    constraints.push(where('status', '==', options.status))
  }

  constraints.push(orderBy('postingDate', 'desc'))

  if (options?.limitCount) {
    constraints.push(limit(options.limitCount))
  }

  const q = query(journalsCol, ...constraints)
  const snapshot = await getDocs(q)

  let entries = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as JournalEntry))

  // Client-side filtering for nested fields (Firestore doesn't support nested queries well)
  if (options?.sourceType) {
    entries = entries.filter((e) => e.source.type === options.sourceType)
  }

  if (options?.sourcePath) {
    entries = entries.filter((e) => e.source.path === options.sourcePath)
  }

  return entries
}

/**
 * Find journal entries for a specific source document.
 */
export async function findJournalEntriesForSource(
  sourcePath: string,
  event?: JournalSource['event']
): Promise<JournalEntry[]> {
  const entries = await listJournalEntries({ sourcePath })

  if (event) {
    return entries.filter((e) => e.source.event === event)
  }

  return entries
}

/**
 * Check if a journal entry already exists for a source + event combination.
 */
export async function hasJournalEntryForEvent(
  sourcePath: string,
  event: JournalSource['event']
): Promise<boolean> {
  const entries = await findJournalEntriesForSource(sourcePath, event)
  return entries.some((e) => e.status === 'posted')
}

/**
 * Void a journal entry (creates a reversing entry, marks original as void).
 */
export async function voidJournalEntry(
  id: string,
  voidedBy: string,
  reason?: string
): Promise<{ original: JournalEntry; reversal: JournalEntry }> {
  const original = await getJournalEntry(id)

  if (!original) {
    throw new Error(`Journal entry ${id} not found`)
  }

  if (original.status === 'void') {
    throw new Error(`Journal entry ${id} is already voided`)
  }

  // Create reversing entry (swap debits and credits)
  const reversalLines: JournalLine[] = original.lines.map((line) => ({
    accountCode: line.accountCode,
    debit: line.credit, // Swap
    credit: line.debit, // Swap
    memo: `Reversal: ${line.memo || ''}`.trim(),
  }))

  const reversalInput: JournalEntryInput = {
    postingDate: new Date(), // Void date is today
    description: `VOID: ${original.description}${reason ? ` - ${reason}` : ''}`,
    source: {
      type: original.source.type,
      path: original.source.path,
      event: 'VOID',
    },
    lines: reversalLines,
    createdBy: voidedBy,
  }

  const reversal = await createJournalEntry(reversalInput)

  // Mark original as void
  const originalRef = doc(getJournalsCollection(), id)
  await updateDoc(originalRef, {
    status: 'void',
    voidedAt: serverTimestamp(),
    voidedBy,
    voidReason: reason,
    reversalId: reversal.id,
  })

  const updatedOriginal = await getJournalEntry(id)

  return { original: updatedOriginal!, reversal }
}

// ============================================================================
// Aggregate Queries
// ============================================================================

/**
 * Get account balances for a date range.
 * Returns sum of debits and credits per account code.
 */
export async function getAccountBalances(options?: {
  startDate?: Date
  endDate?: Date
  statusFilter?: JournalStatus
}): Promise<Map<string, { debit: number; credit: number }>> {
  const entries = await listJournalEntries({
    startDate: options?.startDate,
    endDate: options?.endDate,
    status: options?.statusFilter ?? 'posted',
  })

  const balances = new Map<string, { debit: number; credit: number }>()

  for (const entry of entries) {
    for (const line of entry.lines) {
      const current = balances.get(line.accountCode) || { debit: 0, credit: 0 }
      balances.set(line.accountCode, {
        debit: current.debit + (line.debit || 0),
        credit: current.credit + (line.credit || 0),
      })
    }
  }

  return balances
}

/**
 * Get total debits and credits for the entire ledger.
 */
export async function getLedgerTotals(options?: {
  startDate?: Date
  endDate?: Date
}): Promise<{ totalDebits: number; totalCredits: number; isBalanced: boolean }> {
  const balances = await getAccountBalances(options)

  let totalDebits = 0
  let totalCredits = 0

  for (const { debit, credit } of balances.values()) {
    totalDebits += debit
    totalCredits += credit
  }

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

  return { totalDebits, totalCredits, isBalanced }
}
