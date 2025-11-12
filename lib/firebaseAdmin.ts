// lib/firebaseAdmin.ts
import type { ServiceAccount } from 'firebase-admin'
import admin from 'firebase-admin'
// Prefer direct Firestore client to reliably target non-default databases
// without relying on private _settings mutation.
import { Firestore } from '@google-cloud/firestore'

// Normalize FIREBASE_ADMIN_PRIVATE_KEY which may be quoted and contain literal \n
const stripWrappingQuotes = (value: string): string => {
  if (!value) return value
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if (first === last && (first === '"' || first === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

const envProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID
const envClientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const envPrivateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY
const envPrivateKey = envPrivateKeyRaw
  ? stripWrappingQuotes(envPrivateKeyRaw).replace(/\\n/g, '\n')
  : undefined

export const firebaseAdminConfigStatus = {
  hasProjectId: Boolean(envProjectId),
  hasClientEmail: Boolean(envClientEmail),
  hasPrivateKey: Boolean(envPrivateKey),
  credentialSource: envProjectId && envClientEmail && envPrivateKey ? 'service-account' as const : 'default' as const,
}

let appInitialized = false

export const ensureAdminApp = () => {
  if (appInitialized) return admin.app()
  try {
    if (!admin.apps.length) {
      const projectId = envProjectId
      const clientEmail = envClientEmail
      const privateKey = envPrivateKey
      if (projectId && clientEmail && privateKey) {
        const creds: ServiceAccount = {
          projectId,
          clientEmail,
          privateKey,
        }
        admin.initializeApp({ credential: admin.credential.cert(creds), projectId })
      } else {
        admin.initializeApp({ credential: admin.credential.applicationDefault() })
      }
    }
    appInitialized = true
    return admin.app()
  } catch (e) {
    throw e
  }
}

export const getAdminFirestore = (databaseId?: string) => {
  // Use explicit Firestore client with databaseId support
  const projectId = envProjectId
  const clientEmail = envClientEmail
  const privateKey = envPrivateKey

  if (projectId && clientEmail && privateKey) {
    return new Firestore({
      projectId,
      credentials: { client_email: clientEmail, private_key: privateKey },
      databaseId: databaseId && databaseId.length > 0 ? databaseId : '(default)',
    })
  }

  // Fallback to admin app default (may only hit default database)
  const app = ensureAdminApp()
  // @ts-ignore Firestore from admin fallback (no custom databaseId)
  return admin.firestore(app)
}

export const firebaseAdminAuth = admin.auth(ensureAdminApp())
