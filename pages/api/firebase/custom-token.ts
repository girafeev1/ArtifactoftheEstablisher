// pages/api/firebase/custom-token.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/react'
import { OAuth2Client } from 'google-auth-library'
import { adminAuth } from '../../../lib/server/firebaseAdmin'
import { loadSecrets } from '../../../lib/server/secretManager'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req })
  const idToken = (session as any)?.idToken as string | undefined
  if (!idToken) {
    return res.status(401).json({ error: 'Missing id token' })
  }
  try {
    // Verify the Google ID token against the OAuth client ID
    const { secrets } = await loadSecrets()
    const client = new OAuth2Client(secrets.OAUTH_CLIENT_ID)
    const ticket = await client.verifyIdToken({
      idToken,
      audience: secrets.OAUTH_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    const uid = payload?.sub
    if (!uid) throw new Error('Invalid Google ID token')

    const customToken = await adminAuth.createCustomToken(uid)
    res.status(200).json({ customToken })
  } catch (err) {
    console.error('[custom-token] error', err)
    res.status(500).json({ error: 'Failed to create custom token' })
  }
}
