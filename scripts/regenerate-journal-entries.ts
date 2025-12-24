/**
 * Migration: Delete and Regenerate Journal Entries
 *
 * This script:
 * 1. Deletes ALL existing journal entries
 * 2. Fetches ALL invoices across all years/projects
 * 3. Creates ISSUED entries with new structured metadata format
 *
 * Run with: npx tsx scripts/regenerate-journal-entries.ts
 *
 * NOTE: PAID entries will be created when bank transactions are matched to invoices
 *       going forward. This migration only creates ISSUED entries.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Initialize Firebase Admin
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const databaseId = process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID || '(default)'

console.log('Project ID:', projectId)
console.log('Database ID:', databaseId)

if (!getApps().length) {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (clientEmail && privateKey) {
    console.log('Using service account from env vars:', clientEmail)
    initializeApp({
      credential: cert({
        projectId: projectId!,
        clientEmail,
        privateKey,
      }),
      projectId,
    })
  } else {
    console.log('Using default credentials')
    initializeApp({ projectId })
  }
}

const db = getFirestore(databaseId)

// Account codes
const ACCOUNTS_RECEIVABLE = '1100'
const SERVICE_REVENUE = '4000'

interface InvoiceData {
  invoiceNumber: string
  projectId: string
  year: string
  companyName: string
  subsidiaryId?: string
  invoiceDate: Timestamp | Date | string
  totalAmount: number
  paymentStatus: string
}

/**
 * Calculate invoice total from item fields (item1UnitPrice, item1Quantity, etc.)
 */
function calculateInvoiceTotal(invData: Record<string, any>): number {
  let subtotal = 0
  let totalDiscount = 0
  const itemsCount = invData.itemsCount || 10 // Default to checking up to 10 items

  for (let i = 1; i <= itemsCount; i++) {
    const unitPrice = parseFloat(invData[`item${i}UnitPrice`]) || 0
    const quantity = parseFloat(invData[`item${i}Quantity`]) || 0
    const discount = parseFloat(invData[`item${i}Discount`]) || 0

    subtotal += unitPrice * quantity
    totalDiscount += discount
  }

  // Apply tax/discount percentage if present
  const taxOrDiscountPercent = parseFloat(invData.taxOrDiscountPercent) || 0
  if (taxOrDiscountPercent !== 0) {
    // Positive = tax, negative = discount
    subtotal = subtotal * (1 + taxOrDiscountPercent / 100)
  }

  return subtotal - totalDiscount
}

async function deleteAllJournalEntries(): Promise<number> {
  console.log('\n--- Deleting existing journal entries ---')

  const journalsRef = db.collection('accounting').doc('journals').collection('entries')
  const snapshot = await journalsRef.get()

  console.log(`Found ${snapshot.size} entries to delete`)

  if (snapshot.size === 0) {
    return 0
  }

  // Delete in batches of 500 (Firestore limit)
  const batchSize = 500
  let deleted = 0

  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch()
    const chunk = snapshot.docs.slice(i, i + batchSize)

    for (const doc of chunk) {
      batch.delete(doc.ref)
    }

    await batch.commit()
    deleted += chunk.length
    console.log(`Deleted ${deleted}/${snapshot.size} entries`)
  }

  return deleted
}

