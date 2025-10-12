#!/usr/bin/env node
/**
 * Migrate bank directory from 'erl-directory' to the per-company DB (e.g., 'tebs-erl').
 * Copies:
 *   - bankAccount/{bankName}/(CODE)/{identifier}  (full, unmasked fields)
 *   - bankAccountLookup/{identifier}              (full fields, no masking)
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/migrate-bank-directory.js [--src erl-directory] [--dest tebs-erl]
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

const SRC = process.argv.includes('--src')
  ? process.argv[process.argv.indexOf('--src') + 1]
  : 'erl-directory'
const DEST = process.argv.includes('--dest')
  ? process.argv[process.argv.indexOf('--dest') + 1]
  : process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID || 'tebs-erl'

const base = { projectId, credentials: { client_email, private_key } }
const src = new Firestore({ ...base, databaseId: SRC })
const dest = new Firestore({ ...base, databaseId: DEST })

async function run() {
  console.log(`[bank-migrate] ${SRC} -> ${DEST}`)
  const bankRoot = src.collection('bankAccount')
  const banksSnap = await bankRoot.get()
  console.log('[bank-migrate] banks:', banksSnap.size)
  let moved = 0
  for (const bankDoc of banksSnap.docs) {
    const bankName = bankDoc.id
    const subcols = await bankDoc.ref.listCollections() // e.g., [ '(035)' ]
    for (const codeCol of subcols) {
      const rawCode = codeCol.id
      const accountsSnap = await codeCol.get()
      if (!accountsSnap.size) continue
      console.log(`[bank-migrate]  ${bankName}/${rawCode}: ${accountsSnap.size}`)
      for (const acc of accountsSnap.docs) {
        const id = acc.id
        const data = acc.data() || {}
        // 1) Write full account under dest bankAccount path
        await dest
          .collection('bankAccount')
          .doc(bankName)
          .collection(rawCode)
          .doc(id)
          .set(data, { merge: false })

        // 2) Upsert full lookup entry (unmasked)
        const lookup = {
          bankName,
          bankCode: String(rawCode).replace(/[^0-9]/g, '').padStart(3, '0'),
          path: `bankAccount/${bankName}/${rawCode}/${id}`,
          ...data,
          updatedAt: new Date().toISOString(),
        }
        await dest.collection('bankAccountLookup').doc(id).set(lookup, { merge: true })
        moved += 1
      }
    }
  }
  console.log('[bank-migrate] Completed. Entries migrated:', moved)
}

run().catch((e) => {
  console.error('[bank-migrate] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})

