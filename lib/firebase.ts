// lib/firebase.ts

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:               process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:           process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId:    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:                process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
}

const envVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIRESTORE_DB_ID'
]
envVars.forEach(v => {
  const val = process.env[v]
  if (!val) {
    console.warn(`❌ ${v} is undefined`)
  } else {
    console.log(`✅ ${v}=${val}`)
  }
})

console.log('🔥 Firebase config:', firebaseConfig)
const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DB_ID || 'mel-sessions'
console.log('📚 Firestore database ID:', databaseId)

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp()
export const db = getFirestore(app, databaseId)
// after you create/export `db`...
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.db = db
}
