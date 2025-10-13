#!/usr/bin/env node
/**
 * Remove bankAccount docs and strip the 'path' field from bankAccountLookup
 * in the directory database (defaults to tebs-erl via NEXT_PUBLIC_DIRECTORY_FIRESTORE_DATABASE_ID
 * or NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID).
 *
 * Steps:
 *  1) For each bankAccountLookup/{id}, if 'path' exists, delete that document at the referenced path.
 *  2) Remove 'path' field from the lookup doc.
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/cleanup-bankAccount-and-strip-path.js
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

const dirDbId =
  process.env.NEXT_PUBLIC_DIRECTORY_FIRESTORE_DATABASE_ID ||
  process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID ||
  'tebs-erl'

const base = { projectId, credentials: { client_email, private_key } }
const db = new Firestore({ ...base, databaseId: dirDbId })

async function run() {
  console.log(`[cleanup-bank] Directory DB: ${dirDbId}`)
  const lookupSnap = await db.collection('bankAccountLookup').get()
  console.log('[cleanup-bank] lookup docs:', lookupSnap.size)
  let deleted = 0
  let stripped = 0
  for (const doc of lookupSnap.docs) {
    const data = doc.data() || {}
    const p = data.path
    if (typeof p === 'string' && p.split('/').length >= 4) {
      try {
        await db.doc(p).delete().catch(() => {}) // delete account doc if present
        deleted++
      } catch { /* ignore */ }
    }
    // strip path
    await doc.ref.update({ path: Firestore.FieldValue.delete() }).catch(() => {})
    stripped++
  }
  console.log('[cleanup-bank] Completed. deleted:', deleted, 'path stripped:', stripped)
}

run().catch((e) => {
  console.error('[cleanup-bank] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})

