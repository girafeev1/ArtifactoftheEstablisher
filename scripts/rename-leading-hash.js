#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Rename project and invoice documents by removing a leading '#'
 *
 * Scope (nested layout only):
 *   projects/{year}/projects/{projectId}
 *   and invoice subcollections under the project document
 *
 * Behavior:
 *   - If project doc id starts with '#', copy to new id without '#', update projectNumber field, copy subcollections, delete old.
 *   - Within invoice* subcollections (including legacy 'Invoice'/'invoice'), if doc id starts with '#', copy to new id, update invoiceNumber field, delete old.
 *   - Dry-run by default unless --apply is provided.
 *
 * Usage:
 *   set -a; source .env.local; set +a; node scripts/rename-leading-hash.js [--db tebs-erl] [--apply]
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

const base = { projectId, credentials: { client_email, private_key } }
const db = new Firestore({ ...base, databaseId: DB_ID })

const LEGACY_INVOICE_COLLECTION_IDS = new Set(['Invoice', 'invoice'])
const invoiceCollectionPattern = /^invoice-([a-z]+)$/

async function copyDoc(srcRef, destRef, transform) {
  const snap = await srcRef.get()
  if (!snap.exists) return false
  const data = snap.data() || {}
  const payload = typeof transform === 'function' ? transform(data) : data
  if (APPLY) await destRef.set(payload, { merge: false })
  return true
}

async function copySubcollections(srcRef, destRef) {
  const subs = await srcRef.listCollections()
  for (const sub of subs) {
    const subId = sub.id
    const isInvoiceColl = invoiceCollectionPattern.test(subId) || LEGACY_INVOICE_COLLECTION_IDS.has(subId)
    const docs = await sub.get()
    for (const d of docs.docs) {
      const oldId = d.id
      const needsRename = oldId.startsWith('#')
      const newId = needsRename ? oldId.replace(/^#/, '') : oldId
      const dest = destRef.collection(subId).doc(newId)
      await copyDoc(d.ref, dest, (data) => {
        const next = { ...data }
        if (isInvoiceColl) {
          // Harmonize invoiceNumber field if present
          if (typeof next.invoiceNumber === 'string') {
            next.invoiceNumber = next.invoiceNumber.replace(/^#/, '')
          }
          if (typeof next.baseInvoiceNumber === 'string') {
            next.baseInvoiceNumber = next.baseInvoiceNumber.replace(/^#/, '')
          }
        }
        return next
      })
      if (needsRename) {
        if (APPLY) {
          await d.ref.delete().catch(() => {})
          console.log(`  invoice: ${subId}/${oldId} -> ${newId}`)
        } else {
          console.log(`  [dry-run] invoice: ${subId}/${oldId} -> ${newId}`)
        }
      }
    }
  }
}

async function renameProjects() {
  console.log(`[rename] Database: ${DB_ID} (apply=${APPLY})`)
  const root = db.collection('projects')
  const yearsSnap = await root.get()
  console.log(`[rename] Years: ${yearsSnap.size}`)
  for (const y of yearsSnap.docs) {
    const year = y.id
    const projectsSnap = await y.ref.collection('projects').get()
    console.log(`[rename] ${year}: ${projectsSnap.size} projects`)
    for (const p of projectsSnap.docs) {
      const oldId = p.id
      if (!oldId.startsWith('#')) continue
      const newId = oldId.replace(/^#/, '')
      const destRef = y.ref.collection('projects').doc(newId)
      const exists = await destRef.get()
      if (exists.exists) {
        console.warn(`[skip] ${year}/${oldId} -> ${newId} exists`)
        continue
      }
      const wrote = await copyDoc(p.ref, destRef, (data) => {
        const next = { ...data }
        if (typeof next.projectNumber === 'string') {
          next.projectNumber = next.projectNumber.replace(/^#/, '')
        }
        return next
      })
      if (!wrote) continue
      await copySubcollections(p.ref, destRef)
      if (APPLY) {
        await p.ref.delete().catch(() => {})
        console.log(`[rename] ${year}/${oldId} -> ${newId}`)
      } else {
        console.log(`[dry-run] ${year}/${oldId} -> ${newId}`)
      }
    }
  }
  console.log('[rename] Completed')
}

renameProjects().catch((e) => {
  console.error('[rename] Failed:', e && e.message ? e.message : e)
  process.exit(1)
})
