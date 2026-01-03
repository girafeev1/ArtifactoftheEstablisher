/**
 * Fubon Bank Auth API Route
 *
 * GET /api/fubon/auth - Check connection status
 * POST /api/fubon/auth - Connect with consent details
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { isFubonConfigured, createFubonClient } from '../../../lib/fubon'

// In-memory token store (replace with persistent storage in production)
const tokenStore = new Map<string, { consentId: string; tspUserId: string; connectedAt: string }>()

export function getStoredFubonToken(userId: string) {
  return tokenStore.get(userId)
}

export function setStoredFubonToken(
  userId: string,
  data: { consentId: string; tspUserId: string }
) {
  tokenStore.set(userId, {
    ...data,
    connectedAt: new Date().toISOString(),
  })
}

export function clearStoredFubonToken(userId: string) {
  tokenStore.delete(userId)
}

interface AuthResponse {
  success: boolean
  connected?: boolean
  configured?: boolean
  error?: string
  connectedAt?: string
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

    if (req.method === 'GET') {
      // Check connection status
      const configured = isFubonConfigured()
      const stored = getStoredFubonToken(userId)

      if (!configured) {
        return res.status(200).json({
          success: true,
          connected: false,
          configured: false,
        })
      }

      if (!stored) {
        return res.status(200).json({
          success: true,
          connected: false,
          configured: true,
        })
      }

      // Test the connection by making a simple API call
      try {
        const client = createFubonClient(stored.consentId, stored.tspUserId)
        await client.getAccounts({ pageSize: 1 })

        return res.status(200).json({
          success: true,
          connected: true,
          configured: true,
          connectedAt: stored.connectedAt,
        })
      } catch (error) {
        console.error('[api/fubon/auth] Connection test failed:', error)
        // Connection exists but may be invalid
        return res.status(200).json({
          success: true,
          connected: false,
          configured: true,
          error: 'Connection test failed',
        })
      }
    }

    if (req.method === 'POST') {
      // Connect with consent details
      const { consentId, tspUserId } = req.body

      if (!consentId || !tspUserId) {
        return res.status(400).json({
          success: false,
          error: 'Missing consentId or tspUserId',
        })
      }

      // Test the connection
      try {
        const client = createFubonClient(consentId, tspUserId)
        await client.getAccounts({ pageSize: 1 })

        // Store the connection
        setStoredFubonToken(userId, { consentId, tspUserId })

        console.log('[api/fubon/auth] Connected successfully:', { userId })

        return res.status(200).json({
          success: true,
          connected: true,
          configured: true,
          connectedAt: new Date().toISOString(),
        })
      } catch (error) {
        console.error('[api/fubon/auth] Connection failed:', error)
        return res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed',
        })
      }
    }

    if (req.method === 'DELETE') {
      // Disconnect
      clearStoredFubonToken(userId)
      console.log('[api/fubon/auth] Disconnected:', { userId })

      return res.status(200).json({
        success: true,
        connected: false,
      })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('[api/fubon/auth] Error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
