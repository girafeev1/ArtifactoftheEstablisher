/**
 * Posting Engine
 *
 * Converts invoice events (ISSUED, PAID) into journal entries.
 * This is the bridge between the invoicing system and the GL.
 */

import type { JournalEntryInput, JournalLine, PostingContext, InvoiceEvent } from './types'
import { ACCOUNT_CODES, BANK_ACCOUNT_TO_GL } from './types'
import { createJournalEntry, hasJournalEntryForEvent, findJournalEntriesForSource } from './journals'
import { getAccount } from './accounts'

// ============================================================================
// Posting Rules
// ============================================================================

/**
 * Build journal entry for invoice ISSUED event.
 * Dr Accounts Receivable / Cr Service Revenue
 */
function buildIssuedEntry(context: PostingContext): JournalEntryInput {
  const lines: JournalLine[] = [
    {
      accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      debit: context.amount,
      credit: 0,
      memo: `AR - ${context.companyName}`,
    },
    {
      accountCode: ACCOUNT_CODES.SERVICE_REVENUE,
      debit: 0,
      credit: context.amount,
      memo: `Revenue - ${context.invoiceNumber}`,
    },
  ]

  return {
    postingDate: context.eventDate,
    description: `Invoice ${context.invoiceNumber} issued to ${context.companyName}`,
    source: {
      type: 'invoice',
      path: context.invoicePath,
      event: 'ISSUED',
    },
    lines,
    createdBy: context.createdBy,
  }
}

/**
 * Build journal entry for invoice PAID event.
 * Dr Bank / Cr Accounts Receivable
 */
function buildPaidEntry(context: PostingContext): JournalEntryInput {
  if (!context.bankAccountCode) {
    throw new Error('Bank account code is required for PAID event')
  }

  const lines: JournalLine[] = [
    {
      accountCode: context.bankAccountCode,
      debit: context.amount,
      credit: 0,
      memo: `Payment received - ${context.invoiceNumber}`,
    },
    {
      accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      debit: 0,
      credit: context.amount,
      memo: `AR cleared - ${context.companyName}`,
    },
  ]

  return {
    postingDate: context.eventDate,
    description: `Payment received for Invoice ${context.invoiceNumber} from ${context.companyName}`,
    source: {
      type: 'invoice',
      path: context.invoicePath,
      event: 'PAID',
    },
    lines,
    createdBy: context.createdBy,
  }
}

// ============================================================================
// Main Posting Functions
// ============================================================================

/**
 * Create a journal entry for an invoice event.
 * Returns null if the entry already exists (idempotent).
 */
export async function postInvoiceEvent(
  context: PostingContext
): Promise<{ created: boolean; journalId?: string; skipped?: string }> {
  // Validate required data - don't create entries with missing/unknown values
  if (!context.companyName || context.companyName === 'Unknown Client' || context.companyName === 'Unknown') {
    console.warn(`[postInvoiceEvent] Skipping ${context.event} entry for ${context.invoicePath}: missing or unknown company name`)
    return { created: false, skipped: 'Missing or unknown company name' }
  }

  if (!context.invoiceNumber || context.invoiceNumber === 'Unknown') {
    console.warn(`[postInvoiceEvent] Skipping ${context.event} entry for ${context.invoicePath}: missing or unknown invoice number`)
    return { created: false, skipped: 'Missing or unknown invoice number' }
  }

  if (!context.amount || context.amount <= 0) {
    console.warn(`[postInvoiceEvent] Skipping ${context.event} entry for ${context.invoicePath}: invalid amount ${context.amount}`)
    return { created: false, skipped: 'Invalid or zero amount' }
  }

  // Check if already posted (idempotent)
  const alreadyPosted = await hasJournalEntryForEvent(context.invoicePath, context.event)
  if (alreadyPosted) {
    return { created: false, skipped: `${context.event} entry already exists for ${context.invoicePath}` }
  }

  let entryInput: JournalEntryInput

  switch (context.event) {
    case 'ISSUED':
      entryInput = buildIssuedEntry(context)
      break
    case 'PAID':
      entryInput = buildPaidEntry(context)
      break
    default:
      throw new Error(`Unknown event type: ${context.event}`)
  }

  const journalEntry = await createJournalEntry(entryInput)

  return { created: true, journalId: journalEntry.id }
}

/**
 * Determine the bank GL account code from a bankAccount ID (e.g., "ERL-DSB-S" → "1000").
 */
export function resolveBankAccountCode(bankAccountId: string): string {
  const code = BANK_ACCOUNT_TO_GL[bankAccountId]
  if (!code) {
    throw new Error(`Unknown bank account: ${bankAccountId}. No GL account mapping found.`)
  }
  return code
}

// ============================================================================
// Invoice Status Change Handler
// ============================================================================

export type PaymentStatus = 'Draft' | 'Due' | 'Cleared' | string

export interface InvoiceForPosting {
  path: string // Firestore path to invoice document
  invoiceNumber: string
  companyName: string
  amount: number // Total invoice amount
  onDate: Date // Invoice issue date
  paidOn?: Date // Payment date (if paid)
  paidTo?: string // Bank account ID (if paid)
}

/**
 * Handle invoice status change and create appropriate journal entries.
 *
 * Status transitions:
 * - Draft → Due: Create ISSUED entry
 * - Due → Cleared: Create PAID entry
 * - Draft → Cleared: Create both ISSUED and PAID entries
 */