async function fetchAllInvoices(): Promise<InvoiceData[]> {
  console.log('\n--- Fetching all invoices ---')

  const invoices: InvoiceData[] = []

  // Fetch all years
  const yearsSnapshot = await db.collection('projects').get()
  console.log(`Found ${yearsSnapshot.size} year documents`)

  for (const yearDoc of yearsSnapshot.docs) {
    const year = yearDoc.id

    // Skip non-year documents
    if (!/^\d{4}$/.test(year)) {
      continue
    }

    console.log(`Processing year: ${year}`)

    // Fetch all projects for this year
    const projectsSnapshot = await db
      .collection('projects')
      .doc(year)
      .collection('projects')
      .get()

    console.log(`  Found ${projectsSnapshot.size} projects`)

    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id
      const projectData = projectDoc.data()

      // Fetch invoice subcollection
      const invoicesSnapshot = await db
        .collection('projects')
        .doc(year)
        .collection('projects')
        .doc(projectId)
        .collection('invoice')
        .get()

      for (const invoiceDoc of invoicesSnapshot.docs) {
        const invData = invoiceDoc.data()

        // Skip deleted or draft invoices
        if (invData.deleted || invData.status === 'draft') {
          continue
        }

        // Only process issued or paid invoices
        const paymentStatus = invData.paymentStatus || 'due'
        if (paymentStatus === 'draft') {
          continue
        }

        // Calculate total from item fields
        const totalAmount = calculateInvoiceTotal(invData)

        invoices.push({
          invoiceNumber: invoiceDoc.id,
          projectId,
          year,
          companyName: projectData.companyName || invData.companyName || 'Unknown Client',
          subsidiaryId: projectData.subsidiaryIdentifier || projectData.subsidiary || 'erl',
          invoiceDate: invData.invoiceDate || invData.createdAt,
          totalAmount,
          paymentStatus,
        })
      }
    }
  }

  console.log(`Total invoices found: ${invoices.length}`)
  return invoices
}

function toFirestoreTimestamp(dateValue: Timestamp | Date | string | undefined): Timestamp {
  if (!dateValue) {
    return Timestamp.now()
  }

  if (dateValue instanceof Timestamp) {
    return dateValue
  }

  if (dateValue instanceof Date) {
    return Timestamp.fromDate(dateValue)
  }

  // String date
  const parsed = new Date(dateValue)
  if (!isNaN(parsed.getTime())) {
    return Timestamp.fromDate(parsed)
  }

  return Timestamp.now()
}

async function createJournalEntry(invoice: InvoiceData): Promise<string> {
  const journalsRef = db.collection('accounting').doc('journals').collection('entries')

  const postingDate = toFirestoreTimestamp(invoice.invoiceDate)

  const entry = {
    postingDate,
    status: 'posted',
    source: {
      type: 'invoice',
      path: `projects/${invoice.year}/projects/${invoice.projectId}/invoice/${invoice.invoiceNumber}`,
      event: 'ISSUED',
      invoiceNumber: invoice.invoiceNumber,
      companyName: invoice.companyName,
      projectId: invoice.projectId,
    },
    lines: [
      {
        accountCode: ACCOUNTS_RECEIVABLE,
        debit: invoice.totalAmount,
        credit: 0,
        memo: `AR - ${invoice.companyName}`,
      },
      {
        accountCode: SERVICE_REVENUE,
        debit: 0,
        credit: invoice.totalAmount,
        memo: `Revenue - ${invoice.invoiceNumber}`,
      },
    ],
    subsidiaryId: invoice.subsidiaryId || 'erl',
    createdAt: Timestamp.now(),
    createdBy: 'migration-script',
  }

  const docRef = await journalsRef.add(entry)
  return docRef.id
}

async function regenerateJournalEntries() {
  console.log('\n========================================')
  console.log('Journal Entry Regeneration Migration')
  console.log('========================================\n')

  // Step 1: Delete all existing entries
  const deleted = await deleteAllJournalEntries()
  console.log(`\nDeleted ${deleted} existing entries`)

  // Step 2: Fetch all invoices
  const invoices = await fetchAllInvoices()

  if (invoices.length === 0) {
    console.log('\nNo invoices found. Migration complete.')
    return
  }

  // Step 3: Create ISSUED entries for each invoice
  console.log('\n--- Creating ISSUED entries ---')

  let created = 0
  let errors = 0

  for (const invoice of invoices) {
    try {
      const entryId = await createJournalEntry(invoice)
      created++

      if (created % 10 === 0 || created === invoices.length) {
        console.log(`Created ${created}/${invoices.length} entries`)
      }
    } catch (err) {
      console.error(`Failed to create entry for ${invoice.invoiceNumber}:`, err)
      errors++
    }
  }

  console.log('\n========================================')
  console.log('Migration Complete')
  console.log('========================================')
  console.log(`Deleted: ${deleted} old entries`)
  console.log(`Created: ${created} new ISSUED entries`)
  console.log(`Errors: ${errors}`)
  console.log('\nNote: PAID entries will be created when bank')
  console.log('transactions are matched to invoices.')
  console.log('========================================\n')
}

// Run migration
regenerateJournalEntries()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
