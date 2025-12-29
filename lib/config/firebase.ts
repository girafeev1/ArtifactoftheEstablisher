/**
 * Firebase Configuration
 *
 * Client-side and server-side Firebase configuration.
 * Client keys (NEXT_PUBLIC_*) are safe to expose in browser.
 * Admin keys are server-only secrets.
 */

// ============================================================================
// Client-side Firebase Config (safe for browser)
// ============================================================================

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
}

// Firestore database IDs
export const firestoreConfig = {
  defaultDatabaseId: process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID?.trim() || 'mel-sessions',
  projectsDatabaseId: process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID?.trim() ||
    process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID?.trim() || 'epl-projects',
  directoryDatabaseId: process.env.NEXT_PUBLIC_DIRECTORY_FIRESTORE_DATABASE_ID?.trim() ||
    process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID?.trim() || 'erl-directory',
}

// ============================================================================
// Server-side Firebase Admin Config (secrets - never expose to client)
// ============================================================================

/**
 * Strip wrapping quotes from environment variable values
 * Handles cases where the value is wrapped in single or double quotes
 */
function stripQuotes(value: string | undefined): string {
  if (!value) return ''
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if (first === last && (first === '"' || first === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

/**
 * Process private key: strip quotes and replace literal \n with newlines
 */
function processPrivateKey(rawKey: string | undefined): string {
  if (!rawKey) return ''
  return stripQuotes(rawKey).replace(/\\n/g, '\n')
}

export const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || '',
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '',
  privateKey: processPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),

  // Validation helpers
  get isConfigured(): boolean {
    return Boolean(this.projectId && this.clientEmail && this.privateKey)
  },

  get credentialSource(): 'service-account' | 'default' {
    return this.isConfigured ? 'service-account' : 'default'
  },
}

// ============================================================================
// Validation
// ============================================================================

export function validateFirebaseConfig(): {
  client: { valid: boolean; missing: string[] }
  admin: { valid: boolean; missing: string[] }
} {
  const clientMissing: string[] = []
  const adminMissing: string[] = []

  // Check client config
  if (!firebaseConfig.apiKey) clientMissing.push('NEXT_PUBLIC_FIREBASE_API_KEY')
  if (!firebaseConfig.authDomain) clientMissing.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN')
  if (!firebaseConfig.projectId) clientMissing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  if (!firebaseConfig.storageBucket) clientMissing.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')
  if (!firebaseConfig.messagingSenderId) clientMissing.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')
  if (!firebaseConfig.appId) clientMissing.push('NEXT_PUBLIC_FIREBASE_APP_ID')

  // Check admin config (only on server)
  if (typeof window === 'undefined') {
    if (!firebaseAdminConfig.projectId) adminMissing.push('FIREBASE_ADMIN_PROJECT_ID')
    if (!firebaseAdminConfig.clientEmail) adminMissing.push('FIREBASE_ADMIN_CLIENT_EMAIL')
    if (!firebaseAdminConfig.privateKey) adminMissing.push('FIREBASE_ADMIN_PRIVATE_KEY')
  }

  return {
    client: { valid: clientMissing.length === 0, missing: clientMissing },
    admin: { valid: adminMissing.length === 0, missing: adminMissing },
  }
}
