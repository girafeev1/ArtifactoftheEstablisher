#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Remove legacy invoice-* subcollections under each project document.
 *
 * Scope: projects/{year}/projects/{projectId}
 * Keeps: invoice (unified) collection intact
 * Removes: invoice-a, invoice-b, ... (case-insensitive), and optional capitalized 'Invoice' if --include-capital is passed
 *
 * Usage:
 *   set -a; source .env.local; set +a;
 *   node scripts/cleanup-legacy-invoices.js [--db tebs-erl] [--apply] [--include-capital]
 */

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
  return (k || '').replace(/\\n/g, '\n').replace(/^\"|\"$/g, '')
}

const projectId = getEnv('FIREBASE_ADMIN_PROJECT_ID', true)
const client_email = getEnv('FIREBASE_ADMIN_CLIENT_EMAIL', true)
const private_key = unescapePrivateKey(getEnv('FIREBASE_ADMIN_PRIVATE_KEY', true))

const DB_ID = process.argv.includes('--db')
  ? process.argv[process.argv.indexOf('--db') + 1]
  : process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID || process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'tebs-erl'

const APPLY = process.argv.includes('--apply')
const INCLUDE_CAPITAL = process.argv.includes('--include-capital')

const db = new Firestore({ projectId, credentials: { client_email, private_key }, databaseId: DB_ID })

const PROJECTS_ROOT = 'projects'
const PROJECTS_SUBCOLLECTION = 'projects'

const legacyPattern = /^invoice-([a-z]+)$/i

async function deleteAllDocs(collRef) {
  const snap = await collRef.get()
  for (const d of snap.docs) {
    if (APPLY) {
      await d.ref.delete().catch(() => {})
    }
  }
  return snap.size
}

async function run() {
  console.log(`[cleanup-legacy-invoices] Database=${DB_ID} apply=${APPLY} includeCapital=${INCLUDE_CAPITAL}`)
  const years = await db.collection(PROJECTS_ROOT).get()
  console.log(`[cleanup-legacy-invoices] Years=${years.size}`)
  for (const y of years.docs) {
    const year = y.id
    const projects = await y.ref.collection(PROJECTS_SUBCOLLECTION).get()
    console.log(`[cleanup-legacy-invoices] ${year}: projects=${projects.size}`)
    for (const p of projects.docs) {
      const subs = await p.ref.listCollections()
      for (const sub of subs) {
        const id = sub.id
        if (legacyPattern.test(id) || (INCLUDE_CAPITAL && id === 'Invoice')) {
          const count = await deleteAllDocs(sub)
          if (APPLY) {
            console.log(`[cleanup-legacy-invoices] ${year}/${p.id}/${id}: deleted ${count} docs`)
          } else {
            console.log(`[dry-run] ${year}/${p.id}/${id}: would delete ${count} docs`)
          }
        }
      }
    }
  }
  console.log('[cleanup-legacy-invoices] Completed')
}

run().catch((e) => {
  console.error('[cleanup-legacy-invoices] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})

