/**
 * Derived Journal Entries Service
 *
 * This module generates journal entries on-the-fly from invoices and transactions.
 * No entries are stored in Firestore - they are computed when needed.
 *
 * This approach provides:
 * - Simplicity: No create/void cycle for journal entries
 * - Consistency: Always reflects current state of invoices and transactions
 * - Flexibility: Re-matching transactions doesn't require journal management
 * - Clean slate: Deleted invoices leave no trace
 *
 * Journal entries are derived as follows:
 * - ISSUED entries: From invoices with status Due or Cleared
 * - PAID entries: From transactions with matchedInvoices[]
 */

import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { projectsDb } from '../firebase'
import type { JournalEntry, JournalLine, JournalSourceEvent } from './types'
import { ACCOUNT_CODES, BANK_ACCOUNT_TO_GL } from './types'

// ============================================================================
// Types
// ============================================================================

interface InvoiceData {
  invoiceNumber: string
  projectId: string
  year: string
  companyName?: string
  paymentStatus?: string
  itemsCount?: number
  taxOrDiscountPercent?: number
  createdAt?: any
  onDate?: any
  paidOn?: any
  linkedTransactions?: {
    transactionId: string
    amount: number
    linkedAt: string
    linkedBy: string
  }[]
  [key: string]: any // For dynamic item fields
}

