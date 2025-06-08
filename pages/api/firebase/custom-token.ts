// pages/api/firebase/custom-token.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { getAuthOptions, refreshAccessToken } from '../auth/[...nextauth]'
import { OAuth2Client } from 'google-auth-library'
import { adminAuth } from '../../../lib/server/firebaseAdmin'
import { loadSecrets } from '../../../lib/server/secretManager'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const options = await getAuthOptions()
  const token = await getToken({ req, secret: options.secret }) as any
  if (!token?.idToken) {
    return res.status(401).json({ error: 'Missing id token' })
  }
  const { secrets } = await loadSecrets()
  let currentToken = token
  let idToken = token.idToken as string
  let ticket
  try {
    const client = new OAuth2Client(secrets.OAUTH_CLIENT_ID)
    ticket = await client.verifyIdToken({ idToken, audience: secrets.OAUTH_CLIENT_ID })
  } catch (err) {
    console.warn('[custom-token] verify failed, attempting refresh', err)
    if (token.refreshToken) {
      currentToken = await refreshAccessToken(token, secrets)
      idToken = currentToken.idToken as string
      const client = new OAuth2Client(secrets.OAUTH_CLIENT_ID)
      ticket = await client.verifyIdToken({ idToken, audience: secrets.OAUTH_CLIENT_ID })
    } else {
      console.error('[custom-token] No refresh token available')
      return res.status(401).json({ error: 'Invalid id token and no refresh token' })
    }
  }

  const payload = ticket.getPayload()
  console.log('[custom-token] token timestamps', { iat: payload?.iat, exp: payload?.exp })
  const uid = payload?.sub
  if (!uid) {
    console.error('[custom-token] Invalid Google ID token payload')
    return res.status(500).json({ error: 'Invalid id token payload' })
  }

  const customToken = await adminAuth.createCustomToken(uid)
  res.status(200).json({ customToken })
}
