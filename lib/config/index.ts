/**
 * Centralized Configuration
 *
 * This module consolidates all environment variables and configuration
 * used throughout the application. Import from here instead of reading
 * process.env directly in individual files.
 *
 * Usage:
 *   import { config } from '@/lib/config'
 *   const apiKey = config.firebase.apiKey
 */

export * from './firebase'
export * from './integrations'
export * from './app'

// Re-export the main config object for convenience
import { firebaseConfig, firebaseAdminConfig } from './firebase'
import { ocbcConfig, airwallexConfig, telegramConfig, googleConfig, gcpBillingConfig } from './integrations'
import { appConfig } from './app'

export const config = {
  firebase: firebaseConfig,
  firebaseAdmin: firebaseAdminConfig,
  ocbc: ocbcConfig,
  airwallex: airwallexConfig,
  telegram: telegramConfig,
  google: googleConfig,
  gcpBilling: gcpBillingConfig,
  app: appConfig,
}

export default config
