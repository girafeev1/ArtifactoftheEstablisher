#!/usr/bin/env node
/*
  Removes cache-like fields updatedAt/updatedBy from:
    - projects root docs (nested and legacy)
    - invoice docs under each project (nested and legacy)
    - clients docs in client directory

  Usage:
    FIREBASE_ADMIN_PROJECT_ID=your-project \
    FIREBASE_ADMIN_CLIENT_EMAIL=... \
    FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
    DATABASE_IDS="(default),epl-directory" \
    node scripts/strip-cache-fields.js

  Set DRY_RUN=1 to preview.
*/
const admin = require('firebase-admin')

function init() {
  const explicitProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const fallbackProjectId = process.env.GOOGLE_CLOUD_PROJECT
  const projectId = explicitProjectId || fallbackProjectId
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  if (!admin.apps.length) {
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        projectId,
      })
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      })
    }
  }
}

async function listRootCollections(firestore) {
  return firestore.listCollections()
}

async function run() {
  init()
  const databaseIds = (process.env.DATABASE_IDS || '(default)')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const dryRun = process.env.DRY_RUN === '1'
  const FieldValue = admin.firestore.FieldValue
  let total = 0

  for (const dbId of databaseIds) {
    const fs = admin.firestore()
    // @ts-ignore
    fs._settings = { ...fs._settings, databaseId: dbId }
    console.log(`[strip] Database: ${dbId}`)
    const roots = await listRootCollections(fs)
    const rootNames = roots.map((c) => c.id)

    // projects nested path
    if (rootNames.includes('projects')) {
      const years = await fs.collection('projects').listDocuments()
      for (const yearRef of years) {
        const projectsCol = yearRef.collection('projects')
        const docs = await projectsCol.listDocuments()
        for (const projRef of docs) {
          if (!dryRun) await projRef.update({ updatedAt: FieldValue.delete(), updatedBy: FieldValue.delete() }).catch(() => {})
          total += 1
          // invoices under nested
          const invCol = projRef.collection('invoice')
          const invDocs = await invCol.listDocuments().catch(() => [])
          for (const invRef of invDocs) {
            if (!dryRun) await invRef.update({ updatedAt: FieldValue.delete(), updatedBy: FieldValue.delete() }).catch(() => {})
            total += 1
          }
        }
      }
    }

    // legacy years root ids
    for (const root of roots) {
      if (!/^\d{4}$/.test(root.id)) continue
      const yearCol = fs.collection(root.id)
      const projDocs = await yearCol.listDocuments()
      for (const projRef of projDocs) {
        if (!dryRun) await projRef.update({ updatedAt: FieldValue.delete(), updatedBy: FieldValue.delete() }).catch(() => {})
        total += 1
        const invCol = projRef.collection('invoice')
        const invDocs = await invCol.listDocuments().catch(() => [])
        for (const invRef of invDocs) {
          if (!dryRun) await invRef.update({ updatedAt: FieldValue.delete(), updatedBy: FieldValue.delete() }).catch(() => {})
          total += 1
        }
      }
    }

    // clients directory
    if (rootNames.includes('clients')) {
      const clientDocs = await fs.collection('clients').listDocuments()
      for (const cRef of clientDocs) {
        if (!dryRun) await cRef.update({ updatedAt: FieldValue.delete(), updatedBy: FieldValue.delete() }).catch(() => {})
        total += 1
      }
    }
  }
  console.log(`[strip] ${dryRun ? 'Would update' : 'Updated'} ${total} documents to remove updatedAt/updatedBy`)
}

run().catch((e) => {
  console.error('[strip] Failed:', e)
  process.exit(1)
})
