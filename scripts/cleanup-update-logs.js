#!/usr/bin/env node
/*
  Deletes updateLogs documents where field === 'updatedAt' across:
    - projects/{year}/projects/{projectId}/updateLogs
    - {year}/{projectId}/updateLogs (legacy)
    - projects/{year}/projects/{projectId}/invoice/{invoiceNumber}/updateLogs
    - {year}/{projectId}/invoice/{invoiceNumber}/updateLogs (legacy)
    - clients (client directory)/updateLogs in optional databaseIds

  Usage:
    FIREBASE_ADMIN_PROJECT_ID=your-project \
    FIREBASE_ADMIN_CLIENT_EMAIL=... \
    FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
    DATABASE_IDS="(default),epl-directory" \
    node scripts/cleanup-update-logs.js

  Notes:
    - DATABASE_IDS is optional. Defaults to "(default)" only.
    - Set DRY_RUN=1 to preview deletions.
*/
const admin = require('firebase-admin')
const { Firestore } = require('@google-cloud/firestore')

function getFirestores() {
  const explicitProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const fallbackProjectId = process.env.GOOGLE_CLOUD_PROJECT
  const projectId = explicitProjectId || fallbackProjectId
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  const databaseIds = (process.env.DATABASE_IDS || '(default)')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (!admin.apps.length) {
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      })
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      })
    }
  }

  const resolvedProjectId = projectId || admin.app().options.projectId

  return databaseIds.map((dbId) => {
    const opts = resolvedProjectId ? { projectId: resolvedProjectId, databaseId: dbId } : { databaseId: dbId }
    const fs = new Firestore(opts)
    return { id: dbId, db: fs }
  })
}

async function deleteMatching(query, dryRun) {
  const snap = await query.get()
  let count = 0
  for (const doc of snap.docs) {
    count++
    if (!dryRun) await doc.ref.delete().catch(() => {})
  }
  return count
}

async function run() {
  const dryRun = process.env.DRY_RUN === '1'
  const stores = getFirestores()
  let total = 0
  for (const { id, db } of stores) {
    console.log(`[cleanup] Scanning database: ${id}`)
    const roots = await db.listCollections()
    const rootNames = roots.map((c) => c.id)

    // Nested projects path
    if (rootNames.includes('projects')) {
      const years = await db.collection('projects').listDocuments()
      for (const yearRef of years) {
        const projectsCol = yearRef.collection('projects')
        const projDocs = await projectsCol.listDocuments()
        for (const projRef of projDocs) {
          const ul = projRef.collection('updateLogs').where('field', '==', 'updatedAt')
          total += await deleteMatching(ul, dryRun)
          // Invoices under nested path
          const invoiceDocs = await projRef.collection('invoice').listDocuments().catch(() => [])
          for (const invRef of invoiceDocs) {
            const iul = invRef.collection('updateLogs').where('field', '==', 'updatedAt')
            total += await deleteMatching(iul, dryRun)
          }
        }
      }
    }

    // Legacy years as root collections (4-digit)
    for (const root of roots) {
      if (/^\d{4}$/.test(root.id)) {
        const yearCol = db.collection(root.id)
        const projDocs = await yearCol.listDocuments()
        for (const projRef of projDocs) {
          const ul = projRef.collection('updateLogs').where('field', '==', 'updatedAt')
          total += await deleteMatching(ul, dryRun)
          const invoiceDocs = await projRef.collection('invoice').listDocuments().catch(() => [])
          for (const invRef of invoiceDocs) {
            const iul = invRef.collection('updateLogs').where('field', '==', 'updatedAt')
            total += await deleteMatching(iul, dryRun)
          }
        }
      }
    }

    // Client directory cleanup (if this database hosts clients collection)
    if (rootNames.includes('clients')) {
      const clientDocs = await db.collection('clients').listDocuments()
      for (const cRef of clientDocs) {
        const cul = cRef.collection('updateLogs').where('field', '==', 'updatedAt')
        total += await deleteMatching(cul, dryRun)
      }
    }
  }
  console.log(`[cleanup] ${dryRun ? 'Would delete' : 'Deleted'} ${total} updateLogs entries with field=updatedAt`)
}

run().catch((e) => {
  console.error('[cleanup] Failed:', e)
  process.exit(1)
})
