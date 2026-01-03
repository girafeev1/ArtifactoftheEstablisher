/**
 * Fubon Bank (FBB) Corporate API Client
 *
 * JETCO APIX integration for Fubon Bank Hong Kong Corporate APIs
 * https://sandboxportal.apix.com.hk/jetco/sb/
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  FubonAccount,
  FubonAccountStatusResponse,
  FubonAccountBalance,
  FubonAccountBalanceResponse,
  FubonTransaction,
  FubonTransactionResponse,
  FubonAvailabilityRequest,
  FubonAvailabilityResponse,
  FubonApiError,
  FubonAccountsParams,
  FubonBalanceParams,
  FubonTransactionParams,
  FubonRequestHeaders,
  NormalizedFubonAccount,
  NormalizedFubonTransaction,
} from './types'

// ============================================================================
// Configuration
// ============================================================================

const FUBON_CONFIG = {
  // Sandbox base URL (switch to production when approved)
  baseUrl: process.env.JETCO_API_BASE_URL || 'https://sandbox.apix.com.hk',
  apiKey: process.env.JETCO_API_KEY || '',
  apiSecret: process.env.JETCO_API_SECRET || '',
}

// API paths for each service
const API_PATHS = {
  status: '/jetco/sb/fbb/corporate/status/v1',
  balances: '/jetco/sb/fbb/corporate/balances/v1',
  transactions: '/jetco/sb/fbb/corporate/transactions/v1',
  availability: '/jetco/sb/fbb/corporate/availability/v1',
}

// ============================================================================
// Error Handling
// ============================================================================

export class FubonApiException extends Error {
  httpCode: string
  httpMessage: string
  details?: string

  constructor(error: FubonApiError) {
    super(error.httpMessage || error.moreInformation)
    this.name = 'FubonApiException'
    this.httpCode = error.httpCode
    this.httpMessage = error.httpMessage
    this.details = error.moreInformation
  }
}

// ============================================================================
// API Client
// ============================================================================

export class FubonClient {
  private baseUrl: string
  private apiKey: string
  private apiSecret: string
  private consentId: string
  private tspUserId: string

  constructor(
    consentId: string,
    tspUserId: string,
    config?: { baseUrl?: string; apiKey?: string; apiSecret?: string }
  ) {
    this.baseUrl = config?.baseUrl || FUBON_CONFIG.baseUrl
    this.apiKey = config?.apiKey || FUBON_CONFIG.apiKey
    this.apiSecret = config?.apiSecret || FUBON_CONFIG.apiSecret
    this.consentId = consentId
    this.tspUserId = tspUserId
  }

  private buildHeaders(includeContentType = false): Record<string, string> {
    const headers: Record<string, string> = {
      'X-IBM-Client-Id': this.apiKey,
      'X-IBM-Client-Secret': this.apiSecret,
      'X-Consent-Id': this.consentId,
      'X-Tsp-User-Id': this.tspUserId,
      'X-Request-Id': uuidv4(),
      'Accept-Language': 'en',
      'Accept': 'application/json',
    }

    if (includeContentType) {
      headers['Content-Type'] = 'application/json; charset=utf-8'
    }

    return headers
  }

  private async request<T>(
    path: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}${endpoint}`
    const method = options.method || 'GET'

    console.log(`[Fubon API] ${method} ${url}`)

    const response = await fetch(url, {
      ...options,
      headers: this.buildHeaders(method === 'POST'),
    })

    const responseText = await response.text()
    let data: T | FubonApiError

    try {
      data = JSON.parse(responseText)
    } catch {
      throw new FubonApiException({
        httpCode: String(response.status),
        httpMessage: 'Invalid JSON response',
        moreInformation: responseText.slice(0, 500),
      })
    }

    if (!response.ok) {
      console.error(`[Fubon API] Error:`, data)
      throw new FubonApiException(data as FubonApiError)
    }

    console.log(`[Fubon API] Response ${response.status}:`, {
      url,
      status: response.status,
    })

    return data as T
  }

  // ==========================================================================
  // Account Status APIs
  // ==========================================================================

  /**
   * Get all accounts
   */
  async getAccounts(params: FubonAccountsParams = {}): Promise<{
    accounts: FubonAccount[]
    hasMore: boolean
    totalElements: number
  }> {
    const queryParams = new URLSearchParams()
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))
    if (params.pageIdx) queryParams.set('pageIdx', String(params.pageIdx))

    const query = queryParams.toString()
    const endpoint = `/accounts${query ? `?${query}` : ''}`

    const response = await this.request<FubonAccountStatusResponse>(
      API_PATHS.status,
      endpoint
    )

    return {
      accounts: response.data?.account || [],
      hasMore: !response.last,
      totalElements: response.totalElements,
    }
  }

  /**
   * Get account by ID
   */
  async getAccount(accountId: string): Promise<FubonAccount | null> {
    const response = await this.request<FubonAccountStatusResponse>(
      API_PATHS.status,
      `/accounts/${accountId}`
    )

    return response.data?.account?.[0] || null
  }

  // ==========================================================================
  // Account Balance APIs
  // ==========================================================================

  /**
   * Get balances for all accounts
   */
  async getBalances(params: FubonBalanceParams = {}): Promise<{
    accounts: FubonAccountBalance[]
    hasMore: boolean
    totalElements: number
  }> {
    const queryParams = new URLSearchParams()
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))
    if (params.pageIdx) queryParams.set('pageIdx', String(params.pageIdx))

    const query = queryParams.toString()
    const endpoint = `/accounts/balances${query ? `?${query}` : ''}`

    const response = await this.request<FubonAccountBalanceResponse>(
      API_PATHS.balances,
      endpoint
    )

    return {
      accounts: response.data?.account || [],
      hasMore: !response.last,
      totalElements: response.totalElements,
    }
  }

  /**
   * Get balance for a specific account
   */
  async getAccountBalance(accountId: string): Promise<FubonAccountBalance | null> {
    const response = await this.request<FubonAccountBalanceResponse>(
      API_PATHS.balances,
      `/accounts/${accountId}/balances`
    )

    return response.data?.account?.[0] || null
  }

  // ==========================================================================
  // Transaction APIs
  // ==========================================================================

  /**
   * Get transactions for all accounts
   */
  async getTransactions(params: FubonTransactionParams = {}): Promise<{
    transactions: FubonTransaction[]
    hasMore: boolean
    totalElements: number
  }> {
    const queryParams = new URLSearchParams()
    if (params.showLatest !== undefined) queryParams.set('showLatest', String(params.showLatest))
    if (params.fromDateTime) queryParams.set('fromDateTime', params.fromDateTime)
    if (params.toDateTime) queryParams.set('toDateTime', params.toDateTime)
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))
    if (params.pageIdx) queryParams.set('pageIdx', String(params.pageIdx))

    const query = queryParams.toString()
    const endpoint = `/accounts/transactions${query ? `?${query}` : ''}`

    const response = await this.request<FubonTransactionResponse>(
      API_PATHS.transactions,
      endpoint
    )

    return {
      transactions: response.data?.transaction || [],
      hasMore: !response.last,
      totalElements: response.totalElements,
    }
  }

  /**
   * Get transactions for a specific account
   */
  async getAccountTransactions(
    accountId: string,
    params: Omit<FubonTransactionParams, 'accountId'> = {}
  ): Promise<{
    transactions: FubonTransaction[]
    hasMore: boolean
    totalElements: number
  }> {
    const queryParams = new URLSearchParams()
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))
    if (params.pageIdx) queryParams.set('pageIdx', String(params.pageIdx))

    const query = queryParams.toString()
    const endpoint = `/accounts/${accountId}/transactions${query ? `?${query}` : ''}`

    const response = await this.request<FubonTransactionResponse>(
      API_PATHS.transactions,
      endpoint
    )

    return {
      transactions: response.data?.transaction || [],
      hasMore: !response.last,
      totalElements: response.totalElements,
    }
  }

  /**
   * Get all transactions (handles pagination)
   */
  async getAllTransactions(
    fromDate?: string,
    toDate?: string,
    accountId?: string
  ): Promise<FubonTransaction[]> {
    const allTransactions: FubonTransaction[] = []
    let pageIdx = 1
    let hasMore = true
    const pageSize = 50

    while (hasMore) {
      const result = accountId
        ? await this.getAccountTransactions(accountId, { pageSize, pageIdx })
        : await this.getTransactions({
            fromDateTime: fromDate,
            toDateTime: toDate,
            pageSize,
            pageIdx,
          })

      allTransactions.push(...result.transactions)
      hasMore = result.hasMore
      pageIdx++

      // Safety limit
      if (pageIdx > 100) {
        console.warn('[Fubon] Hit pagination limit')
        break
      }
    }

    return allTransactions
  }

  // ==========================================================================
  // Account Availability APIs
  // ==========================================================================

  /**
   * Check account availability
   */
  async checkAvailability(params: FubonAvailabilityRequest): Promise<boolean> {
    const response = await this.request<FubonAvailabilityResponse>(
      API_PATHS.availability,
      '/accounts/availability',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    )

    return response.data?.status === 'Yes'
  }
}