export async function handleInvoiceStatusChange(
  invoice: InvoiceForPosting,
  oldStatus: PaymentStatus,
  newStatus: PaymentStatus,
  changedBy: string
): Promise<{
  issuedEntry?: { created: boolean; journalId?: string; skipped?: string }
  paidEntry?: { created: boolean; journalId?: string; skipped?: string }
}> {
  const results: {
    issuedEntry?: { created: boolean; journalId?: string; skipped?: string }
    paidEntry?: { created: boolean; journalId?: string; skipped?: string }
  } = {}

  const normalizedOld = normalizeStatus(oldStatus)
  const normalizedNew = normalizeStatus(newStatus)

  // No change or moving backwards - skip
  if (normalizedOld === normalizedNew) {
    return results
  }

  // Draft → Due or Draft → Cleared: Create ISSUED entry
  if (normalizedOld === 'draft' && (normalizedNew === 'due' || normalizedNew === 'cleared')) {
    const issuedContext: PostingContext = {
      invoicePath: invoice.path,
      invoiceNumber: invoice.invoiceNumber,
      companyName: invoice.companyName,
      amount: invoice.amount,
      event: 'ISSUED',
      eventDate: invoice.onDate,
      createdBy: changedBy,
    }

    results.issuedEntry = await postInvoiceEvent(issuedContext)
  }

  // Due → Cleared or Draft → Cleared: Create PAID entry
  if (normalizedNew === 'cleared' && normalizedOld !== 'cleared') {
    if (!invoice.paidOn) {
      throw new Error('paidOn date is required when marking invoice as Cleared')
    }
    if (!invoice.paidTo) {
      throw new Error('paidTo (bank account) is required when marking invoice as Cleared')
    }

    const bankAccountCode = resolveBankAccountCode(invoice.paidTo)

    const paidContext: PostingContext = {
      invoicePath: invoice.path,
      invoiceNumber: invoice.invoiceNumber,
      companyName: invoice.companyName,
      amount: invoice.amount,
      event: 'PAID',
      eventDate: invoice.paidOn,
      bankAccountCode,
      createdBy: changedBy,
    }

    results.paidEntry = await postInvoiceEvent(paidContext)
  }

  return results
}

/**
 * Normalize payment status to lowercase for comparison.
 */
function normalizeStatus(status: PaymentStatus): 'draft' | 'due' | 'cleared' | 'unknown' {
  const lower = status.toLowerCase().trim()

  if (lower === 'draft') return 'draft'
  if (lower === 'due' || lower === 'issued' || lower === 'pending' || lower === 'unpaid') return 'due'
  if (lower === 'cleared' || lower === 'paid' || lower === 'received' || lower === 'complete') return 'cleared'

  return 'unknown'
}

// ============================================================================
// Migration Helper
// ============================================================================

/**
 * Post all entries for an existing invoice (for migration).
 * Creates ISSUED and optionally PAID entries based on current status.
 */
export async function migrateInvoiceToGL(
  invoice: InvoiceForPosting,
  currentStatus: PaymentStatus,
  migratedBy: string
): Promise<{
  issuedEntry?: { created: boolean; journalId?: string; skipped?: string }
  paidEntry?: { created: boolean; journalId?: string; skipped?: string }
}> {
  const results: {
    issuedEntry?: { created: boolean; journalId?: string; skipped?: string }
    paidEntry?: { created: boolean; journalId?: string; skipped?: string }
  } = {}

  const normalized = normalizeStatus(currentStatus)

  // Skip drafts - no entries needed
  if (normalized === 'draft' || normalized === 'unknown') {
    return results
  }

  // Create ISSUED entry for Due or Cleared invoices
  if (normalized === 'due' || normalized === 'cleared') {
    const issuedContext: PostingContext = {
      invoicePath: invoice.path,
      invoiceNumber: invoice.invoiceNumber,
      companyName: invoice.companyName,
      amount: invoice.amount,
      event: 'ISSUED',
      eventDate: invoice.onDate,
      createdBy: migratedBy,
    }

    // Override source type for migration
    const entryInput = buildIssuedEntry(issuedContext)
    entryInput.source.type = 'migration'

    const alreadyPosted = await hasJournalEntryForEvent(invoice.path, 'ISSUED')
    if (alreadyPosted) {
      results.issuedEntry = { created: false, skipped: 'ISSUED entry already exists' }
    } else {
      const entry = await createJournalEntry(entryInput)
      results.issuedEntry = { created: true, journalId: entry.id }
    }
  }

  // Create PAID entry for Cleared invoices
  if (normalized === 'cleared') {
    if (!invoice.paidOn || !invoice.paidTo) {
      console.warn(`Invoice ${invoice.invoiceNumber} is Cleared but missing paidOn or paidTo`)
      results.paidEntry = { created: false, skipped: 'Missing paidOn or paidTo' }
      return results
    }

    const bankAccountCode = resolveBankAccountCode(invoice.paidTo)

    const paidContext: PostingContext = {
      invoicePath: invoice.path,
      invoiceNumber: invoice.invoiceNumber,
      companyName: invoice.companyName,
      amount: invoice.amount,
      event: 'PAID',
      eventDate: invoice.paidOn,
      bankAccountCode,
      createdBy: migratedBy,
    }

    const entryInput = buildPaidEntry(paidContext)
    entryInput.source.type = 'migration'

    const alreadyPosted = await hasJournalEntryForEvent(invoice.path, 'PAID')
    if (alreadyPosted) {
      results.paidEntry = { created: false, skipped: 'PAID entry already exists' }
    } else {
      const entry = await createJournalEntry(entryInput)
      results.paidEntry = { created: true, journalId: entry.id }
    }
  }

  return results
}

/**
 * Get all journal entries for an invoice.
 */
export async function getInvoiceJournalEntries(invoicePath: string) {
  return findJournalEntriesForSource(invoicePath)
}
