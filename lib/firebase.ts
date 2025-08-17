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

console.log('🔥 Firebase config:', firebaseConfig)
Object.entries(firebaseConfig).forEach(([k, v]) => {
  console.log(`   ${k}: ${v}`)
})

const databaseId = 'mel-sessions'
console.log('📚 Firestore database ID:', databaseId)

export const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp()
export const db = getFirestore(app, databaseId)
// after you create/export `db`...
if (typeof window !== 'undefined') {
  // @ts-expect-error attach for debugging
  window.db = db
}
