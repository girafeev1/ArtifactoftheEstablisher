#!/usr/bin/env node
/**
 * Build/refresh a flat lookup collection for bank accounts:
 *   erl-directory/bankAccountLookup/{identifier}
 *
 * Each lookup doc contains safe-to-display fields and a canonical `path`
 * pointing to the full record under:
 *   bankAccount/{bankName}/({code})/{identifier}
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/build-bank-account-lookup.js
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

function digits(s) {
  return String(s || '').replace(/[^0-9]/g, '')
}

function maskAccountNumber(n) {
  const d = digits(n)
  return d ? `****${d.slice(-4)}` : null
}

const projectId = getRequiredEnv('FIREBASE_ADMIN_PROJECT_ID')
const client_email = getRequiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
const private_key = unescapePrivateKey(getRequiredEnv('FIREBASE_ADMIN_PRIVATE_KEY'))

const base = { projectId, credentials: { client_email, private_key } }
const dir = new Firestore({ ...base, databaseId: 'erl-directory' })

async function build() {
  console.log('[bankLookup] Building bankAccountLookup in erl-directory')
  const bankRoot = dir.collection('bankAccount')
  const banksSnap = await bankRoot.get()
  console.log('[bankLookup] Banks:', banksSnap.size)

  let count = 0
  for (const bankDoc of banksSnap.docs) {
    const bankName = bankDoc.id
    const subcols = await bankDoc.ref.listCollections() // e.g., ["(035)"]
    for (const codeCol of subcols) {
      const rawCode = codeCol.id // "(035)"
      const bankCode = digits(rawCode).padStart(3, '0')
      const accountsSnap = await codeCol.get()
      if (!accountsSnap.size) continue
      console.log(`[bankLookup]  ${bankName}/${rawCode}: ${accountsSnap.size} accounts`)
      for (const acc of accountsSnap.docs) {
        const data = acc.data() || {}
        const id = acc.id // identifier, e.g., "ERL-OCBC-S"
        const path = `bankAccount/${bankName}/${rawCode}/${id}`
        const entry = {
          bankName,
          bankCode,
          path,
          accountType: data.accountType || null,
          accountNumberMasked: maskAccountNumber(
            data.accountNumber || data.accountNo || data.acctNumber || data.number
          ),
          // do not store raw number in public lookup; keep only masked
          accountNumber: maskAccountNumber(
            data.accountNumber || data.accountNo || data.acctNumber || data.number
          ),
          status: typeof data.status === 'boolean' ? data.status : null,
          fpsId: data['FPS ID'] ? 'present' : null,
          fpsEmail: data['FPS Email'] ? 'present' : null,
          updatedAt: new Date().toISOString(),
        }
        await dir.collection('bankAccountLookup').doc(id).set(entry, { merge: true })
        count += 1
      }
    }
  }

  console.log('[bankLookup] Completed. Entries upserted:', count)
}

build().catch((e) => {
  console.error('[bankLookup] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})

