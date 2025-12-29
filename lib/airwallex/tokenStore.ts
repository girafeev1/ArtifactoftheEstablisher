/**
 * Airwallex Token Store
 * Centralized token storage for Airwallex API tokens
 *
 * TODO: Replace with secure Firestore storage for production
 * This in-memory store is suitable for development but tokens
 * will be lost on server restart.
 */

import type { AirwallexAuthToken } from './types'

// Extended token with metadata
interface StoredToken {
  token: AirwallexAuthToken
  accountId: string
  clientId: string
  createdAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __airwallexTokenStore: Map<string, StoredToken> | undefined
  // eslint-disable-next-line no-var
  var __airwallexLastSyncedStore: Map<string, number> | undefined
}

// In-memory token store (global so it works across Next.js route bundles in dev)
// Key: userId (email), Value: Airwallex token with metadata
const tokenStore = globalThis.__airwallexTokenStore ?? new Map<string, StoredToken>()
globalThis.__airwallexTokenStore = tokenStore

/**
 * Store a token for a user
 */
export function setToken(
  userId: string,
  token: AirwallexAuthToken,
  accountId: string,
  clientId: string
): void {
  tokenStore.set(userId, {
    token,
    accountId,
    clientId,
    createdAt: Date.now(),
  })
  console.log('[airwallex/tokenStore] Token stored for user:', userId)
}

/**
 * Get a stored token for a user
 */
export function getToken(userId: string): AirwallexAuthToken | undefined {
  const stored = tokenStore.get(userId)
  return stored?.token
}

/**
 * Get the full stored data including account info
 */
export function getStoredData(userId: string): StoredToken | undefined {
  return tokenStore.get(userId)
}

/**
 * Delete a stored token for a user
 */
export function deleteToken(userId: string): boolean {
  const deleted = tokenStore.delete(userId)
  if (deleted) {
    console.log('[airwallex/tokenStore] Token deleted for user:', userId)
  }
  return deleted
}

/**
 * Check if a user has a stored token
 */
export function hasToken(userId: string): boolean {
  return tokenStore.has(userId)
}

/**
 * Get connection status for a user
 */
export function getConnectionStatus(userId: string): {
  connected: boolean
  accountId?: string
  expiresAt?: number
} {
  const stored = tokenStore.get(userId)

  if (!stored) {
    return { connected: false }
  }

  return {
    connected: true,
    accountId: stored.accountId,
    expiresAt: stored.token.expiresAtMs,
  }
}

/**
 * Get all stored user IDs (for debugging)
 */
export function getAllUserIds(): string[] {
  return Array.from(tokenStore.keys())
}

/**
 * Update last synced timestamp
 * Note: In production, this should be stored in Firestore
 */
const lastSyncedStore = globalThis.__airwallexLastSyncedStore ?? new Map<string, number>()
globalThis.__airwallexLastSyncedStore = lastSyncedStore

export function setLastSynced(userId: string, timestamp: number): void {
  lastSyncedStore.set(userId, timestamp)
}

export function getLastSynced(userId: string): number | undefined {
  return lastSyncedStore.get(userId)
}
