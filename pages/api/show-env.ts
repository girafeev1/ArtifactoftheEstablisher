// pages/api/show-env.ts
export default function handler(req, res) {
  res.json({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? null,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? null,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? null,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? null,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? null,
    databaseId: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID ?? null,
  })
}
