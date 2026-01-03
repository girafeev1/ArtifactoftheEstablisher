/**
 * OCBC OAuth Callback Route
 * Handles the redirect from OCBC after user authorization
 * GET /api/ocbc/callback?code=xxx&state=xxx
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { getAccessToken, OCBCApiException } from '../../../lib/ocbc/client'
import { setToken } from '../../../lib/ocbc/tokenStore'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { code, state, error, error_description } = req.query

    // Handle OAuth error response
    if (error) {
      console.error('[api/ocbc/callback] OAuth error:', {
        error,
        error_description,
      })
      return res.redirect(
        `/bank?error=${encodeURIComponent(
          String(error_description || error)
        )}`
      )
    }

    if (!code || typeof code !== 'string') {
      console.error('[api/ocbc/callback] Missing authorization code')
      return res.redirect(
        '/bank?error=Missing%20authorization%20code'
      )
    }

    // Validate state parameter
    let stateData: { userId?: string; timestamp?: number } = {}
    if (state && typeof state === 'string') {
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      } catch {
        console.warn('[api/ocbc/callback] Failed to parse state parameter')
      }
    }

    // Get current session
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)

    if (!session?.user?.email) {
      console.error('[api/ocbc/callback] No authenticated session')
      return res.redirect('/api/auth/signin?callbackUrl=/bank')
    }

    const userId = session.user.email

    // Verify state matches session (if state was provided)
    if (stateData.userId && stateData.userId !== userId) {
      console.error('[api/ocbc/callback] State userId mismatch', {
        expected: stateData.userId,
        actual: userId,
      })
      return res.redirect(
        '/bank?error=Session%20mismatch'
      )
    }

    // Exchange authorization code for tokens
    // Must match exactly what was registered in OCBC portal
    const redirectUri = process.env.OCBC_REDIRECT_URI || 'http://localhost:3000'

    console.log('[api/ocbc/callback] Exchanging code for tokens', {
      userId,
      redirectUri,
    })

    const token = await getAccessToken(code, redirectUri)

    // Store the token
    setToken(userId, token)

    console.log('[api/ocbc/callback] OCBC connected successfully', {
      userId,
      expiresAt: new Date(token.expiresAt).toISOString(),
    })

    // Redirect back to finance page with success
    return res.redirect('/bank?ocbc_connected=true')

  } catch (error) {
    console.error('[api/ocbc/callback] Error:', error)

    const errorMessage =
      error instanceof OCBCApiException
        ? error.message
        : 'Failed to connect OCBC'

    return res.redirect(
      `/bank?error=${encodeURIComponent(errorMessage)}`
    )
  }
}
