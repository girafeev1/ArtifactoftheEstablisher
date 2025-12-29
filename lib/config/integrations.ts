/**
 * Third-Party Integrations Configuration
 *
 * Configuration for external APIs and services:
 * - OCBC Banking API
 * - Airwallex Payment API
 * - Telegram Bot API
 * - Google APIs (Sheets, Drive)
 * - GCP Billing API
 */

// ============================================================================
// OCBC Banking API
// ============================================================================

export const ocbcConfig = {
  baseUrl: process.env.OCBC_API_BASE_URL || 'https://api.ocbc.com',
  clientId: process.env.OCBC_CLIENT_ID || '',
  clientSecret: process.env.OCBC_CLIENT_SECRET || '',

  // Rate limiting
  rateLimitWindowMs: 60 * 1000, // 1 minute
  rateLimitMaxCalls: 10, // OCBC allows 10 calls per minute

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret)
  },
}

// ============================================================================
// Airwallex Payment API
// ============================================================================

export const airwallexConfig = {
  baseUrl: process.env.AIRWALLEX_API_BASE_URL || 'https://api.airwallex.com',

  // Use account-level credentials for account APIs (balances, transactions, etc.)
  clientId: process.env.AIRWALLEX_CLIENT_ID || '',
  apiKey: process.env.AIRWALLEX_API_KEY || '',

  // ORG-level credentials (for org-level operations only)
  orgClientId: process.env.AIRWALLEX_ORG_CLIENT_ID || '',
  orgApiKey: process.env.AIRWALLEX_ORG_API_KEY || '',

  // Issuing API credentials (separate API key with Issuing access)
  issuingClientId: process.env.AIRWALLEX_ISSUING_CLIENT_ID || '',
  issuingApiKey: process.env.AIRWALLEX_ISSUING_API_KEY || '',

  // Default account (from user's API key file)
  defaultAccountId: process.env.AIRWALLEX_ACCOUNT_ID || '',

  // Rate limiting (Airwallex is more generous)
  rateLimitWindowMs: 60 * 1000,
  rateLimitMaxCalls: 100,

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.apiKey)
  },

  get hasOrgCredentials(): boolean {
    return Boolean(process.env.AIRWALLEX_ORG_CLIENT_ID && process.env.AIRWALLEX_ORG_API_KEY)
  },

  get hasIssuingCredentials(): boolean {
    return Boolean(process.env.AIRWALLEX_ISSUING_CLIENT_ID && process.env.AIRWALLEX_ISSUING_API_KEY)
  },

  // For backward compatibility
  get isUsingOrgCredentials(): boolean {
    return false // We now use account-level by default
  },
}

// ============================================================================
// Telegram Bot API
// ============================================================================

export const telegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',

  get apiUrl(): string {
    return `https://api.telegram.org/bot${this.botToken}`
  },

  get isConfigured(): boolean {
    return Boolean(this.botToken)
  },

  get hasWebhookSecret(): boolean {
    return Boolean(this.webhookSecret)
  },
}

// ============================================================================
// Google APIs (Sheets, Drive)
// ============================================================================

/**
 * Process private key: replace literal \n with newlines
 */
function processPrivateKey(rawKey: string | undefined): string {
  if (!rawKey) return ''
  return rawKey.replace(/\\n/g, '\n')
}

export const googleConfig = {
  projectId: process.env.GOOGLE_PROJECT_ID || '',
  clientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
  privateKey: processPrivateKey(process.env.GOOGLE_PRIVATE_KEY),

  // Google Sheets specific
  sheets: {
    // Invoice template spreadsheet
    invoiceSpreadsheetId: '12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0',
    invoiceSheetId: 403093960, // Instruction tab
  },

  get isConfigured(): boolean {
    return Boolean(this.projectId && this.clientEmail && this.privateKey)
  },

  get credentials() {
    return {
      project_id: this.projectId,
      client_email: this.clientEmail,
      private_key: this.privateKey,
    }
  },
}

// ============================================================================
// GCP Billing API (BigQuery)
// ============================================================================

export const gcpBillingConfig = {
  // BigQuery dataset for billing export
  bigQueryProjectId: process.env.GCP_BILLING_PROJECT_ID || process.env.GOOGLE_PROJECT_ID || '',
  bigQueryDatasetId: process.env.GCP_BILLING_DATASET_ID || '',
  bigQueryTableId: process.env.GCP_BILLING_TABLE_ID || 'gcp_billing_export_v1',

  // Service account for BigQuery access (can reuse Google config)
  clientEmail: process.env.GCP_BILLING_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || '',
  privateKey: processPrivateKey(
    process.env.GCP_BILLING_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY
  ),

  get isConfigured(): boolean {
    return Boolean(
      this.bigQueryProjectId &&
      this.bigQueryDatasetId &&
      this.clientEmail &&
      this.privateKey
    )
  },
}

// ============================================================================
// Calendar Scan (Legacy)
// ============================================================================

export const calendarScanConfig = {
  url: process.env.CALENDAR_SCAN_URL || '',
  secret: process.env.SCAN_SECRET || '',

  get isConfigured(): boolean {
    return Boolean(this.url && this.secret)
  },
}

// ============================================================================
// Validation Helpers
// ============================================================================

export interface IntegrationStatus {
  name: string
  configured: boolean
  missingVars: string[]
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      name: 'OCBC Banking',
      configured: ocbcConfig.isConfigured,
      missingVars: [
        !ocbcConfig.clientId && 'OCBC_CLIENT_ID',
        !ocbcConfig.clientSecret && 'OCBC_CLIENT_SECRET',
      ].filter(Boolean) as string[],
    },
    {
      name: 'Airwallex',
      configured: airwallexConfig.isConfigured,
      missingVars: [
        !airwallexConfig.clientId && 'AIRWALLEX_CLIENT_ID',
        !airwallexConfig.apiKey && 'AIRWALLEX_API_KEY',
      ].filter(Boolean) as string[],
    },
    {
      name: 'Telegram Bot',
      configured: telegramConfig.isConfigured,
      missingVars: [
        !telegramConfig.botToken && 'TELEGRAM_BOT_TOKEN',
      ].filter(Boolean) as string[],
    },
    {
      name: 'Google APIs',
      configured: googleConfig.isConfigured,
      missingVars: [
        !googleConfig.projectId && 'GOOGLE_PROJECT_ID',
        !googleConfig.clientEmail && 'GOOGLE_CLIENT_EMAIL',
        !googleConfig.privateKey && 'GOOGLE_PRIVATE_KEY',
      ].filter(Boolean) as string[],
    },
    {
      name: 'GCP Billing',
      configured: gcpBillingConfig.isConfigured,
      missingVars: [
        !gcpBillingConfig.bigQueryProjectId && 'GCP_BILLING_PROJECT_ID',
        !gcpBillingConfig.bigQueryDatasetId && 'GCP_BILLING_DATASET_ID',
      ].filter(Boolean) as string[],
    },
  ]
}
