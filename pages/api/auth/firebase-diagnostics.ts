import type { NextApiRequest, NextApiResponse } from 'next'

import {
  firebaseAdminAuth,
  firebaseAdminConfigStatus,
} from '../../../lib/firebaseAdmin'

type DiagnosticsSuccessResponse = {
  ok: true
  uid: string
  projectId: string | null
}

type DiagnosticsFailureResponse = {
  ok: false
  message: string
  code?: string
  config: typeof firebaseAdminConfigStatus
}

type DiagnosticsResponse = DiagnosticsSuccessResponse | DiagnosticsFailureResponse

function buildMissingEnvMessage(): string | null {
  const missing: string[] = []
  if (!firebaseAdminConfigStatus.hasProjectId) {
    missing.push('FIREBASE_ADMIN_PROJECT_ID')
  }
  if (!firebaseAdminConfigStatus.hasClientEmail) {
    missing.push('FIREBASE_ADMIN_CLIENT_EMAIL')
  }
  if (!firebaseAdminConfigStatus.hasPrivateKey) {
    missing.push('FIREBASE_ADMIN_PRIVATE_KEY')
  }

  if (!missing.length) {
    return null
  }

  return `Missing environment variables: ${missing.join(', ')}`
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DiagnosticsResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).json({
      ok: false,
      message: 'Method Not Allowed',
      config: firebaseAdminConfigStatus,
    })
    return
  }

  const idToken = typeof req.body === 'object' ? (req.body as any)?.idToken : undefined

  if (typeof idToken !== 'string' || !idToken.trim()) {
    res.status(400).json({
      ok: false,
      message: 'Missing Firebase ID token',
      config: firebaseAdminConfigStatus,
    })
    return
  }

  if (firebaseAdminConfigStatus.credentialSource !== 'service-account') {
    const missingMessage = buildMissingEnvMessage()
    res.status(200).json({
      ok: false,
      message:
        missingMessage ??
        'Firebase Admin was initialized without service-account credentials. Token verification cannot proceed.',
      config: firebaseAdminConfigStatus,
    })
    return
  }

  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(idToken)
    res.status(200).json({
      ok: true,
      uid: decoded.uid,
      projectId: (decoded as any)?.aud ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Firebase Admin could not verify the provided token.'
    const code = typeof error === 'object' && error && 'code' in error ? String((error as any).code) : undefined

    res.status(200).json({
      ok: false,
      message,
      code,
      config: firebaseAdminConfigStatus,
    })
  }
}
