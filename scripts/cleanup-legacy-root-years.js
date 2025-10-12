#!/usr/bin/env node
/**
 * Delete legacy root-level year collections (e.g., 2021..2025) from the given database.
 * Leaves nested /projects/{year}/projects intact.
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/cleanup-legacy-root-years.js [--db tebs-erl]
 */
/* eslint-disable no-console */
const { Firestore } = require('@google-cloud/firestore')

function getEnv(name, required = false) {
  const v = process.env[name]
  if (required && !v) {
    console.error(`Missing env: ${name}`)
    process.exit(2)
  }
  return v
}

function unescapePrivateKey(k) {
  return (k || '').replace(/\\n/g, '\n').replace(/^"|"$/g, '')
}

const projectId = getEnv('FIREBASE_ADMIN_PROJECT_ID', true)
const client_email = getEnv('FIREBASE_ADMIN_CLIENT_EMAIL', true)
const private_key = unescapePrivateKey(getEnv('FIREBASE_ADMIN_PRIVATE_KEY', true))
const DB_ID = process.argv.includes('--db')
  ? process.argv[process.argv.indexOf('--db') + 1]
  : process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID || 'tebs-erl'

const base = { projectId, credentials: { client_email, private_key } }
const db = new Firestore({ ...base, databaseId: DB_ID })

async function deleteCollection(collRef) {
  const snapshot = await collRef.get()
  for (const doc of snapshot.docs) {
    const subs = await doc.ref.listCollections()
    for (const sub of subs) {
      await deleteCollection(sub)
    }
    await doc.ref.delete()
  }
}

async function run() {
  console.log(`[cleanup] Database: ${DB_ID}`)
  const root = await db.listCollections()
  const years = root.map((c) => c.id).filter((id) => /^\d{4}$/.test(id)).sort()
  console.log('[cleanup] Root years:', years)
  for (const year of years) {
    console.log(`[cleanup] Deleting /${year} ...`)
    await deleteCollection(db.collection(year))
  }
  console.log('[cleanup] Completed')
}

run().catch((e) => {
  console.error('[cleanup] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})

