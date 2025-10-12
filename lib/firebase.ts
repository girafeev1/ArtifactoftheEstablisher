// lib/firebase.ts

import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseEnvConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const DEFAULT_DATABASE_ID = 'mel-sessions'
// Allow overriding the projects database via environment for easy migration/switching
const PROJECTS_DATABASE_ID =
  process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID?.trim() || 'tebs-erl'
// Allow overriding the directory (bank accounts) database; default to production 'tebs-erl'
const DIRECTORY_DATABASE_ID =
  process.env.NEXT_PUBLIC_DIRECTORY_FIRESTORE_DATABASE_ID?.trim() || 'tebs-erl'

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
  NEXT_PUBLIC_FIREBASE_API_KEY: maskEnvValue(firebaseEnvConfig.apiKey),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: maskEnvValue(firebaseEnvConfig.authDomain),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: maskEnvValue(firebaseEnvConfig.projectId),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: maskEnvValue(firebaseEnvConfig.storageBucket),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: maskEnvValue(firebaseEnvConfig.messagingSenderId),
  NEXT_PUBLIC_FIREBASE_APP_ID: maskEnvValue(firebaseEnvConfig.appId),
})

export const getFirebaseDiagnosticsSnapshot = () => ({
  env: buildFirebaseEnvSnapshot(),
  hasInitializedApp: getApps().length > 0,
  databaseIds: {
    default: DEFAULT_DATABASE_ID,
    projects: PROJECTS_DATABASE_ID,
    directory: DIRECTORY_DATABASE_ID,
  },
})

const resolveFirebaseConfig = (): FirebaseOptions => {
  const missingKeys = Object.entries(firebaseEnvConfig)
    .filter(([, value]) => {
      if (typeof value !== 'string') {
        return true
      }
      return value.trim().length === 0
    })
    .map(([key]) => key)

  if (missingKeys.length > 0) {
    const diagnostics = getFirebaseDiagnosticsSnapshot()
    console.error('[firebase] Missing Firebase configuration', {
      missingKeys,
      diagnostics,
    })
    throw new Error(`Missing Firebase configuration: ${missingKeys.join(', ')}`)
  }

  return {
    apiKey: firebaseEnvConfig.apiKey as string,
    authDomain: firebaseEnvConfig.authDomain as string,
    projectId: firebaseEnvConfig.projectId as string,
    storageBucket: firebaseEnvConfig.storageBucket as string,
    messagingSenderId: firebaseEnvConfig.messagingSenderId as string,
    appId: firebaseEnvConfig.appId as string,
  }
}

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

const createFirebaseApp = () => {
  try {
    const config = resolveFirebaseConfig()

    if (!getApps().length) {
      console.info('[firebase] Initializing Firebase app', {
        projectId: config.projectId,
      })
      return initializeApp(config)
    }

    return getApp()
  } catch (error) {
    console.error('[firebase] Failed to initialize Firebase app', {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { message: 'Unknown error', raw: error },
      diagnostics: getFirebaseDiagnosticsSnapshot(),
    })
    throw error
  }
}

export const app = createFirebaseApp()
export const db = getFirestore(app, DEFAULT_DATABASE_ID)
export const projectsDb = getFirestore(app, PROJECTS_DATABASE_ID)
export const PROJECTS_FIRESTORE_DATABASE_ID = PROJECTS_DATABASE_ID
export const DIRECTORY_FIRESTORE_DATABASE_ID = DIRECTORY_DATABASE_ID
export const getFirestoreForDatabase = (databaseId: string) => getFirestore(app, databaseId)
// after you create/export `db`...
if (typeof window !== 'undefined') {
  // @ts-expect-error attach for debugging
  window.db = db
}
