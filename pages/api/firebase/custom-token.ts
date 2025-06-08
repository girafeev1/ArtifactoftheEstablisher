import { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/react'
import { adminAuth } from '../../../lib/server/firebaseAdmin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req })
  const idToken = (session as any)?.idToken as string | undefined
  if (!idToken) {
    return res.status(401).json({ error: 'Missing id token' })
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken)
    const customToken = await adminAuth.createCustomToken(decoded.uid)
    res.status(200).json({ customToken })
  } catch (err) {
    console.error('[custom-token] error', err)
    res.status(500).json({ error: 'Failed to create custom token' })
  }
}
