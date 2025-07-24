// pages/api/show-env.ts
export default function handler(req, res) {
  res.json({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '❌ MISSING',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '❌ MISSING',
  });
}