// ============================================================================
// Normalization Helpers
// ============================================================================

/**
 * Normalize Fubon accounts to generic format for dashboard
 */
export function normalizeAccounts(
  accounts: FubonAccount[],
  balances: FubonAccountBalance[]
): NormalizedFubonAccount[] {
  // Create balance lookup map
  const balanceMap = new Map<string, FubonAccountBalance>()
  for (const bal of balances) {
    balanceMap.set(bal.accountId, bal)
  }

  return accounts.map((account) => {
    const accountBalances = balanceMap.get(account.accountId)?.balance || []

    // Find different balance types
    const availableBalance = accountBalances.find(
      (b) => b.type === 'AvailableBalance'
    )
    const currentBalance = accountBalances.find(
      (b) => b.type === 'CurrentBalance' || b.type === 'OpeningBalance'
    )
    const openingBalance = accountBalances.find(
      (b) => b.type === 'OpeningBalance'
    )

    // Parse amounts (they come as strings)
    const parseAmount = (amount?: string) => parseFloat(amount || '0') || 0

    return {
      id: account.accountId,
      provider: 'fubon' as const,
      accountNumber: account.accountNumber,
      accountType: account.accountType || account.accountSubType || 'Business',
      accountStatus: account.accountStatus,
      currency: account.currency,
      availableBalance: parseAmount(availableBalance?.amount),
      totalBalance: parseAmount(currentBalance?.amount || availableBalance?.amount),
      openingBalance: parseAmount(openingBalance?.amount),
      lastUpdated: currentBalance?.datetime || availableBalance?.datetime,
    }
  })
}

