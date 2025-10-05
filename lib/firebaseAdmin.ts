import admin from 'firebase-admin'

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if (first === last && (first === '"' || first === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ? stripWrappingQuotes(process.env.FIREBASE_ADMIN_PRIVATE_KEY).replace(/\\n/g, '\n')
  : undefined

const hasServiceAccountCredentials = Boolean(projectId && clientEmail && privateKey)

export const firebaseAdminConfigStatus = {
  hasProjectId: Boolean(projectId),
  hasClientEmail: Boolean(clientEmail),
  hasPrivateKey: Boolean(privateKey),
  credentialSource: hasServiceAccountCredentials ? 'service-account' : 'default',
} as const

if (!admin.apps.length) {
  if (hasServiceAccountCredentials) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId!,
        clientEmail: clientEmail!,
        privateKey: privateKey!,
      }),
    })
  } else {
    console.warn(
      '[auth] Firebase Admin initialized without FIREBASE_ADMIN service-account credentials. Token verification will fail until they are configured.'
    )
    admin.initializeApp()
  }
}

export const firebaseAdminAuth = admin.auth()
