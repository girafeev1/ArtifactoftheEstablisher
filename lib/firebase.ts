// lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const required = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
]

export const firebaseVars = required

export const firebaseMissing = required.filter(v => !process.env[v])
export const firebaseReady = firebaseMissing.length === 0

let db: ReturnType<typeof getFirestore> | null = null
let initPromise: Promise<void> | null = null

export async function getDb() {
  if (typeof window === 'undefined') return null

  if (db) return db
  if (initPromise) {
    await initPromise
    return db
  }

  initPromise = (async () => {
    let cfg
    if (firebaseReady) {
      cfg = {
        apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
        authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
        projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
        appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
        databaseId:        process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID,
      }
    } else {
      console.warn('Missing Firebase env vars at build; fetching from /api/show-env')
      const resp = await fetch('/api/show-env').then(r => r.ok ? r.json() : null)
      if (!resp) {
        console.error('Failed to load Firebase config')
        return
      }
      cfg = resp
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔥 Firebase config:', cfg)
    }

    const app = getApps().length === 0 ? initializeApp(cfg) : getApp()
    db = cfg.databaseId ? getFirestore(app, cfg.databaseId) : getFirestore(app)

    // @ts-ignore
    window.db = db
  })()

  await initPromise
  return db
}

if (typeof window !== 'undefined') {
  getDb().catch(() => {})
}
