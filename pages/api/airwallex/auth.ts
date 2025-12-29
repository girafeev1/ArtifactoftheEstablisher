/**
 * Airwallex Auth API Route
 *
 * POST /api/airwallex/auth - Authenticate with Airwallex using API Key
 * GET /api/airwallex/auth?action=status - Check connection status
 * DELETE /api/airwallex/auth - Disconnect Airwallex
 *
 * Airwallex uses API Key authentication (not OAuth):
 * - Client sends clientId + apiKey
 * - Server exchanges for bearer token
 * - Token stored for subsequent API calls
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  authenticate,
  isTokenExpired,
  AirwallexApiException,
} from '../../../lib/airwallex/client'
import {
  getToken,
  getStoredData,
  getConnectionStatus,
  setToken,
  deleteToken,
} from '../../../lib/airwallex/tokenStore'
import type { AirwallexAuthToken } from '../../../lib/airwallex/types'
import { airwallexConfig } from '../../../lib/config/integrations'

interface AuthResponse {
  success: boolean
  data?: {
    connected?: boolean
    accountId?: string
    expiresAt?: number
    lastSynced?: number
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
          // Check if Airwallex is connected
          const storedToken = getToken(userId)
          const connected = !!storedToken && !isTokenExpired(storedToken)
          const status = getConnectionStatus(userId)

          return res.status(200).json({
            success: true,
            data: {
              connected,
              accountId: status.accountId,
              expiresAt: status.expiresAt,
            },
          })
        }

        // Default GET returns config status (is Airwallex configured?)
        return res.status(200).json({
          success: true,
          data: {
            connected: false,
          },
        })
      }

      case 'POST': {
        // Authenticate with Airwallex
        const { clientId, apiKey } = req.body

        // Use provided credentials or fall back to env vars
        const effectiveClientId = clientId || airwallexConfig.clientId
        const effectiveApiKey = apiKey || airwallexConfig.apiKey

        if (!effectiveClientId || !effectiveApiKey) {
          return res.status(400).json({
            success: false,
            error: 'Missing clientId or apiKey. Provide in request body or configure in environment.',
          })
        }

        // For ORG credentials, we need to pass x-login-as header during auth
        // to get a token that can access account-level resources
        const accountId = airwallexConfig.defaultAccountId || 'default'
        const useLoginAs = airwallexConfig.isUsingOrgCredentials && accountId !== 'default'

        console.log('[api/airwallex/auth] Authenticating with Airwallex...', {
          usingOrgCredentials: airwallexConfig.isUsingOrgCredentials,
          clientIdPrefix: effectiveClientId.slice(0, 8),
          accountId,
          useLoginAs,
        })

        // Authenticate with Airwallex API
        // Pass accountId as x-login-as for ORG credentials to access account resources
        const token = await authenticate(
          effectiveClientId,
          effectiveApiKey,
          airwallexConfig.baseUrl,
          useLoginAs ? accountId : undefined
        )

        // Store token for user
        setToken(userId, token, accountId, effectiveClientId)

        console.log('[api/airwallex/auth] Token stored with accountId:', accountId)

        console.log('[api/airwallex/auth] Connected successfully:', {
          userId,
          accountId,
          expiresAt: token.expiresAt,
        })

        return res.status(200).json({
          success: true,
          data: {
            connected: true,
            accountId,
            expiresAt: token.expiresAtMs,
          },
        })
      }

      case 'DELETE': {
        // Disconnect Airwallex
        deleteToken(userId)

        console.log('[api/airwallex/auth] Disconnected for user:', userId)

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
    console.error('[api/airwallex/auth] Error:', error)

    if (error instanceof AirwallexApiException) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}

/**
 * Helper to get stored token (for use in other routes)
 * Returns token and accountId for API calls
 */
export function getStoredToken(userId: string): {
  token: AirwallexAuthToken
  accountId: string
} | undefined {
  const stored = getStoredData(userId)
  if (!stored) return undefined

  if (isTokenExpired(stored.token)) {
    console.log('[airwallex/auth] Token expired for user, re-authentication required')
    return undefined
  }

  return {
    token: stored.token,
    accountId: stored.accountId,
  }
}
