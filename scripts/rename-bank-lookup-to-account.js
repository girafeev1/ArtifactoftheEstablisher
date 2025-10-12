#!/usr/bin/env node
/**
 * Copy all docs from bankAccountLookup to bankAccount (flat) in DIRECTORY DB
 * and delete bankAccountLookup docs afterwards.
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/rename-bank-lookup-to-account.js
 */
/* eslint-disable no-console */
const { Firestore } = require('@google-cloud/firestore')

function unescapePrivateKey(k) {
  return (k || '').replace(/\\n/g, '\n').replace(/^"|"$/g, '')
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
const client_email = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const private_key = unescapePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY || '')
if (!projectId || !client_email || !private_key) {
  console.error('Missing FIREBASE_ADMIN_* envs')
  process.exit(2)
}

const dbId = process.env.NEXT_PUBLIC_DIRECTORY_FIRESTORE_DATABASE_ID || process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID || 'tebs-erl'
const db = new Firestore({ projectId, credentials: { client_email, private_key }, databaseId: dbId })

async function run() {
  console.log(`[rename] ${dbId}: bankAccountLookup -> bankAccount`)
  const snap = await db.collection('bankAccountLookup').get()
  console.log('[rename] lookup docs:', snap.size)
  for (const d of snap.docs) {
    const id = d.id
    const data = d.data() || {}
    await db.collection('bankAccount').doc(id).set(data, { merge: false })
    await d.ref.delete()
  }
  console.log('[rename] Completed')
}

run().catch((e) => {
  console.error('[rename] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})