interface TransactionData {
  id: string
  transactionDate: any
  amount: number
  isDebit?: boolean
  currency: string
  bankAccountId: string
  payerName: string
  status: string
  matchedInvoices?: {
    invoiceNumber: string
    projectId: string
    year: string
    amount: number
  }[]
  subsidiaryId: string
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateInvoiceTotal(data: InvoiceData): number {
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

function parseFirestoreDate(dateValue: any): Date {
  if (!dateValue) return new Date()

  if (dateValue instanceof Timestamp) {
    return dateValue.toDate()
  }
  if (typeof dateValue === 'object' && '_seconds' in dateValue) {
    return new Date(dateValue._seconds * 1000)
  }
  if (typeof dateValue === 'object' && 'seconds' in dateValue) {
    return new Date(dateValue.seconds * 1000)
  }
  if (typeof dateValue === 'string') {
    return new Date(dateValue)
  }
  return new Date()
}

function buildInvoicePath(year: string, projectId: string, invoiceNumber: string): string {
  return `projects/${year}/projects/${projectId}/invoice/${invoiceNumber}`
}

function resolveBankAccountCode(bankAccountId: string): string {
  // Use the mapping from bank account IDs to GL account codes
  return BANK_ACCOUNT_TO_GL[bankAccountId] || '1000'
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate ISSUED journal entries from invoices.
 * An ISSUED entry is created for each invoice with status Due or Cleared.
 */
async function generateIssuedEntries(subsidiaryId?: string): Promise<JournalEntry[]> {
  const entries: JournalEntry[] = []

  // Get years to check (current year and past 2 years)
  const currentYear = new Date().getFullYear()
  const yearsToCheck = [
    String(currentYear),
    String(currentYear - 1),
    String(currentYear - 2),
  ]

  for (const year of yearsToCheck) {
    try {
      const yearRef = collection(projectsDb, 'projects', year, 'projects')
      const projectsSnapshot = await getDocs(yearRef)

      for (const projectDoc of projectsSnapshot.docs) {
        const projectData = projectDoc.data()

        // Filter by subsidiary if specified
        if (subsidiaryId && subsidiaryId !== 'all') {
          const projectSubsidiary = projectData.subsidiary?.toLowerCase() || 'erl'
          if (projectSubsidiary !== subsidiaryId.toLowerCase()) continue
        }

        // Get invoices for this project
        const invoicesRef = collection(projectDoc.ref, 'invoice')
        const invoicesSnapshot = await getDocs(invoicesRef)

        for (const invoiceDoc of invoicesSnapshot.docs) {
          const invoice = invoiceDoc.data() as InvoiceData
          const status = invoice.paymentStatus?.toLowerCase()

          // Only generate ISSUED for Due or Cleared invoices (not Draft)
          if (status !== 'due' && status !== 'cleared') continue

          // Skip deleted invoices
          if (invoice.deleted) continue

          const invoiceTotal = calculateInvoiceTotal(invoice)
          if (invoiceTotal <= 0) continue

          const companyName = invoice.companyName || projectData.clientCompany || 'Unknown'
          const invoicePath = buildInvoicePath(year, projectDoc.id, invoiceDoc.id)

          // Use invoice creation date or onDate
          const postingDate = parseFirestoreDate(invoice.onDate || invoice.createdAt)

          const lines: JournalLine[] = [
            {
              accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
              debit: invoiceTotal,
              credit: 0,
              memo: `AR - ${companyName}`,
            },
            {
              accountCode: ACCOUNT_CODES.SERVICE_REVENUE,
              debit: 0,
              credit: invoiceTotal,
              memo: `Revenue - ${invoiceDoc.id}`,
            },
          ]

          entries.push({
            id: `issued-${year}-${projectDoc.id}-${invoiceDoc.id}`,
            postingDate: Timestamp.fromDate(postingDate),
            description: `Issued Invoice ${invoiceDoc.id} to ${companyName}`,
            status: 'posted',
            source: {
              type: 'invoice',
              path: invoicePath,
              event: 'ISSUED' as JournalSourceEvent,
              projectId: projectDoc.id,
              invoiceNumber: invoiceDoc.id,
              companyName,
              // Include project details for tooltip display
              presenter: projectData.presenterWorkType || projectData.presenter || projectData.workType || undefined,
              workType: projectData.workType || undefined,
              projectTitle: projectData.projectTitle || projectData.title || undefined,
              projectNature: projectData.projectNature || undefined,
            },
            lines,
            subsidiaryId: projectData.subsidiary?.toLowerCase() || 'erl',
            createdAt: Timestamp.fromDate(postingDate),
            createdBy: 'system-derived',
          })
        }
      }
    } catch (error) {
      console.error(`Error generating ISSUED entries for year ${year}:`, error)
    }
  }

  return entries
}

/**
 * Generate PAID journal entries from matched transactions.
 * A PAID entry is created for each invoice in a transaction's matchedInvoices[].
 */
async function generatePaidEntries(subsidiaryId?: string): Promise<JournalEntry[]> {
  const entries: JournalEntry[] = []

  try {
    // Get all transactions
    const transactionsRef = collection(projectsDb, 'accounting', 'transactions', 'entries')
    const transactionsSnapshot = await getDocs(transactionsRef)

    for (const txDoc of transactionsSnapshot.docs) {
      const transaction = txDoc.data() as TransactionData
      transaction.id = txDoc.id

      // Filter by subsidiary if specified
      if (subsidiaryId && subsidiaryId !== 'all') {
        if (transaction.subsidiaryId?.toLowerCase() !== subsidiaryId.toLowerCase()) continue
      }

      // Only process transactions with matched invoices
      const matchedInvoices = transaction.matchedInvoices || []
      if (matchedInvoices.length === 0) continue

      const transactionDate = parseFirestoreDate(transaction.transactionDate)
      const bankAccountCode = resolveBankAccountCode(transaction.bankAccountId)

      // Generate a PAID entry for each matched invoice
      for (const inv of matchedInvoices) {
        const invoicePath = buildInvoicePath(inv.year, inv.projectId, inv.invoiceNumber)

        // Fetch company name from invoice and project details
        let companyName = 'Unknown'
        let presenter: string | undefined
        let workType: string | undefined
        let projectTitle: string | undefined
        let projectNature: string | undefined

        try {
          // Fetch project data for details
          const projectRef = doc(projectsDb, 'projects', inv.year, 'projects', inv.projectId)
          const projectDoc = await getDoc(projectRef)
          if (projectDoc.exists()) {
            const projectData = projectDoc.data()
            presenter = projectData.presenterWorkType || projectData.presenter || projectData.workType || undefined
            workType = projectData.workType || undefined
            projectTitle = projectData.projectTitle || projectData.title || undefined
            projectNature = projectData.projectNature || undefined
          }

          // Fetch invoice for company name
          const invoiceRef = collection(
            projectsDb,
            'projects',
            inv.year,
            'projects',
            inv.projectId,
            'invoice'
          )
          const invoiceQuery = query(invoiceRef)
          const invoiceSnapshot = await getDocs(invoiceQuery)
          const invoiceDoc = invoiceSnapshot.docs.find(d => d.id === inv.invoiceNumber)
          if (invoiceDoc) {
            companyName = invoiceDoc.data().companyName || companyName
          }
        } catch {
          // Use default values
        }

        const lines: JournalLine[] = [
          {
            accountCode: bankAccountCode,
            debit: inv.amount,
            credit: 0,
            memo: `Payment received - ${transaction.bankAccountId}`,
          },
          {
            accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
            debit: 0,
            credit: inv.amount,
            memo: `AR cleared - ${companyName}`,
          },
        ]

        entries.push({
          id: `paid-${txDoc.id}-${inv.invoiceNumber}`,
          postingDate: Timestamp.fromDate(transactionDate),
          description: `Received Payment for Invoice ${inv.invoiceNumber} from ${companyName}`,
          status: 'posted',
          source: {
            type: 'invoice',
            path: invoicePath,
            event: 'PAID' as JournalSourceEvent,
            projectId: inv.projectId,
            invoiceNumber: inv.invoiceNumber,
            transactionId: txDoc.id,
            companyName,
            // Include project details for tooltip display
            presenter,
            workType,
            projectTitle,
            projectNature,
          },
          lines,
          subsidiaryId: transaction.subsidiaryId || 'erl',
          createdAt: Timestamp.fromDate(transactionDate),
          createdBy: 'system-derived',
        })
      }
    }
  } catch (error) {
    console.error('Error generating PAID entries:', error)
  }

  return entries
}

/**
 * Generate all derived journal entries (ISSUED + PAID).
 * This is the main function called by the journals API.
 */
export async function getDerivedJournalEntries(
  options: {
    subsidiaryId?: string
    limit?: number
  } = {}
): Promise<JournalEntry[]> {
  const { subsidiaryId, limit } = options

  // Generate both types of entries in parallel
  const [issuedEntries, paidEntries] = await Promise.all([
    generateIssuedEntries(subsidiaryId),
    generatePaidEntries(subsidiaryId),
  ])

  // Combine and sort by posting date (newest first)
  let allEntries = [...issuedEntries, ...paidEntries]
  allEntries.sort((a, b) => {
    const aTime = a.postingDate instanceof Date ? a.postingDate.getTime() : 0
    const bTime = b.postingDate instanceof Date ? b.postingDate.getTime() : 0
    return bTime - aTime
  })

  // Apply limit if specified
  if (limit && limit > 0) {
    allEntries = allEntries.slice(0, limit)
  }

  return allEntries
}

/**
 * Get a single derived journal entry by ID.
 */
export async function getDerivedJournalEntry(entryId: string): Promise<JournalEntry | null> {
  // Parse the entry ID to determine type
  // Format: issued-{year}-{projectId}-{invoiceNumber} or paid-{transactionId}-{invoiceNumber}

  const allEntries = await getDerivedJournalEntries()
  return allEntries.find(e => e.id === entryId) || null
}
