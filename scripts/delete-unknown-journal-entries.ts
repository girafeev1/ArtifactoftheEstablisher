/**
 * Cleanup: Delete Invalid Journal Entries
 *
 * This script finds and deletes journal entries that have:
 * - "Unknown" in the invoice number
 * - "Unknown Client" in the company name
 * - Zero amounts
 *
 * Run with: npx tsx scripts/delete-unknown-journal-entries.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
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

interface JournalEntry {
  id: string
  description?: string
  source?: {
    invoiceNumber?: string
    companyName?: string
  }
  lines?: Array<{
    debit: number
    credit: number
  }>
}

function isInvalidEntry(entry: JournalEntry): { invalid: boolean; reason: string } {
  const desc = entry.description?.toLowerCase() || ''
  const invoiceNumber = entry.source?.invoiceNumber?.toLowerCase() || ''
  const companyName = entry.source?.companyName?.toLowerCase() || ''

  // Check for "Unknown" in invoice number or company name
  if (invoiceNumber.includes('unknown')) {
    return { invalid: true, reason: 'Unknown invoice number' }
  }

  if (companyName.includes('unknown')) {
    return { invalid: true, reason: 'Unknown company name' }
  }

  // Check for "Unknown" in description
  if (desc.includes('unknown client') || desc.includes('invoice #unknown')) {
    return { invalid: true, reason: 'Unknown in description' }
  }

  // Check for zero amounts
  const totalDebit = entry.lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0
  const totalCredit = entry.lines?.reduce((sum, line) => sum + (line.credit || 0), 0) || 0

  if (totalDebit === 0 && totalCredit === 0) {
    return { invalid: true, reason: 'Zero amount entry' }
  }

  return { invalid: false, reason: '' }
}

async function deleteUnknownEntries() {
  console.log('\n========================================')
  console.log('Journal Entry Cleanup - Delete Unknown Entries')
  console.log('========================================\n')

  const journalsRef = db.collection('accounting').doc('journals').collection('entries')
  const snapshot = await journalsRef.get()

  console.log(`Found ${snapshot.size} total journal entries`)

  const invalidEntries: Array<{ id: string; reason: string; description?: string }> = []

  for (const doc of snapshot.docs) {
    const data = doc.data() as JournalEntry
    data.id = doc.id

    const { invalid, reason } = isInvalidEntry(data)
    if (invalid) {
      invalidEntries.push({
        id: doc.id,
        reason,
        description: data.description?.substring(0, 60),
      })
    }
  }

  console.log(`\nFound ${invalidEntries.length} invalid entries to delete:\n`)

  if (invalidEntries.length === 0) {
    console.log('No invalid entries found. Nothing to delete.')
    return
  }

  // List invalid entries
  invalidEntries.forEach((entry, i) => {
    console.log(`[${i + 1}] ${entry.id}`)
    console.log(`    Reason: ${entry.reason}`)
    console.log(`    Description: ${entry.description || 'N/A'}`)
    console.log('')
  })

  // Confirm deletion
  console.log('\n--- Deleting invalid entries ---')

  // Delete in batches of 500
  const batchSize = 500
  let deleted = 0

  for (let i = 0; i < invalidEntries.length; i += batchSize) {
    const batch = db.batch()
    const chunk = invalidEntries.slice(i, i + batchSize)

    for (const entry of chunk) {
      const docRef = journalsRef.doc(entry.id)
      batch.delete(docRef)
    }

    await batch.commit()
    deleted += chunk.length
    console.log(`Deleted ${deleted}/${invalidEntries.length} entries`)
  }

  console.log('\n========================================')
  console.log('Cleanup Complete')
  console.log('========================================')
  console.log(`Deleted: ${deleted} invalid entries`)
  console.log('========================================\n')
}

// Run cleanup
deleteUnknownEntries()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Cleanup failed:', err)
    process.exit(1)
  })
