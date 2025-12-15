/**
 * OCBC Token Store
 * Centralized token storage for OCBC OAuth tokens
 *
 * TODO: Replace with secure Firestore storage for production
 * This in-memory store is suitable for development but tokens
 * will be lost on server restart.
 */

import type { OCBCAuthToken } from './types'

// In-memory token store
// Key: userId (email), Value: OCBC auth token
const tokenStore = new Map<string, OCBCAuthToken>()

/**
 * Store a token for a user
 */
export function setToken(userId: string, token: OCBCAuthToken): void {
  tokenStore.set(userId, token)
  console.log('[ocbc/tokenStore] Token stored for user:', userId)
}

/**
 * Get a stored token for a user
 */
export function getToken(userId: string): OCBCAuthToken | undefined {
  return tokenStore.get(userId)
}

/**
 * Delete a stored token for a user
 */
export function deleteToken(userId: string): boolean {
  const deleted = tokenStore.delete(userId)
  if (deleted) {
    console.log('[ocbc/tokenStore] Token deleted for user:', userId)
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
 * Get all stored user IDs (for debugging)
 */
export function getAllUserIds(): string[] {
  return Array.from(tokenStore.keys())
}
