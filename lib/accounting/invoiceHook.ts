/**
 * Invoice Posting Hook
 *
 * Called from API routes after invoice create/update to create journal entries.
 * Uses the client-side Firestore SDK (runs in Next.js API routes).
 */

import { collection, doc, addDoc, getDocs, query, where, serverTimestamp, Timestamp } from 'firebase/firestore'
import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from '../firebase'
import type { ProjectInvoiceRecord } from '../projectInvoices'
import type { JournalLine, JournalSourceEvent } from './types'
import { ACCOUNT_CODES, BANK_ACCOUNT_TO_GL, ACCOUNTING_COLLECTION, SETTINGS_DOC_ID, JOURNALS_SUBCOLLECTION } from './types'

// ============================================================================
// Types
// ============================================================================

export interface InvoicePostingContext {
  year: string
  projectId: string
  invoice: ProjectInvoiceRecord
  oldPaymentStatus?: string | null
  changedBy: string
}

interface PostingResult {
  issuedEntry?: { created: boolean; journalId?: string; skipped?: string }
  paidEntry?: { created: boolean; journalId?: string; skipped?: string }
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeStatus(status: string | null | undefined): 'draft' | 'due' | 'cleared' | 'unknown' {
  if (!status) return 'unknown'
  const lower = status.toLowerCase().trim()

  if (lower === 'draft') return 'draft'
  if (['due', 'issued', 'pending', 'unpaid'].includes(lower)) return 'due'
  if (['cleared', 'paid', 'received', 'complete', 'completed'].includes(lower)) return 'cleared'

  return 'unknown'
}

function getJournalsCollection() {
  // Path: accounting/journals/entries/{entryId}
  return collection(projectsDb, ACCOUNTING_COLLECTION, JOURNALS_SUBCOLLECTION, 'entries')
}

function buildInvoicePath(year: string, projectId: string, invoiceNumber: string): string {
  return `projects/${year}/projects/${projectId}/invoice/${invoiceNumber}`
}

function calculateInvoiceTotal(invoice: ProjectInvoiceRecord): number {
  const itemsTotal = invoice.items.reduce((sum, item) => {
    const unitPrice = item.unitPrice ?? 0
    const quantity = item.quantity ?? 0
    const discount = item.discount ?? 0
    return sum + (unitPrice * quantity) - discount
  }, 0)

  const taxPercent = invoice.taxOrDiscountPercent ?? 0
  return Math.round(itemsTotal * (1 + taxPercent / 100) * 100) / 100
}

async function hasEntryForEvent(sourcePath: string, event: JournalSourceEvent): Promise<boolean> {
  // Query journals for this source + event
  const journalsCol = getJournalsCollection()
  const snapshot = await getDocs(journalsCol)

  // Filter client-side (to avoid Firestore index requirements)
  return snapshot.docs.some((doc) => {
    const data = doc.data()
    return data.source?.path === sourcePath && data.source?.event === event && data.status === 'posted'
  })
}

async function createJournalEntry(
  postingDate: Date,
  description: string,
  source: { type: string; path: string; event: JournalSourceEvent },
  lines: JournalLine[],
  createdBy: string
): Promise<string> {
  // Validate balance
  const totalDebits = lines.reduce((sum, l) => sum + (l.debit || 0), 0)
  const totalCredits = lines.reduce((sum, l) => sum + (l.credit || 0), 0)
  if (Math.abs(totalDebits - totalCredits) >= 0.01) {
    throw new Error(`Journal entry not balanced: debits=${totalDebits}, credits=${totalCredits}`)
  }

  const journalsCol = getJournalsCollection()
  const docRef = await addDoc(journalsCol, {
    postingDate: Timestamp.fromDate(postingDate),
    description,
    status: 'posted',
    source,
    lines,
    createdAt: serverTimestamp(),
    createdBy,
  })

  return docRef.id
}

// ============================================================================
// Main Hook Functions
// ============================================================================

/**
 * Handle posting for a newly created invoice.
 * Creates journal entries based on the initial payment status.
 */
export async function handleInvoiceCreated(ctx: InvoicePostingContext): Promise<PostingResult> {
  const result: PostingResult = {}
  const { year, projectId, invoice, changedBy } = ctx

  const status = normalizeStatus(invoice.paymentStatus)

  // Skip drafts - no entries needed
  if (status === 'draft' || status === 'unknown') {
    return result
  }

  const invoicePath = buildInvoicePath(year, projectId, invoice.invoiceNumber)
  const amount = calculateInvoiceTotal(invoice)
  const companyName = invoice.companyName || 'Unknown'

  if (amount <= 0) {
    result.issuedEntry = { created: false, skipped: 'Zero or negative amount' }
    return result
  }

  // Get issue date
  const issueDate = invoice.paidOnIso
    ? new Date(invoice.paidOnIso)
    : invoice.createdAt
      ? new Date(invoice.createdAt)
      : new Date()

  // Create ISSUED entry for Due or Cleared invoices
  if (status === 'due' || status === 'cleared') {
    const alreadyExists = await hasEntryForEvent(invoicePath, 'ISSUED')
    if (alreadyExists) {
      result.issuedEntry = { created: false, skipped: 'ISSUED entry already exists' }
    } else {
      const journalId = await createJournalEntry(
        issueDate,
        `Issued Invoice ${invoice.invoiceNumber} to ${companyName}`,
        { type: 'invoice', path: invoicePath, event: 'ISSUED' },
        [
          { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: amount, credit: 0, memo: `AR - ${companyName}` },
          { accountCode: ACCOUNT_CODES.SERVICE_REVENUE, debit: 0, credit: amount, memo: `Revenue - ${invoice.invoiceNumber}` },
        ],
        changedBy
      )
      result.issuedEntry = { created: true, journalId }
    }
  }

  // Create PAID entry for Cleared invoices
  if (status === 'cleared') {
    if (!invoice.paidTo) {
      result.paidEntry = { created: false, skipped: 'Missing paidTo (bank account)' }
    } else {
      const bankCode = BANK_ACCOUNT_TO_GL[invoice.paidTo]
      if (!bankCode) {
        result.paidEntry = { created: false, skipped: `Unknown bank account: ${invoice.paidTo}` }
      } else {
        const paidDate = invoice.paidOnIso ? new Date(invoice.paidOnIso) : issueDate
        const alreadyExists = await hasEntryForEvent(invoicePath, 'PAID')

        if (alreadyExists) {
          result.paidEntry = { created: false, skipped: 'PAID entry already exists' }
        } else {
          const journalId = await createJournalEntry(
            paidDate,
            `Payment received for Invoice ${invoice.invoiceNumber} from ${companyName}`,
            { type: 'invoice', path: invoicePath, event: 'PAID' },
            [
              { accountCode: bankCode, debit: amount, credit: 0, memo: `Payment received` },
              { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: 0, credit: amount, memo: `AR cleared` },
            ],
            changedBy
          )
          result.paidEntry = { created: true, journalId }
        }
      }
    }
  }

  return result
}

/**
 * Handle posting for an updated invoice.
 * Creates journal entries based on status transitions.
 */
export async function handleInvoiceUpdated(ctx: InvoicePostingContext): Promise<PostingResult> {
  const result: PostingResult = {}
  const { year, projectId, invoice, oldPaymentStatus, changedBy } = ctx

  const oldStatus = normalizeStatus(oldPaymentStatus)
  const newStatus = normalizeStatus(invoice.paymentStatus)

  // No status change - skip
  if (oldStatus === newStatus) {
    return result
  }

  const invoicePath = buildInvoicePath(year, projectId, invoice.invoiceNumber)
  const amount = calculateInvoiceTotal(invoice)
  const companyName = invoice.companyName || 'Unknown'

  if (amount <= 0) {
    result.issuedEntry = { created: false, skipped: 'Zero or negative amount' }
    return result
  }

  // Get issue date
  const issueDate = invoice.paidOnIso
    ? new Date(invoice.paidOnIso)
    : invoice.createdAt
      ? new Date(invoice.createdAt)
      : new Date()

  // Draft → Due or Draft → Cleared: Create ISSUED entry
  if (oldStatus === 'draft' && (newStatus === 'due' || newStatus === 'cleared')) {
    const alreadyExists = await hasEntryForEvent(invoicePath, 'ISSUED')
    if (alreadyExists) {
      result.issuedEntry = { created: false, skipped: 'ISSUED entry already exists' }
    } else {
      const journalId = await createJournalEntry(
        issueDate,
        `Issued Invoice ${invoice.invoiceNumber} to ${companyName}`,
        { type: 'invoice', path: invoicePath, event: 'ISSUED' },
        [
          { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: amount, credit: 0, memo: `AR - ${companyName}` },
          { accountCode: ACCOUNT_CODES.SERVICE_REVENUE, debit: 0, credit: amount, memo: `Revenue - ${invoice.invoiceNumber}` },
        ],
        changedBy
      )
      result.issuedEntry = { created: true, journalId }
    }
  }

  // Due → Cleared or Draft → Cleared: Create PAID entry
  if (newStatus === 'cleared' && oldStatus !== 'cleared') {
    if (!invoice.paidTo) {
      result.paidEntry = { created: false, skipped: 'Missing paidTo (bank account)' }
    } else {
      const bankCode = BANK_ACCOUNT_TO_GL[invoice.paidTo]
      if (!bankCode) {
        result.paidEntry = { created: false, skipped: `Unknown bank account: ${invoice.paidTo}` }
      } else {
        const paidDate = invoice.paidOnIso ? new Date(invoice.paidOnIso) : new Date()
        const alreadyExists = await hasEntryForEvent(invoicePath, 'PAID')

        if (alreadyExists) {
          result.paidEntry = { created: false, skipped: 'PAID entry already exists' }
        } else {
          const journalId = await createJournalEntry(
            paidDate,
            `Payment received for Invoice ${invoice.invoiceNumber} from ${companyName}`,
            { type: 'invoice', path: invoicePath, event: 'PAID' },
            [
              { accountCode: bankCode, debit: amount, credit: 0, memo: `Payment received` },
              { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: 0, credit: amount, memo: `AR cleared` },
            ],
            changedBy
          )
          result.paidEntry = { created: true, journalId }
        }
      }
    }
  }

  return result
}

/**
 * Handle voiding GL entries when an invoice is soft-deleted.
 * Finds all journal entries linked to the invoice and voids them.
 */
export async function handleInvoiceDeleted(ctx: {
  year: string
  projectId: string
  invoiceNumber: string
  deletedBy: string
}): Promise<{ voidedEntries: string[] }> {
  const { year, projectId, invoiceNumber, deletedBy } = ctx
  const invoicePath = buildInvoicePath(year, projectId, invoiceNumber)
  const voidedEntries: string[] = []

  try {
    // Find all journal entries for this invoice
    const journalsCol = getJournalsCollection()
    const snapshot = await getDocs(journalsCol)

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data()
      // Check if this entry is for our invoice and is posted (not already void)
      if (data.source?.path === invoicePath && data.status === 'posted') {
        try {
          // Import and use voidJournalEntry
          const { voidJournalEntry } = await import('./journals')
          await voidJournalEntry(docSnap.id, deletedBy, 'Invoice deleted')
          voidedEntries.push(docSnap.id)
        } catch (voidError) {
          console.error(`[invoiceHook] Failed to void entry ${docSnap.id}:`, voidError)
        }
      }
    }
  } catch (error) {
    console.error('[invoiceHook] Error voiding entries for deleted invoice:', error)
  }

  return { voidedEntries }
}
