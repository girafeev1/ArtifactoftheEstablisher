/**
 * Invoice Posting Hook
 *
 * DEPRECATED: Journal entries are now derived on-the-fly from invoices and transactions.
 * These functions are kept for backwards compatibility but no longer create journal entries.
 *
 * The derived journal system provides:
 * - Simplicity: No create/void cycle for journal entries
 * - Consistency: Always reflects current state of invoices and transactions
 * - Flexibility: Re-matching transactions doesn't require journal management
 * - Clean slate: Deleted invoices leave no trace in journals
 */

import type { ProjectInvoiceRecord } from '../projectInvoices'

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
// Main Hook Functions (No-op - Journal entries are now derived)
// ============================================================================

/**
 * Handle posting for a newly created invoice.
 *
 * DEPRECATED: Journal entries are now derived from invoices automatically.
 * This function is kept for backwards compatibility but does nothing.
 */
export async function handleInvoiceCreated(ctx: InvoicePostingContext): Promise<PostingResult> {
  console.log('[invoiceHook] handleInvoiceCreated called (no-op, entries are derived)', {
    invoiceNumber: ctx.invoice.invoiceNumber,
    status: ctx.invoice.paymentStatus,
  })

  // Return empty result - ISSUED entries are now derived from invoices with status Due/Cleared
  return {}
}

/**
 * Handle posting for an updated invoice.
 *
 * DEPRECATED: Journal entries are now derived from invoices automatically.
 * This function is kept for backwards compatibility but does nothing.
 */
export async function handleInvoiceUpdated(ctx: InvoicePostingContext): Promise<PostingResult> {
  console.log('[invoiceHook] handleInvoiceUpdated called (no-op, entries are derived)', {
    invoiceNumber: ctx.invoice.invoiceNumber,
    oldStatus: ctx.oldPaymentStatus,
    newStatus: ctx.invoice.paymentStatus,
  })

  // Return empty result - ISSUED entries are now derived from invoices with status Due/Cleared
  return {}
}

/**
 * Handle voiding GL entries when an invoice is soft-deleted.
 *
 * DEPRECATED: Journal entries are now derived from invoices automatically.
 * When an invoice is deleted, the derived ISSUED entry simply won't be generated.
 * This function is kept for backwards compatibility but does nothing.
 */
export async function handleInvoiceDeleted(ctx: {
  year: string
  projectId: string
  invoiceNumber: string
  deletedBy: string
}): Promise<{ voidedEntries: string[] }> {
  console.log('[invoiceHook] handleInvoiceDeleted called (no-op, entries are derived)', {
    invoiceNumber: ctx.invoiceNumber,
    projectId: ctx.projectId,
  })

  // Return empty result - deleted invoices are automatically excluded from derived entries
  return { voidedEntries: [] }
}
