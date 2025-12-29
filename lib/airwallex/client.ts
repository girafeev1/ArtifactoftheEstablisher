/**
 * Airwallex API Client
 * Handles API Key authentication and API calls
 * https://www.airwallex.com/docs/api
 */

import type {
  AirwallexAuthToken,
  AirwallexAuthResponse,
  AirwallexAccount,
  AirwallexBalanceByCurrency,
  AirwallexBalanceResponse,
  AirwallexTransaction,
  AirwallexFinancialTransaction,
  AirwallexFinancialTransactionListResponse,
  AirwallexTransactionParams,
  AirwallexPayment,
  AirwallexPaymentRequest,
  AirwallexPaymentListResponse,
  AirwallexBeneficiary,
  AirwallexBeneficiaryListResponse,
  AirwallexApiError,
  AirwallexGlobalAccount,
  AirwallexGlobalAccountListResponse,
  AirwallexFxRateResponse,
  AirwallexFxRateParams,
  AirwallexCardTransaction,
  AirwallexCardTransactionListResponse,
  AirwallexCardTransactionParams,
  AirwallexCard,
  AirwallexCardListResponse,
} from './types'
import { airwallexConfig } from '../config/integrations'

// ============================================================================
// Configuration (from centralized config)
// ============================================================================

const {
  baseUrl: AIRWALLEX_BASE_URL,
  clientId: AIRWALLEX_CLIENT_ID,
  apiKey: AIRWALLEX_API_KEY,
  rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
  rateLimitMaxCalls: RATE_LIMIT_MAX_CALLS,
} = airwallexConfig

// ============================================================================
// Rate Limiter
// ============================================================================

class RateLimiter {
  private calls: number[] = []
  private windowMs: number
  private maxCalls: number

  constructor(windowMs: number, maxCalls: number) {
    this.windowMs = windowMs
    this.maxCalls = maxCalls
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now()
    this.calls = this.calls.filter(t => now - t < this.windowMs)

    if (this.calls.length >= this.maxCalls) {
      const oldestCall = this.calls[0]
      const waitTime = this.windowMs - (now - oldestCall) + 100
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
      this.calls = this.calls.filter(t => Date.now() - t < this.windowMs)
    }

    this.calls.push(Date.now())
  }
}

const rateLimiter = new RateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_CALLS)

// ============================================================================
// Error Handling
// ============================================================================

export class AirwallexApiException extends Error {
  code: string
  source?: string
  details?: Record<string, unknown>

  constructor(error: AirwallexApiError) {
    super(error.message)
    this.name = 'AirwallexApiException'
    this.code = error.code
    this.source = error.source
    this.details = error.details
  }
}

// ============================================================================
// Authentication
// ============================================================================

/**
 * Authenticate with Airwallex API using Client ID and API Key
 *
 * @param clientId - The x-client-id header value
 * @param apiKey - The API key to authenticate with
 * @param baseUrl - Optional base URL (defaults to production)
 * @returns Authentication token with expiry
 */
export async function authenticate(
  clientId: string = AIRWALLEX_CLIENT_ID,
  apiKey: string = AIRWALLEX_API_KEY,
  baseUrl: string = AIRWALLEX_BASE_URL,
  loginAsAccountId?: string // For ORG-level credentials, specify which account to access
): Promise<AirwallexAuthToken> {
  const authUrl = `${baseUrl}/api/v1/authentication/login`

  console.log('[Airwallex] Authenticating:', {
    url: authUrl,
    clientId: clientId ? `${clientId.slice(0, 8)}...` : 'MISSING',
    apiKeyLength: apiKey?.length || 0,
    loginAs: loginAsAccountId || 'none (org-level)',
  })

  // Build headers - include x-login-as for ORG-level credentials targeting specific account
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-id': clientId,
    'x-api-key': apiKey,
  }

  // x-login-as header tells Airwallex which account to authorize the token for
  // Required when using ORG-level API keys to access account-level resources
  if (loginAsAccountId) {
    headers['x-login-as'] = loginAsAccountId
  }

  const response = await fetch(authUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      api_key: apiKey,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorData: Record<string, unknown> = {}
    try {
      errorData = JSON.parse(errorText)
    } catch {
      errorData = { rawResponse: errorText }
    }

    console.error('[Airwallex] Auth failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorData,
    })

    throw new AirwallexApiException({
      code: (errorData.code as string) || `HTTP_${response.status}`,
      message: (errorData.message as string) || `Failed to authenticate: ${response.statusText}`,
      details: errorData,
    })
  }

  const data: AirwallexAuthResponse = await response.json()

  // Parse the expires_at ISO string to milliseconds
  const expiresAtMs = new Date(data.expires_at).getTime()

  return {
    token: data.token,
    expiresAt: data.expires_at,
    expiresAtMs,
  }
}

