// lib/firebase.ts

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const requiredEnv = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
]

const missing = requiredEnv.filter((key) => !process.env[key])
if (missing.length) {
  throw new Error(
    `Missing Firebase environment variables: ${missing.join(', ')}`,
  )
}

const firebaseConfig = {
  apiKey:               process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:           process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId:    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:                process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
}

if (process.env.NODE_ENV === 'development') {
  console.log('🔥 Firebase config:', firebaseConfig)
}

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp()

export const db = getFirestore(app)
// after you create/export `db`...
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.db = db
}
