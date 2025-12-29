/**
 * Application Configuration
 *
 * App-specific settings, NextAuth configuration, and environment info.
 */

// ============================================================================
// NextAuth Configuration
// ============================================================================

export const nextAuthConfig = {
  url: process.env.NEXTAUTH_URL || (
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
  ),
  secret: process.env.NEXTAUTH_SECRET || (
    process.env.NODE_ENV === 'development' ? 'dev-secret' : ''
  ),

  get isConfigured(): boolean {
    return Boolean(this.url && this.secret)
  },
}

// ============================================================================
// Application Settings
// ============================================================================

export const appConfig = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Development-only settings
  devAuthBypass: process.env.DEV_AUTH_BYPASS === '1',

  // App-specific IDs
  pmsReferenceLogId: process.env.PMS_REFERENCE_LOG_ID || '',

  // Firestore database IDs
  defaultFirestoreDb: process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'tebs-erl',
  projectsFirestoreDb: process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID ||
    process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'tebs-erl',

  // NextAuth
  nextAuth: nextAuthConfig,
}

// ============================================================================
// Vercel/Deployment Configuration
// ============================================================================

export const deploymentConfig = {
  vercelOrgId: process.env.VERCEL_ORG_ID || '',
  vercelProjectId: process.env.VERCEL_PROJECT_ID || '',
  vercelToken: process.env.VERCEL_TOKEN || '',

  // Vercel provides these automatically
  vercelUrl: process.env.VERCEL_URL || '',
  vercelEnv: process.env.VERCEL_ENV || '',

  get isVercel(): boolean {
    return Boolean(process.env.VERCEL)
  },
}

// ============================================================================
// All Environment Variables Reference
// ============================================================================

/**
 * Complete list of all environment variables used by the application.
 * Use this for documentation and validation.
 */
export const ENV_VARS = {
  // Client-side (safe to expose)
  client: [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    'NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID',
    'NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID',
    'NEXT_PUBLIC_DIRECTORY_FIRESTORE_DATABASE_ID',
  ],

  // Server-side (secrets)
  server: {
    firebase: [
      'FIREBASE_ADMIN_PROJECT_ID',
      'FIREBASE_ADMIN_CLIENT_EMAIL',
      'FIREBASE_ADMIN_PRIVATE_KEY',
    ],
    nextAuth: [
      'NEXTAUTH_URL',
      'NEXTAUTH_SECRET',
    ],
    google: [
      'GOOGLE_PROJECT_ID',
      'GOOGLE_CLIENT_EMAIL',
      'GOOGLE_PRIVATE_KEY',
    ],
    ocbc: [
      'OCBC_API_BASE_URL',
      'OCBC_CLIENT_ID',
      'OCBC_CLIENT_SECRET',
    ],
    airwallex: [
      'AIRWALLEX_API_BASE_URL',
      'AIRWALLEX_CLIENT_ID',
      'AIRWALLEX_API_KEY',
      'AIRWALLEX_ACCOUNT_ID',
    ],
    telegram: [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_WEBHOOK_SECRET',
    ],
    gcpBilling: [
      'GCP_BILLING_PROJECT_ID',
      'GCP_BILLING_DATASET_ID',
      'GCP_BILLING_TABLE_ID',
      'GCP_BILLING_CLIENT_EMAIL',
      'GCP_BILLING_PRIVATE_KEY',
    ],
    misc: [
      'PMS_REFERENCE_LOG_ID',
      'CALENDAR_SCAN_URL',
      'SCAN_SECRET',
      'DEV_AUTH_BYPASS',
    ],
  },

  // CI/CD only
  deployment: [
    'VERCEL_ORG_ID',
    'VERCEL_PROJECT_ID',
    'VERCEL_TOKEN',
  ],
} as const