/**
 * Check if a token is expired (with 5 minute buffer)
 */
export function isTokenExpired(token: AirwallexAuthToken): boolean {
  const bufferMs = 5 * 60 * 1000
  return Date.now() >= token.expiresAtMs - bufferMs
}

// ============================================================================
// API Client
// ============================================================================

export class AirwallexClient {
  private token: string
  private baseUrl: string
  private clientId: string
  private accountId?: string // For ORG-level access to specific account

  constructor(
    token: string,
    clientId: string = AIRWALLEX_CLIENT_ID,
    baseUrl: string = AIRWALLEX_BASE_URL,
    accountId?: string // Required when using ORG credentials
  ) {
    this.token = token
    this.clientId = clientId
    this.baseUrl = baseUrl
    this.accountId = accountId
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await rateLimiter.waitIfNeeded()

    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'x-client-id': this.clientId,
      ...(options.headers as Record<string, string> || {}),
    }

    // Note: x-login-as is used during authentication, not on each request
    // The token returned by auth already has the account context

    const method = options.method || 'GET'
    console.log(`[Airwallex API] ${method} ${endpoint}`)

    const response = await fetch(url, {
      ...options,
      headers,
    })

    const responseText = await response.text()
    let data: any = {}
    if (responseText) {
      try {
        data = JSON.parse(responseText)
      } catch {
        data = { rawResponse: responseText }
      }
    }

    // Log response details
    const itemCount = Array.isArray(data) ? data.length : data.items?.length
    console.log(`[Airwallex API] Response ${response.status}:`, {
      endpoint,
      status: response.status,
      itemCount: itemCount !== undefined ? itemCount : 'N/A',
      hasMore: data.has_more,
      // Log first item structure for debugging (truncated)
      sampleItem: Array.isArray(data)
        ? (data[0] ? JSON.stringify(data[0]).slice(0, 500) : null)
        : (data.items?.[0] ? JSON.stringify(data.items[0]).slice(0, 500) : null),
    })

    if (!response.ok) {
      console.error(`[Airwallex API] Error:`, data)
      throw new AirwallexApiException({
        code: data.code || `HTTP_${response.status}`,
        message: data.message || 'API request failed',
        source: data.source,
        details: data,
      })
    }

