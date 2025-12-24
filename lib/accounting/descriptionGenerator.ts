/**
 * Description Generator for Journal Entries
 *
 * Generates human-readable descriptions from structured metadata stored in journal entries.
 * This allows us to store minimal structured data and generate display text dynamically.
 */

import type { JournalEntry, JournalSource, JournalSourceEvent } from './types'

/**
 * Generate a description string from journal entry metadata
 *
 * @param entry - The journal entry with source metadata
 * @returns A formatted description string
 */
export function generateDescription(entry: JournalEntry): string {
  const { source } = entry

  // If no source metadata, fall back to stored description
  if (!source || !source.event) {
    return entry.description || 'Journal Entry'
  }

  // Generate description based on event type
  switch (source.event) {
    case 'ISSUED':
      return generateIssuedDescription(source)

    case 'PAID':
      return generatePaidDescription(source)

    case 'ADJUSTMENT':
      return generateAdjustmentDescription(source)

    case 'VOID':
      return generateVoidDescription(source)

    default:
      // Fallback to stored description for unknown events
      return entry.description || 'Journal Entry'
  }
}

/**
 * Generate description for ISSUED event
 */
function generateIssuedDescription(source: JournalSource): string {
  const invoiceNumber = source.invoiceNumber || 'Unknown'
  const companyName = source.companyName || 'Unknown Client'

  return `Issued Invoice #${invoiceNumber} to ${companyName}`
}

/**
 * Generate description for PAID event
 */
function generatePaidDescription(source: JournalSource): string {
  const invoiceNumber = source.invoiceNumber || 'Unknown'
  const companyName = source.companyName || 'Unknown Client'

  return `Payment received for Invoice #${invoiceNumber} from ${companyName}`
}

/**
 * Generate description for ADJUSTMENT event
 */
function generateAdjustmentDescription(source: JournalSource): string {
  const invoiceNumber = source.invoiceNumber || 'Unknown'
  const companyName = source.companyName || 'Unknown Client'

  return `Adjustment for Invoice #${invoiceNumber} - ${companyName}`
}

/**
 * Generate description for VOID event
 */
function generateVoidDescription(source: JournalSource): string {
  const invoiceNumber = source.invoiceNumber || 'Unknown'
  const companyName = source.companyName || 'Unknown Client'

  return `VOID: Invoice #${invoiceNumber} - ${companyName}`
}

/**
 * Format description with styling hints for display
 *
 * Returns an object with parts that can be styled differently in the UI:
 * - prefix: The action word (Issued, Payment, etc.)
 * - invoiceNumber: The invoice number (for bold styling)
 * - connector: Connecting words (to, from, etc.)
 * - companyName: The company name (for colored styling)
 *
 * @param entry - The journal entry
 * @returns Structured parts for styled display, or null if can't be parsed
 */
export function getDescriptionParts(entry: JournalEntry): DescriptionParts | null {
  const { source } = entry

  if (!source || !source.event || !source.invoiceNumber || !source.companyName) {
    return null
  }

  switch (source.event) {
    case 'ISSUED':
      return {
        prefix: 'Issued Invoice',
        invoiceNumber: `#${source.invoiceNumber}`,
        connector: 'to',
        companyName: source.companyName,
        event: 'ISSUED',
      }

    case 'PAID':
      return {
        prefix: 'Payment received for Invoice',
        invoiceNumber: `#${source.invoiceNumber}`,
        connector: 'from',
        companyName: source.companyName,
        event: 'PAID',
      }

    case 'ADJUSTMENT':
      return {
        prefix: 'Adjustment for Invoice',
        invoiceNumber: `#${source.invoiceNumber}`,
        connector: '-',
        companyName: source.companyName,
        event: 'ADJUSTMENT',
      }

    case 'VOID':
      return {
        prefix: 'VOID: Invoice',
        invoiceNumber: `#${source.invoiceNumber}`,
        connector: '-',
        companyName: source.companyName,
        event: 'VOID',
      }

    default:
      return null
  }
}

export interface DescriptionParts {
  prefix: string
  invoiceNumber: string
  connector: string
  companyName: string
  event: JournalSourceEvent
}

/**
 * Check if an entry has structured metadata for description generation
 */
export function hasStructuredMetadata(entry: JournalEntry): boolean {
  return !!(
    entry.source &&
    entry.source.event &&
    entry.source.invoiceNumber &&
    entry.source.companyName
  )
}
