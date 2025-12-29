/**
 * Banking Adapters Registry
 *
 * Provides access to all bank provider adapters.
 */

import type { BankAdapter, BankProviderId } from '../types'
import { airwallexAdapter } from './airwallex'

// ============================================================================
// Adapter Registry
// ============================================================================

const adapters: Record<string, BankAdapter> = {
  airwallex: airwallexAdapter,
  // ocbc: ocbcAdapter,  // TODO: Add when OCBC is ready
  // hsbc: hsbcAdapter,  // TODO: Add when HSBC is ready
}

// ============================================================================
// Registry Functions
// ============================================================================

/**
 * Get adapter for a specific provider
 */
export function getAdapter(providerId: BankProviderId): BankAdapter | null {
  return adapters[providerId] || null
}

/**
 * Get all registered adapters
 */
export function getAllAdapters(): BankAdapter[] {
  return Object.values(adapters)
}

/**
 * Get list of registered provider IDs
 */
export function getRegisteredProviders(): BankProviderId[] {
  return Object.keys(adapters)
}

/**
 * Check if a provider is registered
 */
export function isProviderRegistered(providerId: BankProviderId): boolean {
  return providerId in adapters
}

/**
 * Get connection status for all providers
 */
export async function getProvidersConnectionStatus(): Promise<
  Array<{ providerId: BankProviderId; connected: boolean }>
> {
  const results = await Promise.all(
    Object.entries(adapters).map(async ([id, adapter]) => ({
      providerId: id as BankProviderId,
      connected: await adapter.isConnected(),
    }))
  )
  return results
}

// ============================================================================
// Exports
// ============================================================================

export { airwallexAdapter }
export * from './airwallex'
