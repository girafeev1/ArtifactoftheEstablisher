#!/usr/bin/env node
/*
  Removes addressLine4 and addressLine5 from every client in the 'epl-directory' database.

  Usage:
    FIREBASE_ADMIN_PROJECT_ID=your-project \
    FIREBASE_ADMIN_CLIENT_EMAIL=... \
    FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
    DRY_RUN=1 \
    node scripts/cleanup-clients-remove-address4-5.js

  Omit DRY_RUN=1 to apply changes.
*/
const admin = require('firebase-admin')

function init() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  if (!admin.apps.length) {
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }), projectId })
    } else {
      admin.initializeApp({ credential: admin.credential.applicationDefault() })
    }
  }
}

async function run() {
  init()
  const db = admin.firestore()
  // target the directory database
  // @ts-ignore: set databaseId
  db._settings = { ...db._settings, databaseId: 'epl-directory' }
  const FieldValue = admin.firestore.FieldValue
  const dryRun = process.env.DRY_RUN === '1'
  let scanned = 0
  let modified = 0

  console.log('[clients-cleanup] Scanning clients in epl-directory ...')
  const snap = await db.collection('clients').get()
  for (const doc of snap.docs) {
    scanned++
    const data = doc.data() || {}
    const has4 = Object.prototype.hasOwnProperty.call(data, 'addressLine4')
    const has5 = Object.prototype.hasOwnProperty.call(data, 'addressLine5')
    if (has4 || has5) {
      console.log(`[clients-cleanup] ${doc.id}: removing ${has4 ? 'addressLine4 ' : ''}${has5 ? 'addressLine5' : ''}`)
      if (!dryRun) {
        const update = {}
        if (has4) update.addressLine4 = FieldValue.delete()
        if (has5) update.addressLine5 = FieldValue.delete()
        await doc.ref.update(update).catch((e) => console.warn(`[clients-cleanup] update failed for ${doc.id}`, e.message))
      }
      modified++
    }
  }
  console.log(`[clients-cleanup] scanned=${scanned} modified=${modified} dryRun=${dryRun}`)
}

run().catch((e) => {
  console.error('[clients-cleanup] failed', e)
  process.exit(1)
})

