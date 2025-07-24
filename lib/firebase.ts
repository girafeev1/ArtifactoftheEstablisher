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

export function getDb() {
  if (typeof window === 'undefined') return null

  if (!db) {
    if (!firebaseReady) {
      console.error('Missing Firebase env vars:', firebaseMissing.join(', '))
      return null
    }

    const firebaseConfig = {
      apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔥 Firebase config:', firebaseConfig, 'DB:', process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '(default)')
    }

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID
    db = databaseId ? getFirestore(app, databaseId) : getFirestore(app)

    // @ts-ignore
    window.db = db
  }

  return db
}

if (typeof window !== 'undefined') {
  getDb()
}

export { getDb }
