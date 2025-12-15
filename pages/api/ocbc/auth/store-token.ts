/**
 * OCBC Token Storage API Route
 * POST /api/ocbc/auth/store-token
 *
 * Receives access token from client-side OAuth implicit flow callback
 * and stores it for the authenticated user.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../auth/[...nextauth]'
import { setToken } from '../../../../lib/ocbc/tokenStore'
import type { OCBCAuthToken } from '../../../../lib/ocbc/types'

interface StoreTokenRequest {
  accessToken: string
  tokenType?: string
  expiresIn?: number
}

interface StoreTokenResponse {
  success: boolean
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StoreTokenResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    // Verify user is authenticated
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)

    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const userId = session.user.email

    // Parse request body
    const { accessToken, tokenType, expiresIn }: StoreTokenRequest = req.body

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Access token is required',
      })
    }

    // Create token object
    const expiresInSeconds = expiresIn || 3600
    const token: OCBCAuthToken = {
      accessToken,
      tokenType: tokenType || 'Bearer',
      expiresIn: expiresInSeconds,
      expiresAt: Date.now() + (expiresInSeconds * 1000),
      scope: 'transactional',
    }

    // Store the token
    setToken(userId, token)

    console.log('[api/ocbc/auth/store-token] Token stored for user:', userId, {
      expiresAt: new Date(token.expiresAt).toISOString(),
    })

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('[api/ocbc/auth/store-token] Error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
