#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Remove payment/client fields from all project documents.
 *
 * Affected fields on project docs:
 *   - invoice
 *   - onDate
 *   - paid
 *   - paidTo
 *   - clientCompany
 *
 * Scope: projects/{year}/projects/{projectId} (preferred) and legacy {year}/{projectId}
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/remove-project-payment-fields.js [--db tebs-erl] [--apply]
 */

const { Firestore, FieldValue } = require('@google-cloud/firestore')

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

const base = { projectId, credentials: { client_email, private_key } }
const db = new Firestore({ ...base, databaseId: DB_ID })

const PROJECTS_ROOT = 'projects'
const PROJECTS_SUBCOLLECTION = 'projects'

const fieldsToDelete = ['invoice', 'onDate', 'paid', 'paidTo', 'clientCompany']

async function removeFieldsFromDoc(ref) {
  const payload = {}
  fieldsToDelete.forEach((f) => (payload[f] = FieldValue.delete()))
  if (APPLY) {
    await ref.update(payload).catch(async (e) => {
      if (String(e.message || '').includes('No document to update')) {
        return
      }
      throw e
    })
  }
}

async function run() {
  console.log(`[cleanup] Database: ${DB_ID} (apply=${APPLY})`)
  const root = db.collection(PROJECTS_ROOT)
  const yearsSnap = await root.get()
  console.log(`[cleanup] Years found: ${yearsSnap.size}`)

  for (const y of yearsSnap.docs) {
    const year = y.id
    const projectsSnap = await y.ref.collection(PROJECTS_SUBCOLLECTION).get()
    console.log(`[cleanup] ${year}: ${projectsSnap.size} projects`)
    for (const p of projectsSnap.docs) {
      if (APPLY) {
        await removeFieldsFromDoc(p.ref)
        console.log(`[cleanup] ${year}/${p.id}: removed ${fieldsToDelete.join(', ')}`)
      } else {
        console.log(`[dry-run] ${year}/${p.id}: would remove ${fieldsToDelete.join(', ')}`)
      }
    }
  }

  // Legacy fallback: root-level year collections
  const legacyYears = await db.listCollections()
  for (const coll of legacyYears) {
    const id = coll.id
    if (!/^\d{4}$/.test(id)) continue
    const docs = await coll.get()
    if (docs.empty) continue
    console.log(`[cleanup-legacy] ${id}: ${docs.size} projects`)
    for (const d of docs.docs) {
      if (APPLY) {
        await removeFieldsFromDoc(d.ref)
        console.log(`[cleanup-legacy] ${id}/${d.id}: removed ${fieldsToDelete.join(', ')}`)
      } else {
        console.log(`[dry-run] ${id}/${d.id}: would remove ${fieldsToDelete.join(', ')}`)
      }
    }
  }

  console.log('[cleanup] Completed')
}

run().catch((e) => {
  console.error('[cleanup] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})