    return data as T
  }

  // ==========================================================================
  // Account APIs
  // ==========================================================================

  /**
   * Get all accounts (wallets) for the authenticated account
   */
  async getAccounts(pageNum: number = 0, pageSize: number = 20): Promise<{
    accounts: AirwallexAccount[]
    hasMore: boolean
  }> {
    // Airwallex "balances/current" returns a list of currency balances for the wallet.
    // We normalize those into "accounts" so the rest of the app can treat each currency
    // balance like a wallet account.
    const balances = await this.request<AirwallexBalanceByCurrency[]>('/api/v1/balances/current')

    // Sort by total balance desc so UI defaults to the biggest balance.
    const sorted = [...balances].sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
    const accounts: AirwallexAccount[] = sorted.map((b) => ({
      id: b.currency,
      account_name: `${b.currency} Wallet`,
      status: 'ACTIVE',
      currency: b.currency,
      available_balance: b.available_amount,
      pending_balance: b.pending_amount,
      reserved_balance: b.reserved_amount,
      total_balance: b.total_amount,
    }))

    return {
      accounts,
      hasMore: false,
    }
  }

  /**
   * Get balance for a specific account
   */
  async getAccountBalance(accountId: string): Promise<AirwallexBalanceResponse> {
    const params = new URLSearchParams({ currency: accountId })
    const balances = await this.request<AirwallexBalanceByCurrency[]>(
      `/api/v1/balances/current?${params.toString()}`
    )
    const first = balances?.[0]
    if (!first) {
      throw new AirwallexApiException({
        code: 'not_found',
        message: `No balance found for currency ${accountId}`,
        details: { accountId },
      })
    }
    return {
      available_amount: first.available_amount,
      pending_amount: first.pending_amount,
      reserved_amount: first.reserved_amount,
      total_amount: first.total_amount,
      currency: first.currency,
    }
  }

  // ==========================================================================
  // Transaction APIs
  // ==========================================================================

  /**
   * Get transaction history
   */
  async getTransactions(
    params: AirwallexTransactionParams = {}
  ): Promise<{
    transactions: AirwallexTransaction[]
    hasMore: boolean
  }> {
    const queryParams = new URLSearchParams()

    const accountId = params.account_id?.trim()
    const currencyFilter = accountId && /^[A-Z]{3}$/.test(accountId) ? accountId : null
    if (accountId && !currencyFilter) queryParams.set('source_id', accountId)
    if (params.from_created_at) queryParams.set('from_created_at', params.from_created_at)
    if (params.to_created_at) queryParams.set('to_created_at', params.to_created_at)
    if (params.page_num !== undefined) queryParams.set('page_num', String(params.page_num))
    if (params.page_size !== undefined) queryParams.set('page_size', String(params.page_size))
    if (params.status) queryParams.set('status', params.status)

    const response = await this.request<AirwallexFinancialTransactionListResponse>(
      `/api/v1/financial_transactions?${queryParams.toString()}`
    )

    const normalizeStatus = (status: string | null | undefined): AirwallexTransaction['status'] => {
      const normalized = (status || '').toUpperCase()
      if (normalized === 'SETTLED' || normalized === 'SUCCEEDED' || normalized === 'COMPLETED') return 'SUCCEEDED'
      if (normalized === 'PENDING') return 'PENDING'
      if (normalized === 'PROCESSING') return 'PROCESSING'
      if (normalized === 'CANCELLED') return 'CANCELLED'
      if (normalized === 'FAILED') return 'FAILED'
      return 'PROCESSING'
    }

    const buildDescription = (tx: AirwallexFinancialTransaction): string => {
      // If API provides a description, use it
      if (tx.description && tx.description.trim()) {
        return tx.description.trim()
      }

      // Build description from transaction_type and source_type
      const parts: string[] = []

      // Transaction type mapping
      const txTypeMap: Record<string, string> = {
        'payment': 'Payment',
        'payout': 'Payout',
        'conversion': 'Currency Conversion',
        'deposit': 'Deposit',
        'withdrawal': 'Withdrawal',
        'transfer': 'Transfer',
        'refund': 'Refund',
        'fee': 'Fee',
        'adjustment': 'Adjustment',
        'funding': 'Funding',
        'settlement': 'Settlement',
      }

      const sourceTypeMap: Record<string, string> = {
        'payment': 'Payment',
        'payout': 'Payout',
        'conversion': 'FX Conversion',
        'global_account': 'Global Account',
        'linked_account': 'Linked Account',
        'card': 'Card Transaction',
        'direct_debit': 'Direct Debit',
      }

      if (tx.transaction_type) {
        const mapped = txTypeMap[tx.transaction_type.toLowerCase()] || tx.transaction_type
        parts.push(mapped)
      }

      if (tx.source_type && tx.source_type !== tx.transaction_type) {
        const mapped = sourceTypeMap[tx.source_type.toLowerCase()] || tx.source_type
        if (!parts.includes(mapped)) {
          parts.push(`(${mapped})`)
        }
      }

      // Add currency pair for conversions
      if (tx.currency_pair) {
        parts.push(`- ${tx.currency_pair}`)
      }

      return parts.length > 0 ? parts.join(' ') : `${tx.currency} Transaction`
    }

    const toInternalTransaction = (tx: AirwallexFinancialTransaction): AirwallexTransaction => {
      const rawAmount = typeof tx.amount === 'number' ? tx.amount : 0
      const type: AirwallexTransaction['type'] = rawAmount >= 0 ? 'credit' : 'debit'
      const amount = Math.abs(rawAmount)
      const currency = tx.currency

      return {
        id: tx.id,
        // Treat each currency balance as an account (keeps accounts + txs joinable).
        account_id: currency,
        amount,
        currency,
        type,
        status: normalizeStatus(tx.status),
        created_at: tx.created_at,
        updated_at: tx.settled_at || tx.created_at,
        posted_at: tx.settled_at || tx.estimated_settled_at || undefined,
        description: buildDescription(tx),
        reference: tx.batch_id || undefined,
        metadata: {
          ...(tx.source_id ? { source_id: String(tx.source_id) } : {}),
          ...(tx.funding_source_id ? { funding_source_id: String(tx.funding_source_id) } : {}),
          ...(tx.source_type ? { source_type: String(tx.source_type) } : {}),
          ...(tx.transaction_type ? { transaction_type: String(tx.transaction_type) } : {}),
        },
      }
    }

    const normalizedTransactions = (response.items || []).map(toInternalTransaction)
    const filtered = currencyFilter
      ? normalizedTransactions.filter((tx) => tx.currency === currencyFilter)
      : normalizedTransactions

    return {
      transactions: filtered,
      hasMore: response.has_more,
    }
  }

  /**
   * Get all transactions for a date range (handles pagination)
   */
  async getAllTransactions(
    fromDate: string,
    toDate: string,
    accountId?: string
  ): Promise<AirwallexTransaction[]> {
    const allTransactions: AirwallexTransaction[] = []
    let pageNum = 0
    let hasMore = true
    const pageSize = 100

    while (hasMore) {
      const result = await this.getTransactions({
        account_id: accountId,
        from_created_at: fromDate,
        to_created_at: toDate,
        page_num: pageNum,
        page_size: pageSize,
      })

      allTransactions.push(...result.transactions)
      hasMore = result.hasMore
      pageNum++

      // Safety limit
      if (pageNum > 100) {
        console.warn('Airwallex: Hit pagination limit, stopping at 10,000 transactions')
        break
      }
    }

    return allTransactions
  }

  // ==========================================================================
  // Payment APIs
  // ==========================================================================

  /**
   * Create a payment
   */
  async createPayment(request: AirwallexPaymentRequest): Promise<AirwallexPayment> {
    return this.request<AirwallexPayment>('/api/v1/payments/create', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Get payment details
   */
  async getPayment(paymentId: string): Promise<AirwallexPayment> {
    return this.request<AirwallexPayment>(`/api/v1/payments/${paymentId}`)
  }

  /**
   * List payments
   */
  async getPayments(pageNum: number = 0, pageSize: number = 20): Promise<{
    payments: AirwallexPayment[]
    hasMore: boolean
  }> {
    const params = new URLSearchParams({
      page_num: String(pageNum),
      page_size: String(pageSize),
    })

    const response = await this.request<AirwallexPaymentListResponse>(
      `/api/v1/payments?${params.toString()}`
    )

    return {
      payments: response.items || [],
      hasMore: response.has_more,
    }
  }

  // ==========================================================================
  // Beneficiary APIs
  // ==========================================================================

  /**
   * List beneficiaries
   * Note: API returns nested structure, we normalize it
   */
  async getBeneficiaries(pageNum: number = 0, pageSize: number = 20): Promise<{
    beneficiaries: AirwallexBeneficiary[]
    hasMore: boolean
  }> {
    const params = new URLSearchParams({
      page_num: String(pageNum),
      page_size: String(pageSize),
    })

    const response = await this.request<AirwallexBeneficiaryListResponse>(
      `/api/v1/beneficiaries?${params.toString()}`
    )

    // Normalize the nested API response to flat structure
    const beneficiaries: AirwallexBeneficiary[] = (response.items || []).map(item => {
      const details = item.beneficiary
      const bankDetails = details.bank_details || {}

      // Build name from entity type
      let name = bankDetails.account_name || ''
      if (!name && details.entity_type === 'PERSONAL') {
        name = [details.first_name, details.last_name].filter(Boolean).join(' ')
      }
      if (!name && details.entity_type === 'COMPANY') {
        name = details.company_name || ''
      }

      return {
        id: item.beneficiary_id,
        name: name || 'Unknown',
        account_number: bankDetails.account_number,
        bank_name: bankDetails.bank_name,
        bank_country_code: bankDetails.bank_country_code,
        account_currency: bankDetails.account_currency,
        entity_type: details.entity_type,
        payment_methods: item.payment_methods,
      }
    })

    return {
      beneficiaries,
      hasMore: response.has_more,
    }
  }

  /**
   * Get beneficiary details
   */
  async getBeneficiary(beneficiaryId: string): Promise<AirwallexBeneficiary> {
    return this.request<AirwallexBeneficiary>(`/api/v1/beneficiaries/${beneficiaryId}`)
  }

  // ==========================================================================
  // Global Accounts APIs
  // ==========================================================================

  /**
   * List global accounts (virtual bank accounts for receiving funds)
   */
  async getGlobalAccounts(pageNum: number = 0, pageSize: number = 20): Promise<{
    globalAccounts: AirwallexGlobalAccount[]
    hasMore: boolean
  }> {
    const params = new URLSearchParams({
      page_num: String(pageNum),
      page_size: String(pageSize),
    })

    const response = await this.request<AirwallexGlobalAccountListResponse>(
      `/api/v1/global_accounts?${params.toString()}`
    )

    return {
      globalAccounts: response.items || [],
      hasMore: response.has_more,
    }
  }

  /**
   * Get global account details
   */
  async getGlobalAccount(globalAccountId: string): Promise<AirwallexGlobalAccount> {
    return this.request<AirwallexGlobalAccount>(`/api/v1/global_accounts/${globalAccountId}`)
  }

  // ==========================================================================
  // FX Rate APIs
  // ==========================================================================

  /**
   * Get current FX rate for a currency pair
   * @param params - Currency pair and amount parameters
   * @returns FX rate information including converted amount
   */
  async getFxRate(params: AirwallexFxRateParams): Promise<AirwallexFxRateResponse> {
    const queryParams = new URLSearchParams()
    queryParams.set('buy_currency', params.buy_currency)
    queryParams.set('sell_currency', params.sell_currency)

    if (params.buy_amount !== undefined) {
      queryParams.set('buy_amount', String(params.buy_amount))
    }
    if (params.sell_amount !== undefined) {
      queryParams.set('sell_amount', String(params.sell_amount))
    }
    if (params.conversion_date) {
      queryParams.set('conversion_date', params.conversion_date)
    }

    return this.request<AirwallexFxRateResponse>(
      `/api/v1/fx/rates/current?${queryParams.toString()}`
    )
  }

  /**
   * Get FX rates for multiple currency pairs at once
   * @param sellCurrency - Base currency to convert from
   * @param buyCurrencies - Target currencies to convert to
   * @param sellAmount - Amount to convert
   * @returns Map of currency to rate info
   */
  async getFxRates(
    sellCurrency: string,
    buyCurrencies: string[],
    sellAmount: number
  ): Promise<Map<string, AirwallexFxRateResponse>> {
    const results = new Map<string, AirwallexFxRateResponse>()

    // Fetch rates in parallel
    const promises = buyCurrencies.map(async (buyCurrency) => {
      try {
        const rate = await this.getFxRate({
          sell_currency: sellCurrency,
          buy_currency: buyCurrency,
          sell_amount: sellAmount,
        })
        return { buyCurrency, rate }
      } catch (error) {
        console.warn(`[Airwallex] Failed to get FX rate for ${sellCurrency}/${buyCurrency}:`, error)
        return { buyCurrency, rate: null }
      }
    })

    const responses = await Promise.all(promises)
    for (const { buyCurrency, rate } of responses) {
      if (rate) {
        results.set(buyCurrency, rate)
      }
    }

    return results
  }

  // ==========================================================================
  // Card Issuing APIs
  // ==========================================================================

  /**
   * Get card transactions with merchant details
   * This endpoint provides enriched data including merchant name, category, location
   */
  async getCardTransactions(
    params: AirwallexCardTransactionParams = {}
  ): Promise<{
    transactions: AirwallexCardTransaction[]
    hasMore: boolean
  }> {
    const queryParams = new URLSearchParams()

    if (params.card_id) queryParams.set('card_id', params.card_id)
    if (params.from_created_date) queryParams.set('from_created_date', params.from_created_date)
    if (params.to_created_date) queryParams.set('to_created_date', params.to_created_date)
    if (params.billing_currency) queryParams.set('billing_currency', params.billing_currency)
    if (params.transaction_type) queryParams.set('transaction_type', params.transaction_type)
    if (params.page_num !== undefined) queryParams.set('page_num', String(params.page_num))
    if (params.page_size !== undefined) queryParams.set('page_size', String(params.page_size))

    const response = await this.request<AirwallexCardTransactionListResponse>(
      `/api/v1/issuing/transactions?${queryParams.toString()}`
    )

    return {
      transactions: response.items || [],
      hasMore: response.has_more,
    }
  }

  /**
   * Get a single card transaction by ID
   */
  async getCardTransaction(transactionId: string): Promise<AirwallexCardTransaction> {
    return this.request<AirwallexCardTransaction>(
      `/api/v1/issuing/transactions/${transactionId}`
    )
  }

  /**
   * Get all card transactions for a date range (handles pagination)
   */
  async getAllCardTransactions(
    fromDate?: string,
    toDate?: string,
    cardId?: string
  ): Promise<AirwallexCardTransaction[]> {
    const allTransactions: AirwallexCardTransaction[] = []
    let pageNum = 0
    let hasMore = true
    const pageSize = 100

    while (hasMore) {
      const result = await this.getCardTransactions({
        card_id: cardId,
        from_created_date: fromDate,
        to_created_date: toDate,
        page_num: pageNum,
        page_size: pageSize,
      })

      allTransactions.push(...result.transactions)
      hasMore = result.hasMore
      pageNum++

      // Safety limit
      if (pageNum > 100) {
        console.warn('Airwallex: Hit pagination limit for card transactions')
        break
      }
    }

    return allTransactions
  }

  /**
   * Get list of cards
   */
  async getCards(pageNum: number = 0, pageSize: number = 20): Promise<{
    cards: AirwallexCard[]
    hasMore: boolean
  }> {
    const params = new URLSearchParams({
      page_num: String(pageNum),
      page_size: String(pageSize),
    })

    const response = await this.request<AirwallexCardListResponse>(
      `/api/v1/issuing/cards?${params.toString()}`
    )

    return {
      cards: response.items || [],
      hasMore: response.has_more,
    }
  }

  /**
   * Get card details
   */
  async getCard(cardId: string): Promise<AirwallexCard> {
    return this.request<AirwallexCard>(`/api/v1/issuing/cards/${cardId}`)
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an Airwallex client with the given token
 * @param token - Bearer token from authentication
 * @param clientId - Client ID (defaults to config)
 * @param baseUrl - API base URL (defaults to config)
 * @param accountId - Account ID for x-on-behalf-of header (required for ORG credentials)
 */
export function createAirwallexClient(
  token: string,
  clientId?: string,
  baseUrl?: string,
  accountId?: string
): AirwallexClient {
  return new AirwallexClient(token, clientId, baseUrl, accountId)
}

/**
 * Create an authenticated Airwallex client
 * Authenticates and returns a ready-to-use client
 */
export async function createAuthenticatedClient(
  clientId: string = AIRWALLEX_CLIENT_ID,
  apiKey: string = AIRWALLEX_API_KEY,
  baseUrl: string = AIRWALLEX_BASE_URL
): Promise<{ client: AirwallexClient; token: AirwallexAuthToken }> {
  const token = await authenticate(clientId, apiKey, baseUrl)
  const client = new AirwallexClient(token.token, clientId, baseUrl)

  return { client, token }
}
