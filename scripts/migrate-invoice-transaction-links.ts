/**
 * Migration Script: Invoice-Transaction Bidirectional Linking
 *
 * This script migrates existing data to the new bidirectional linking model:
 * 1. Finds all transactions with matchedInvoices[]
 * 2. Updates each matched invoice with linkedTransactions[] and amountPaid
 * 3. Links paidJournalId in transaction's matchedInvoices
 * 4. Reports orphan Cleared invoices (Cleared without transaction)
 *
 * Run with: npx tsx scripts/migrate-invoice-transaction-links.ts [--dry-run]
 */

import { Firestore } from '@google-cloud/firestore'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

interface LinkedTransaction {
  transactionId: string
  amount: number
  linkedAt: string
  linkedBy: string
}

interface MatchedInvoice {
  invoiceNumber: string
  projectId: string
  year: string
  amount: number
  paidJournalId?: string
}

function getFirestoreAdmin(): Firestore {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  const privateKey = privateKeyRaw?.replace(/\\n/g, '\n')
  const databaseId = process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'tebs-erl'

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials')
  }

  return new Firestore({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
    databaseId,
  })
}

function calculateInvoiceTotal(data: Record<string, any>): number {
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

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n')
  }

  const db = getFirestoreAdmin()

  console.log('='.repeat(80))
  console.log('Invoice-Transaction Bidirectional Linking Migration')
  console.log('='.repeat(80))
  console.log('')

  // Step 1: Get all transactions with matchedInvoices
  console.log('Step 1: Finding transactions with matched invoices...')
  const transactionsSnapshot = await db
    .collection('accounting')
    .doc('transactions')
    .collection('entries')
    .get()

  const matchedTransactions = transactionsSnapshot.docs.filter(doc => {
    const data = doc.data()
    return data.matchedInvoices && Array.isArray(data.matchedInvoices) && data.matchedInvoices.length > 0
  })

  console.log(`  Found ${matchedTransactions.length} transactions with matched invoices`)
  console.log('')

  // Step 2: Get all journal entries for linking paidJournalId
  console.log('Step 2: Loading journal entries...')
  const journalsSnapshot = await db
    .collection('accounting')
    .doc('journals')
    .collection('entries')
    .get()

  // Build a map of invoicePath -> PAID journal entry ID
  const paidJournalMap = new Map<string, string>()
  for (const doc of journalsSnapshot.docs) {
    const data = doc.data()
    if (data.source?.event === 'PAID' && data.source?.path && data.status === 'posted') {
      paidJournalMap.set(data.source.path, doc.id)
    }
  }
  console.log(`  Found ${paidJournalMap.size} PAID journal entries`)
  console.log('')

  // Step 3: Process each transaction
  console.log('Step 3: Processing transactions...')
  let invoicesUpdated = 0
  let transactionsUpdated = 0
  const errors: string[] = []

  for (const txDoc of matchedTransactions) {
    const txData = txDoc.data()
    const transactionId = txDoc.id
    const matchedInvoices: MatchedInvoice[] = txData.matchedInvoices || []

    console.log(`\n  Transaction: ${transactionId}`)
    console.log(`    Matched invoices: ${matchedInvoices.length}`)

    const enrichedInvoices: MatchedInvoice[] = []

    for (const inv of matchedInvoices) {
      const invoicePath = `projects/${inv.year}/projects/${inv.projectId}/invoice/${inv.invoiceNumber}`

      try {
        // Get invoice document
        const invoiceRef = db
          .collection('projects')
          .doc(inv.year)
          .collection('projects')
          .doc(inv.projectId)
          .collection('invoice')
          .doc(inv.invoiceNumber)

        const invoiceDoc = await invoiceRef.get()
        if (!invoiceDoc.exists) {
          console.log(`    ⚠️  Invoice ${inv.invoiceNumber} not found`)
          enrichedInvoices.push(inv)
          continue
        }

        const invoiceData = invoiceDoc.data() || {}
        const invoiceTotal = calculateInvoiceTotal(invoiceData)

        // Check existing linkedTransactions
        const existingLinked: LinkedTransaction[] =
          Array.isArray(invoiceData.linkedTransactions) ? invoiceData.linkedTransactions : []

        // Check if already linked
        const alreadyLinked = existingLinked.some(lt => lt.transactionId === transactionId)
        if (alreadyLinked) {
          console.log(`    ✓ Invoice ${inv.invoiceNumber} already linked`)
          // Still need to check for paidJournalId
          const journalId = paidJournalMap.get(invoicePath)
          enrichedInvoices.push({
            ...inv,
            paidJournalId: journalId || inv.paidJournalId,
          })
          continue
        }

        // Build new linkedTransaction entry
        const newLinkedTransaction: LinkedTransaction = {
          transactionId,
          amount: inv.amount,
          linkedAt: new Date().toISOString(),
          linkedBy: 'migration-script',
        }

        // Calculate new amountPaid
        const existingAmountPaid = existingLinked.reduce((sum, lt) => sum + lt.amount, 0)
        const newAmountPaid = existingAmountPaid + inv.amount

        // Check if fully paid
        const isFullyPaid = Math.abs(newAmountPaid - invoiceTotal) < 0.01

        // Build invoice update
        const invoiceUpdate: Record<string, any> = {
          linkedTransactions: [...existingLinked, newLinkedTransaction],
          amountPaid: newAmountPaid,
          updatedAt: new Date(),
          updatedBy: 'migration-script',
        }

        // Only set Cleared status if fully paid and not already cleared
        if (isFullyPaid && invoiceData.paymentStatus?.toLowerCase() !== 'cleared') {
          invoiceUpdate.paymentStatus = 'Cleared'
        }

        console.log(`    → Invoice ${inv.invoiceNumber}: amountPaid=${newAmountPaid}, total=${invoiceTotal}, fullPaid=${isFullyPaid}`)

        if (!isDryRun) {
          await invoiceRef.update(invoiceUpdate)
        }
        invoicesUpdated++

        // Get paidJournalId for this invoice
        const journalId = paidJournalMap.get(invoicePath)
        enrichedInvoices.push({
          ...inv,
          paidJournalId: journalId,
        })

        if (journalId) {
          console.log(`    → Linked to journal entry: ${journalId}`)
        }

      } catch (error) {
        const msg = `Failed to process invoice ${inv.invoiceNumber}: ${error}`
        console.log(`    ❌ ${msg}`)
        errors.push(msg)
        enrichedInvoices.push(inv)
      }
    }

    // Update transaction with enriched matchedInvoices (includes paidJournalId)
    const hasNewJournalIds = enrichedInvoices.some((inv, i) =>
      inv.paidJournalId && !matchedInvoices[i]?.paidJournalId
    )

    if (hasNewJournalIds) {
      console.log(`    → Updating transaction with paidJournalIds`)
      if (!isDryRun) {
        await txDoc.ref.update({
          matchedInvoices: enrichedInvoices,
          updatedAt: new Date(),
          updatedBy: 'migration-script',
        })
      }
      transactionsUpdated++
    }
  }

  // Step 4: Find orphan Cleared invoices
  console.log('\n' + '='.repeat(80))
  console.log('Step 4: Finding orphan Cleared invoices...')

  const currentYear = new Date().getFullYear()
  const yearsToCheck = [
    String(currentYear),
    String(currentYear - 1),
    String(currentYear - 2),
  ]

  // Build set of all linked invoice paths
  const linkedInvoicePaths = new Set<string>()
  for (const txDoc of matchedTransactions) {
    const data = txDoc.data()
    for (const inv of (data.matchedInvoices || [])) {
      linkedInvoicePaths.add(`projects/${inv.year}/projects/${inv.projectId}/invoice/${inv.invoiceNumber}`)
    }
  }

  const orphanInvoices: string[] = []

  for (const year of yearsToCheck) {
    const yearRef = db.collection('projects').doc(year)
    const yearDoc = await yearRef.get()
    if (!yearDoc.exists) continue

    const projectsSnapshot = await yearRef.collection('projects').get()

    for (const projectDoc of projectsSnapshot.docs) {
      const invoicesSnapshot = await projectDoc.ref.collection('invoice').get()

      for (const invoiceDoc of invoicesSnapshot.docs) {
        const data = invoiceDoc.data()
        const path = `projects/${year}/projects/${projectDoc.id}/invoice/${invoiceDoc.id}`

        // Check if Cleared but not linked to any transaction
        if (data.paymentStatus?.toLowerCase() === 'cleared' && !linkedInvoicePaths.has(path)) {
          // Also check if it has linkedTransactions
          if (!data.linkedTransactions || data.linkedTransactions.length === 0) {
            orphanInvoices.push(path)
          }
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('Migration Summary')
  console.log('='.repeat(80))
  console.log(`  Transactions processed: ${matchedTransactions.length}`)
  console.log(`  Invoices updated: ${invoicesUpdated}`)
  console.log(`  Transactions updated with paidJournalId: ${transactionsUpdated}`)
  console.log(`  Errors: ${errors.length}`)
  console.log(`  Orphan Cleared invoices: ${orphanInvoices.length}`)

  if (orphanInvoices.length > 0) {
    console.log('\n⚠️  Orphan Cleared invoices (Cleared but no transaction):')
    for (const path of orphanInvoices) {
      console.log(`    ${path}`)
    }
    console.log('\n  These invoices may need manual review or status reset.')
  }

  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:')
    for (const err of errors) {
      console.log(`    ${err}`)
    }
  }

  if (isDryRun) {
    console.log('\n🔍 DRY RUN COMPLETE - No changes were made')
    console.log('   Run without --dry-run to apply changes')
  } else {
    console.log('\n✅ Migration complete!')
  }
}

main().catch(console.error)
