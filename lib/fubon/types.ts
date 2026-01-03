/**
 * Fubon Bank (FBB) Corporate API Types
 *
 * Based on JETCO APIX OpenAPI specifications:
 * - FBB - Customer Data Access - Retrieve Account Status API For Corporate (1.0.0)
 * - FBB - Customer Data Access - Retrieve Account Balance API For Corporate (1.0.0)
 * - FBB - Customer Data Access - Retrieve Account Transaction API For Corporate (1.0.0)
 * - FBB - Customer Data Access - Retrieve Account Availability API For Corporate (1.0.0)
 */

// ============================================================================
// Common Types
// ============================================================================

export interface FubonPaginationLinks {
  first?: string
  last?: string
  next?: string
  prev?: string
}

export interface FubonPaginatedResponse {
  first: boolean
  last: boolean
  totalPages: number
  totalElements: number
  pageSize: number
  pageIdx: number
  links?: FubonPaginationLinks
}

export interface FubonApiError {
  httpCode: string
  httpMessage: string
  moreInformation: string
}

// ============================================================================
// Account Status Types
// ============================================================================

export interface FubonAccount {
  accountId: string
  accountNumber: string
  accountType?: string
  accountSubType?: string
  productName?: string
  accountStatus: string
  currency: string
}

export interface FubonAccountStatusResponse extends FubonPaginatedResponse {
  data: {
    account: FubonAccount[]
  }
}

// ============================================================================
// Account Balance Types
// ============================================================================

export interface FubonBalance {
  type: string // e.g., "OpeningBalance", "AvailableBalance", "CurrentBalance"
  creditDebitIndicator: string // "Credit" or "Debit"
  amount: string
  currency: string
  datetime: string // ISO 8601 format
}

export interface FubonAccountBalance {
  accountId: string
  balance: FubonBalance[]
}

export interface FubonAccountBalanceResponse extends FubonPaginatedResponse {
  data: {
    account: FubonAccountBalance[]
  }
}

// ============================================================================
// Account Transaction Types
// ============================================================================

export interface FubonCurrencyExchange {
  amount: string
  currency: string
  rate: string
  datetime: string
}

export interface FubonTransactionBalance {
  type: string
  creditDebitIndicator: string
  amount: string
  currency: string
  datetime: string
}

export interface FubonTransaction {
  accountId: string
  accountNumber: string
  transactionCode?: string
  transactionId: string
  transactionDescription?: string
  datetime: string
  creditDebitIndicator: string // Note: API has typo "creditDebitIndictor" but we normalize it
  status: string
  amount: string
  currency: string
  currencyExchange?: FubonCurrencyExchange
  balance?: FubonTransactionBalance
}

export interface FubonTransactionResponse extends FubonPaginatedResponse {
  data: {
    transaction: FubonTransaction[]
  }
}

// ============================================================================
// Account Availability Types
// ============================================================================

export interface FubonAvailabilityParam {
  paramName: string
  paramValue: string
}

export interface FubonAvailabilityRequest {
  data: FubonAvailabilityParam[]
}

export interface FubonAvailabilityResponse {
  data: {
    status: string // "Yes" or "No"
  }
}

// ============================================================================
// API Request Parameters
// ============================================================================

export interface FubonAccountsParams {
  pageSize?: number
  pageIdx?: number
}

export interface FubonBalanceParams {
  accountId?: string
  pageSize?: number
  pageIdx?: number
}

export interface FubonTransactionParams {
  accountId?: string
  showLatest?: boolean
  fromDateTime?: string // ISO 8601 format: "2020-12-22T07:06:20Z"
  toDateTime?: string
  pageSize?: number
  pageIdx?: number
}

// ============================================================================
// Auth / Config Types
// ============================================================================

export interface FubonConfig {
  baseUrl: string
  apiKey: string
  apiSecret: string
}

export interface FubonRequestHeaders {
  'X-IBM-Client-Id': string
  'X-IBM-Client-Secret': string
  'X-Consent-Id': string
  'X-Tsp-User-Id': string
  'X-Request-Id'?: string
  'Accept-Language'?: string
  Accept: string
  'Content-Type'?: string
}

// ============================================================================
// Normalized Types (for dashboard integration)
// ============================================================================

export interface NormalizedFubonAccount {
  id: string
  provider: 'fubon'
  accountNumber: string
  accountType: string
  accountStatus: string
  currency: string
  availableBalance: number
  totalBalance: number
  openingBalance: number
  lastUpdated?: string
}

export interface NormalizedFubonTransaction {
  id: string
  provider: 'fubon'
  accountId: string
  accountNumber: string
  date: string
  description: string
  amount: number
  currency: string
  type: 'credit' | 'debit'
  status: string
  transactionCode?: string
  runningBalance?: number
  currencyExchange?: {
    originalAmount: number
    originalCurrency: string
    exchangeRate: number
  }
}
