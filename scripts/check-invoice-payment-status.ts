/**
 * Check Invoice Payment Status
 *
 * This script checks all invoices and shows which ones have paidOn/paidTo set.
 * Use this to identify invoices that may have been incorrectly marked as paid.
 *
 * Run with: npx tsx scripts/check-invoice-payment-status.ts
 */

import { Firestore } from '@google-cloud/firestore'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

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

async function main() {
  const db = getFirestoreAdmin()

  const currentYear = new Date().getFullYear()
  const yearsToCheck = [
    String(currentYear),
    String(currentYear - 1),
    String(currentYear - 2),
  ]

  console.log('Checking invoices in years:', yearsToCheck.join(', '))
  console.log('='.repeat(80))

  let totalInvoices = 0
  let paidInvoices = 0
  let unpaidInvoices = 0

  for (const year of yearsToCheck) {
    const yearRef = db.collection('projects').doc(year)
    const yearDoc = await yearRef.get()

    if (!yearDoc.exists) {
      console.log(`Year ${year}: No projects found`)
      continue
    }

    const projectsSnapshot = await yearRef.collection('projects').get()

    for (const projectDoc of projectsSnapshot.docs) {
      const invoicesSnapshot = await projectDoc.ref.collection('invoice').get()

      for (const invoiceDoc of invoicesSnapshot.docs) {
        const data = invoiceDoc.data()
        totalInvoices++

        const hasPaidOn = !!data.paidOn
        const hasPaidTo = typeof data.paidTo === 'string' && data.paidTo.includes('-')
        const isPaid = hasPaidOn && hasPaidTo

        if (isPaid) {
          paidInvoices++
        } else {
          unpaidInvoices++
          console.log(`UNPAID: ${year}/${projectDoc.id}/${invoiceDoc.id}`)
          console.log(`  paidOn: ${data.paidOn || 'not set'}`)
          console.log(`  paidTo: ${data.paidTo || 'not set'}`)
          console.log(`  paymentStatus: ${data.paymentStatus || 'not set'}`)
        }
      }
    }
  }

  console.log('='.repeat(80))
  console.log('Summary:')
  console.log(`  Total invoices: ${totalInvoices}`)
  console.log(`  Paid (has paidOn AND paidTo): ${paidInvoices}`)
  console.log(`  Unpaid (missing paidOn or paidTo): ${unpaidInvoices}`)

  if (unpaidInvoices === 0) {
    console.log('')
    console.log('⚠️  ALL invoices have paidOn AND paidTo set!')
    console.log('   This means all invoices are considered paid.')
    console.log('')
    console.log('To fix this, you can run:')
    console.log('  npx tsx scripts/check-invoice-payment-status.ts --clear-unlinked')
    console.log('')
    console.log('This will clear paidOn/paidTo from invoices that do NOT have a')
    console.log('matching transaction in the bank transactions collection.')
  }

  // If --clear-unlinked flag is passed, clear paidOn/paidTo from unlinked invoices
  if (process.argv.includes('--clear-unlinked')) {
    console.log('')
    console.log('Checking for invoices with paidTo but no matching transaction...')
    await clearUnlinkedInvoices(db, yearsToCheck)
  }
}

async function clearUnlinkedInvoices(db: Firestore, years: string[]) {
  // First, get all transactions and build a set of linked invoice paths
  const linkedInvoices = new Set<string>()

  const transactionsSnapshot = await db.collection('bankTransactions').get()
  console.log(`Found ${transactionsSnapshot.size} bank transactions`)

  for (const txDoc of transactionsSnapshot.docs) {
    const data = txDoc.data()
    if (data.matchedInvoices && Array.isArray(data.matchedInvoices)) {
      for (const inv of data.matchedInvoices) {
        // Build the invoice path
        const path = `projects/${inv.year}/projects/${inv.projectId}/invoice/${inv.invoiceNumber}`
        linkedInvoices.add(path)
      }
    }
  }

  console.log(`Found ${linkedInvoices.size} invoices linked to transactions`)

  // Now check each invoice
  let cleared = 0

  for (const year of years) {
    const yearRef = db.collection('projects').doc(year)
    const yearDoc = await yearRef.get()

    if (!yearDoc.exists) continue

    const projectsSnapshot = await yearRef.collection('projects').get()

    for (const projectDoc of projectsSnapshot.docs) {
      const invoicesSnapshot = await projectDoc.ref.collection('invoice').get()

      for (const invoiceDoc of invoicesSnapshot.docs) {
        const data = invoiceDoc.data()
        const path = `projects/${year}/projects/${projectDoc.id}/invoice/${invoiceDoc.id}`

        // If invoice has paidTo but is NOT in linkedInvoices, clear it
        if (data.paidTo && !linkedInvoices.has(path)) {
          console.log(`Clearing: ${path}`)
          console.log(`  Current paidOn: ${data.paidOn?._seconds ? new Date(data.paidOn._seconds * 1000).toISOString() : data.paidOn}`)
          console.log(`  Current paidTo: ${data.paidTo}`)

          // Clear the fields
          await invoiceDoc.ref.update({
            paidOn: null,
            paidTo: null,
            paymentStatus: 'Outstanding',
          })

          cleared++
        }
      }
    }
  }

  console.log('')
  console.log(`Cleared ${cleared} invoices that had paidTo but no matching transaction`)
}

main().catch(console.error)
