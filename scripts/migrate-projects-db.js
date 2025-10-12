#!/usr/bin/env node
/**
 * Migrate Firestore documents from one database to another (same project).
 * Default: epl-projects -> tebs-erl
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/migrate-projects-db.js [--dry-run]
 *
 * Env:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 *   SRC_DB_ID (optional, default "epl-projects")
 *   DEST_DB_ID (optional, default "tebs-erl" or NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID)
 */
/* eslint-disable no-console */
const { Firestore } = require('@google-cloud/firestore')

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

const SRC_DB_ID = process.env.SRC_DB_ID || 'epl-projects'
const DEST_DB_ID = process.env.DEST_DB_ID || process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID || 'tebs-erl'
const DRY_RUN = process.argv.includes('--dry-run')

const base = { projectId, credentials: { client_email, private_key } }
const src = new Firestore({ ...base, databaseId: SRC_DB_ID })
const dest = new Firestore({ ...base, databaseId: DEST_DB_ID })

async function migrate() {
  console.log(`[migrate] Source DB: ${SRC_DB_ID} -> Dest DB: ${DEST_DB_ID} (dryRun=${DRY_RUN})`)
  const rootCols = await src.listCollections()
  // Expect year collections as 4-digit ids
  const years = rootCols.map((c) => c.id).filter((id) => /^\d{4}$/.test(id)).sort()
  console.log('[migrate] Years found:', years)

  let projectCount = 0
  let invoiceCount = 0
  for (const year of years) {
    const col = src.collection(year)
    const snapshot = await col.get()
    console.log(`[migrate] Year ${year}: ${snapshot.size} project docs`)
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data()
      projectCount += 1
      if (!DRY_RUN) {
        await dest.collection(year).doc(docSnap.id).set(data, { merge: false })
      }

      // Subcollections (e.g., invoice, invoice-a, invoice-b, Invoice)
      const subcols = await docSnap.ref.listCollections()
      for (const sub of subcols) {
        const subId = sub.id
        // Migrate all subcollections; adjust filters here if you want to limit
        const subSnap = await sub.get()
        if (subSnap.size === 0) continue
        console.log(`[migrate]   ${docSnap.id}/${subId}: ${subSnap.size} docs`)
        for (const inv of subSnap.docs) {
          invoiceCount += 1
          if (!DRY_RUN) {
            await dest.collection(year).doc(docSnap.id).collection(subId).doc(inv.id).set(inv.data(), { merge: false })
          }
        }
      }
    }
  }

  console.log(`[migrate] Completed. Projects: ${projectCount}, Sub-docs: ${invoiceCount}`)
}

migrate().catch((e) => {
  console.error('[migrate] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})

