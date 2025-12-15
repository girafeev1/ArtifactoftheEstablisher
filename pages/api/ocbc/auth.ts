/**
 * OCBC Auth API Route
 * GET /api/ocbc/auth - Get OAuth URL for OCBC authorization (Implicit Grant Flow)
 * GET /api/ocbc/auth?action=status - Check if OCBC is connected
 * DELETE /api/ocbc/auth - Disconnect OCBC
 *
 * Note: Token storage is handled by /api/ocbc/auth/store-token (called from client
 * after implicit flow callback returns token in URL fragment)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  buildOAuthUrl,
  isTokenExpired,
  OCBCApiException,
} from '../../../lib/ocbc/client'
import {
  getToken,
  deleteToken,
} from '../../../lib/ocbc/tokenStore'
import type { OCBCAuthToken } from '../../../lib/ocbc/types'

interface AuthResponse {
  success: boolean
  data?: {
    authUrl?: string
    connected?: boolean
    expiresAt?: number
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuthResponse>
) {
  try {
    // Auth check
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)

    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const userId = session.user.email

    switch (req.method) {
      case 'GET': {
        const { action } = req.query

        if (action === 'status') {
          // Check if OCBC is connected
          const storedToken = getToken(userId)
          const connected = !!storedToken && !isTokenExpired(storedToken)

          return res.status(200).json({
            success: true,
            data: {
              connected,
              expiresAt: storedToken?.expiresAt,
            },
          })
        }

        // Generate OAuth URL for OCBC Implicit Grant Flow
        // OCBC requires redirect_uri to match exactly what's registered in their portal
        const redirectUri = process.env.OCBC_REDIRECT_URI || 'http://localhost:8080'

        // OCBC OAuth URL (Implicit Flow - token returned in URL fragment)
        const authUrl = buildOAuthUrl(redirectUri)

        console.log('[api/ocbc/auth] Generated OAuth URL:', {
          redirectUri,
          authUrl: authUrl.substring(0, 100) + '...',
        })

        return res.status(200).json({
          success: true,
          data: { authUrl },
        })
      }

      case 'DELETE': {
        // Disconnect OCBC
        deleteToken(userId)

        console.log('[api/ocbc/auth] OCBC disconnected for user:', userId)

        return res.status(200).json({
          success: true,
          data: { connected: false },
        })
      }

      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
        })
    }
  } catch (error) {
    console.error('[api/ocbc/auth] Error:', error)

    if (error instanceof OCBCApiException) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

// Helper to get stored token (for use in other routes)
export function getStoredToken(userId: string): OCBCAuthToken | undefined {
  const token = getToken(userId)
  if (!token) return undefined

  // Note: OCBC Implicit Grant flow does not provide refresh tokens
  // If token is expired, user needs to re-authenticate
  if (isTokenExpired(token)) {
    console.log('[ocbc/auth] Token expired for user, re-authentication required')
    return undefined
  }

  return token
}
