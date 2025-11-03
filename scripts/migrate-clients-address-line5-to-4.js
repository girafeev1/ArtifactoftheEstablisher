#!/usr/bin/env node
/*
  Migrates clients in 'epl-directory' database:
   - If addressLine5 has a value, move it to addressLine4 when addressLine4 is empty
   - Delete addressLine5 field

  Usage:
    FIREBASE_ADMIN_PROJECT_ID=your-project \
    FIREBASE_ADMIN_CLIENT_EMAIL=... \
    FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
    DRY_RUN=1 \
    node scripts/migrate-clients-address-line5-to-4.js

  Omit DRY_RUN=1 to perform changes.
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
  // @ts-ignore set database id to epl-directory
  db._settings = { ...db._settings, databaseId: 'epl-directory' }
  const FieldValue = admin.firestore.FieldValue
  const dryRun = process.env.DRY_RUN === '1'
  let scanned = 0
  let updated = 0

  const snap = await db.collection('clients').get()
  for (const doc of snap.docs) {
    scanned++
    const data = doc.data() || {}
    const l4 = data.addressLine4
    const l5 = data.addressLine5
    if (l5 && (!l4 || String(l4).trim().length === 0)) {
      console.log(`[migrate] ${doc.id}: moving addressLine5 -> addressLine4 (${l5}) and deleting addressLine5`)
      if (!dryRun) {
        await doc.ref.update({ addressLine4: l5, addressLine5: FieldValue.delete() }).catch(() => {})
      }
      updated++
    } else if (l5) {
      console.log(`[migrate] ${doc.id}: deleting addressLine5 (already has addressLine4)`) 
      if (!dryRun) {
        await doc.ref.update({ addressLine5: FieldValue.delete() }).catch(() => {})
      }
      updated++
    }
  }
  console.log(`[migrate] scanned=${scanned} updated=${updated} dryRun=${dryRun}`)
}

run().catch((e) => {
  console.error('[migrate] failed', e)
  process.exit(1)
})

