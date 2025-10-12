#!/usr/bin/env node
/**
 * Restructure projects inside the same database into nested layout:
 *   from: /{year}/{projectId}
 *   to:   /projects/{year}/projects/{projectId}
 *
 * Copies subcollections (e.g., invoice*, updateLogs) as-is.
 * Does not delete legacy docs.
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/restructure-projects-nest.js [--dry-run] [--db tebs-erl]
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
const DB_ID =
  process.argv.includes('--db')
    ? process.argv[process.argv.indexOf('--db') + 1]
    : process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID || 'tebs-erl'
const DRY = process.argv.includes('--dry-run')

const base = { projectId, credentials: { client_email, private_key } }
const db = new Firestore({ ...base, databaseId: DB_ID })

async function run() {
  console.log(`[restructure] Database: ${DB_ID} (dryRun=${DRY})`)
  const root = await db.listCollections()
  const years = root.map((c) => c.id).filter((id) => /^\d{4}$/.test(id)).sort()
  console.log('[restructure] Years at root:', years)

  let moved = 0
  for (const year of years) {
    // Ensure parent year document exists
    const yearDocRef = db.collection('projects').doc(year)
    if (!DRY) {
      await yearDocRef.set(
        { id: year, createdAt: new Date().toISOString() },
        { merge: true }
      )
    }
    const yearCol = db.collection(year)
    const projectsSnap = await yearCol.get()
    if (projectsSnap.size === 0) continue
    console.log(`[restructure] Year ${year}: ${projectsSnap.size} docs`)
    for (const docSnap of projectsSnap.docs) {
      const data = docSnap.data()
      const destRef = db.collection('projects').doc(year).collection('projects').doc(docSnap.id)
      if (!DRY) {
        await destRef.set(data, { merge: false })
      }
      moved++
      const subs = await docSnap.ref.listCollections()
      for (const sub of subs) {
        const subSnap = await sub.get()
        if (subSnap.size === 0) continue
        console.log(`  sub ${docSnap.id}/${sub.id}: ${subSnap.size}`)
        for (const sdoc of subSnap.docs) {
          if (!DRY) {
            await destRef.collection(sub.id).doc(sdoc.id).set(sdoc.data(), { merge: false })
          }
        }
      }
    }
  }
  console.log('[restructure] Completed. Docs copied:', moved)
}

run().catch((e) => {
  console.error('[restructure] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})
