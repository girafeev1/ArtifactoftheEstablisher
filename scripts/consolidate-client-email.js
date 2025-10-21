#!/usr/bin/env node
/*
 * Consolidate client email into a single 'email' field.
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/consolidate-client-email.js [--dry-run]
 */
/* eslint-disable no-console */
const { Firestore, FieldValue } = require('@google-cloud/firestore')

function getRequiredEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env: ${name}`)
    process.exit(2)
  }
  return v
}

function unescapePrivateKey(k) {
  return k.replace(/\\n/g, '\n').replace(/^"|"$/g, '')
}

const projectId = getRequiredEnv('FIREBASE_ADMIN_PROJECT_ID')
const client_email = getRequiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
const private_key = unescapePrivateKey(getRequiredEnv('FIREBASE_ADMIN_PRIVATE_KEY'))

const DB_ID = 'epl-directory'
const DRY_RUN = process.argv.includes('--dry-run')

const db = new Firestore({
  projectId,
  credentials: { client_email, private_key },
  databaseId: DB_ID,
})

async function migrate() {
  console.log(`[migrate] Consolidating client email in DB: ${DB_ID} (dryRun=${DRY_RUN})`)
  const clientsRef = db.collection('clients')
  const snapshot = await clientsRef.get()

  if (snapshot.empty) {
    console.log('[migrate] No clients found.')
    return
  }

  let updatedCount = 0
  const batch = db.batch()

  snapshot.forEach(doc => {
    const data = doc.data()
    const email = data.email
    const emailAddress = data.emailAddress

    // We only need to update if 'email' is empty and 'emailAddress' has a value
    if (!email && emailAddress) {
      console.log(`[migrate] Updating doc: ${doc.id}`)
      console.log(`  - email: ${email}, emailAddress: ${emailAddress}`)
      console.log(`  -> email: ${emailAddress}`)

      const payload = {
        email: emailAddress,
        emailAddress: FieldValue.delete(),
      }
      batch.update(doc.ref, payload)
      updatedCount++
    }
  })

  console.log(`[migrate] ${updatedCount} documents to be updated.`)

  if (!DRY_RUN && updatedCount > 0) {
    console.log('[migrate] Committing changes...')
    await batch.commit()
    console.log('[migrate] Changes committed.')
  } else {
    console.log('[migrate] Dry run, no changes were committed.')
  }

  console.log(`[migrate] Completed.`) 
}

migrate().catch((e) => {
  console.error('[migrate] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})