/**
 * Normalize Fubon transactions to generic format for dashboard
 */
export function normalizeTransactions(
  transactions: FubonTransaction[]
): NormalizedFubonTransaction[] {
  return transactions.map((tx) => {
    const amount = parseFloat(tx.amount) || 0
    // Note: API has typo "creditDebitIndictor" but we handle both
    const indicator = tx.creditDebitIndicator || (tx as any).creditDebitIndictor
    const isCredit = indicator?.toLowerCase() === 'credit'

    return {
      id: tx.transactionId,
      provider: 'fubon' as const,
      accountId: tx.accountId,
      accountNumber: tx.accountNumber,
      date: tx.datetime,
      description: tx.transactionDescription || `${tx.transactionCode || 'Transaction'}`,
      amount,
      currency: tx.currency,
      type: isCredit ? 'credit' : 'debit',
      status: tx.status,
      transactionCode: tx.transactionCode,
      runningBalance: tx.balance ? parseFloat(tx.balance.amount) || undefined : undefined,
      currencyExchange: tx.currencyExchange
        ? {
            originalAmount: parseFloat(tx.currencyExchange.amount) || 0,
            originalCurrency: tx.currencyExchange.currency,
            exchangeRate: parseFloat(tx.currencyExchange.rate) || 0,
          }
        : undefined,
    }
  })
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Fubon client
 * @param consentId - Customer consent ID (from OAuth)
 * @param tspUserId - TSP user ID
 * @param config - Optional config overrides
 */
export function createFubonClient(
  consentId: string,
  tspUserId: string,
  config?: { baseUrl?: string; apiKey?: string; apiSecret?: string }
): FubonClient {
  return new FubonClient(consentId, tspUserId, config)
}

/**
 * Check if Fubon is configured
 */
export function isFubonConfigured(): boolean {
  return !!(FUBON_CONFIG.apiKey && FUBON_CONFIG.apiSecret)
}
