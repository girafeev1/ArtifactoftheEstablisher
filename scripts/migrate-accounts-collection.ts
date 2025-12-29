/**
 * Migration Script: Move accounts collection
 * 
 * Moves accounts from:
 *   accounting/settings/accounts/{code}
 * To:
 *   accounting/accounts/entries/{code}
 * 
 * Usage: npx tsx scripts/migrate-accounts-collection.ts
 */

import { Firestore, FieldValue } from '@google-cloud/firestore'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

function getFirestore(): Firestore {
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

async function migrateAccounts() {
  const db = getFirestore()
  
  // Old path: accounting/settings/accounts
  const oldCollectionRef = db.collection('accounting').doc('settings').collection('accounts')
  
  // New path: accounting/accounts/entries
  const newCollectionRef = db.collection('accounting').doc('accounts').collection('entries')
  
  console.log('Reading accounts from old location...')
  const oldAccounts = await oldCollectionRef.get()
  
  if (oldAccounts.empty) {
    console.log('No accounts found in old location. Nothing to migrate.')
    return
  }
  
  console.log(`Found ${oldAccounts.size} accounts to migrate`)
  
  let migrated = 0
  let skipped = 0
  
  for (const doc of oldAccounts.docs) {
    const accountCode = doc.id
    const data = doc.data()
    
    // Check if account already exists in new location
    const existingDoc = await newCollectionRef.doc(accountCode).get()
    if (existingDoc.exists) {
      console.log(`  [SKIP] ${accountCode} - already exists in new location`)
      skipped++
      continue
    }
    
    // Copy to new location
    await newCollectionRef.doc(accountCode).set({
      ...data,
      migratedAt: FieldValue.serverTimestamp(),
    })
    
    console.log(`  [OK] ${accountCode} - ${data.name}`)
    migrated++
  }
  
  console.log('')
  console.log('Migration complete!')
  console.log(`  Migrated: ${migrated}`)
  console.log(`  Skipped: ${skipped}`)
  console.log('')
  console.log('NOTE: Old accounts are preserved. You can manually delete them after verifying.')
  console.log('Old path: accounting/settings/accounts')
  console.log('New path: accounting/accounts/entries')
}

migrateAccounts().catch(console.error)
