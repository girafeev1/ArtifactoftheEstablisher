// lib/firebaseAdmin.ts
import type { ServiceAccount } from 'firebase-admin'
import admin from 'firebase-admin'

let appInitialized = false

export const ensureAdminApp = () => {
  if (appInitialized) return admin.app()
  try {
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
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
  const app = ensureAdminApp()
  const fs = admin.firestore(app)
  if (databaseId && databaseId !== '(default)') {
    // @ts-ignore access internal settings to set databaseId
    fs._settings = { ...fs._settings, databaseId }
  }
  return fs
}

