/**
 * GCP Billing Types
 *
 * Type definitions for GCP billing data from BigQuery export.
 * Used for auto-linking GCP charges to accounting transactions.
 */

// ============================================================================
// BigQuery Export Types
// ============================================================================

/**
 * GCP Billing Export row from BigQuery
 * Based on standard billing export schema
 */
export interface GCPBillingRow {
  billing_account_id: string
  service: {
    id: string
    description: string
  }
  sku: {
    id: string
    description: string
  }
  usage_start_time: string // ISO timestamp
  usage_end_time: string // ISO timestamp
  project: {
    id: string
    name: string
    number: string
    labels: Array<{ key: string; value: string }>
  }
  labels: Array<{ key: string; value: string }>
  system_labels: Array<{ key: string; value: string }>
  location: {
    location: string
    country: string
    region: string
    zone: string
  }
  cost: number
  currency: string
  currency_conversion_rate: number
  usage: {
    amount: number
    unit: string
    amount_in_pricing_units: number
    pricing_unit: string
  }
  credits: Array<{
    name: string
    amount: number
    full_name: string
    id: string
    type: string
  }>
  invoice: {
    month: string // YYYYMM format
  }
  cost_type: string
}

// ============================================================================
// Aggregated Types
// ============================================================================

/**
 * Daily cost summary per service
 */
export interface GCPDailyCost {
  date: string // YYYY-MM-DD
  service: string
  serviceId: string
  project: string
  projectId: string
  cost: number
  credits: number
  netCost: number
  currency: string
}

/**
 * Monthly invoice summary
 */
export interface GCPMonthlyInvoice {
  invoiceMonth: string // YYYYMM
  totalCost: number
  totalCredits: number
  netCost: number
  currency: string
  services: Array<{
    service: string
    cost: number
  }>
  projects: Array<{
    project: string
    cost: number
  }>
}

/**
 * Cost breakdown by service for a date range
 */
export interface GCPCostBreakdown {
  startDate: string
  endDate: string
  byService: Array<{
    service: string
    serviceId: string
    cost: number
    percentage: number
  }>
  byProject: Array<{
    project: string
    projectId: string
    cost: number
    percentage: number
  }>
  totalCost: number
  currency: string
}

// ============================================================================
// Evidence Types (for transaction details)
// ============================================================================

/**
 * GCP evidence to show in transaction details
 * Links a bank transaction to GCP billing data
 */
export interface GCPTransactionEvidence {
  transactionId: string
  transactionDate: string
  transactionAmount: number

  // Matched billing data
  invoiceMonth: string
  billingPeriod: {
    start: string
    end: string
  }
  matchedCost: number
  matchConfidence: 'high' | 'medium' | 'low'

  // Breakdown
  breakdown: Array<{
    service: string
    project: string
    cost: number
    usageSummary?: string
  }>

  // Raw data reference
  billingAccountId?: string
  queryTimestamp: string
}

// ============================================================================
// Query Types
// ============================================================================

export interface GCPBillingQuery {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  projectId?: string
  serviceId?: string
  invoiceMonth?: string // YYYYMM
}

export interface GCPBillingQueryResult {
  success: boolean
  data?: GCPDailyCost[] | GCPMonthlyInvoice | GCPCostBreakdown
  error?: string
  queryTimestamp: string
}

// ============================================================================
// Config Types
// ============================================================================

export interface GCPBillingConfig {
  projectId: string
  datasetId: string
  tableId: string
  clientEmail: string
  privateKey: string
}
