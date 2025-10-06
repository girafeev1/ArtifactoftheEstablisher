// lib/firebase.ts

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:               process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:           process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId:    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:                process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const DEFAULT_DATABASE_ID = 'mel-sessions'
const PROJECTS_DATABASE_ID = 'epl-projects'

type FirebaseEnvSnapshot = {
  NEXT_PUBLIC_FIREBASE_API_KEY: string | null
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string | null
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string | null
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string | null
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string | null
  NEXT_PUBLIC_FIREBASE_APP_ID: string | null
}

const maskEnvValue = (value: string | undefined): string | null => {
  if (!value) return null
  if (value.length <= 8) {
    const first = value[0] ?? ''
    const last = value[value.length - 1] ?? ''
    return `${first}***${last}`
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

const buildFirebaseEnvSnapshot = (): FirebaseEnvSnapshot => ({
  NEXT_PUBLIC_FIREBASE_API_KEY: maskEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: maskEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: maskEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: maskEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: maskEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  NEXT_PUBLIC_FIREBASE_APP_ID: maskEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
})

export const getFirebaseDiagnosticsSnapshot = () => ({
  env: buildFirebaseEnvSnapshot(),
  hasInitializedApp: getApps().length > 0,
  databaseIds: {
    default: DEFAULT_DATABASE_ID,
    projects: PROJECTS_DATABASE_ID,
  },
})

declare global {
  // eslint-disable-next-line no-var
  var __AOTE_LOGGED_FIREBASE_SNAPSHOT__: boolean | undefined
}

if (typeof window === 'undefined' && !globalThis.__AOTE_LOGGED_FIREBASE_SNAPSHOT__) {
  globalThis.__AOTE_LOGGED_FIREBASE_SNAPSHOT__ = true
  const snapshot = getFirebaseDiagnosticsSnapshot()
  console.info('[firebase] Configuration snapshot', snapshot)
  const missingKeys = Object.entries(snapshot.env)
    .filter(([, value]) => value === null)
    .map(([key]) => key)

  if (missingKeys.length > 0) {
    console.error('[firebase] Missing required environment variables', missingKeys)
  }
}

export const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp()
export const db = getFirestore(app, DEFAULT_DATABASE_ID)
export const projectsDb = getFirestore(app, PROJECTS_DATABASE_ID)
export const PROJECTS_FIRESTORE_DATABASE_ID = PROJECTS_DATABASE_ID
export const getFirestoreForDatabase = (databaseId: string) => getFirestore(app, databaseId)
// after you create/export `db`...
if (typeof window !== 'undefined') {
  // @ts-expect-error attach for debugging
  window.db = db
}
