/**
 * Migration: Move journal entries to new path and update descriptions
 *
 * Path change: accounting/settings/journals/{id} → accounting/journals/entries/{id}
 * Description change: "Invoice X issued to Y" → "Issued Invoice X to Y"
 *
 * Run with: npx tsx scripts/migrate-journal-descriptions.ts
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

async function migrateJournals() {
  console.log('\nStarting journal migration...')

  // Old path: accounting/settings/journals
  const oldJournalsRef = db.collection('accounting').doc('settings').collection('journals')
  // New path: accounting/journals/entries
  const newJournalsRef = db.collection('accounting').doc('journals').collection('entries')

  const snapshot = await oldJournalsRef.get()
  console.log(`Found ${snapshot.size} journal entries to migrate`)

  let migrated = 0
  let errors = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    let description = data.description as string
    const event = data.source?.event

    // Update description format for ISSUED entries
    if (event === 'ISSUED' && description && /^Invoice\s+.+\s+issued\s+to\s+/i.test(description)) {
      const match = description.match(/^Invoice\s+(.+?)\s+issued\s+to\s+(.+)$/i)
      if (match) {
        const invoiceNumber = match[1]
        const companyName = match[2]
        description = `Issued Invoice ${invoiceNumber} to ${companyName}`
        console.log(`  ↳ Updated description: "${data.description}" → "${description}"`)
      }
    }

    try {
      // Write to new location with potentially updated description
      await newJournalsRef.doc(doc.id).set({
        ...data,
        description,
      })

      // Delete from old location
      await oldJournalsRef.doc(doc.id).delete()

      console.log(`✓ Migrated ${doc.id}`)
      migrated++
    } catch (err) {
      console.error(`✗ Failed to migrate ${doc.id}:`, err)
      errors++
    }
  }

  console.log('\n--- Migration Complete ---')
  console.log(`Migrated: ${migrated}`)
  console.log(`Errors: ${errors}`)
  console.log(`\nNew path: accounting/journals/entries/{entryId}`)
}

migrateJournals()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
