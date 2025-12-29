/**
 * OCBC CONNECT2OCBC API Client
 * Handles OAuth 2.0 authentication and API calls
 */

import type {
  OCBCAuthToken,
  OCBCAuthConfig,
  OCBCAccount,
  OCBCAccountListResponse,
  OCBCAccountBalanceResponse,
  OCBCTransaction,
  OCBCTransactionHistoryResponse,
  TransactionHistoryParams,
  OCBCTransferRequest,
  OCBCTransferResponse,
  OCBCBeneficiary,
  OCBCBeneficiaryListResponse,
  OCBCAddBeneficiaryRequest,
  OCBCAddBeneficiaryResponse,
  OCBCApiError,
} from './types'
import { ocbcConfig } from '../config/integrations'

// ============================================================================
// Configuration (from centralized config)
// ============================================================================

const {
  baseUrl: OCBC_BASE_URL,
  clientId: OCBC_CLIENT_ID,
  clientSecret: OCBC_CLIENT_SECRET,
  rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
  rateLimitMaxCalls: RATE_LIMIT_MAX_CALLS,
} = ocbcConfig

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
    // Remove calls outside the window
    this.calls = this.calls.filter(t => now - t < this.windowMs)

    if (this.calls.length >= this.maxCalls) {
      const oldestCall = this.calls[0]
      const waitTime = this.windowMs - (now - oldestCall) + 100 // +100ms buffer
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
      // Clean up again after waiting
      this.calls = this.calls.filter(t => Date.now() - t < this.windowMs)
    }

    this.calls.push(Date.now())
  }
}

const rateLimiter = new RateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_CALLS)

// ============================================================================
// Error Handling
// ============================================================================

export class OCBCApiException extends Error {
  code: string
  details?: string

  constructor(error: OCBCApiError) {
    super(error.message)
    this.name = 'OCBCApiException'
    this.code = error.code
    this.details = error.details
  }
}

// ============================================================================
// OAuth 2.0 Token Management
// ============================================================================

export async function getAccessToken(
  authCode: string,
  redirectUri: string
): Promise<OCBCAuthToken> {
  const response = await fetch(`${OCBC_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${OCBC_CLIENT_ID}:${OCBC_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new OCBCApiException({
      code: 'AUTH_FAILED',
      message: errorData.error_description || 'Failed to get access token',
      details: JSON.stringify(errorData),
    })
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || 'Bearer',
    expiresIn: data.expires_in,
    expiresAt: Date.now() + (data.expires_in * 1000),
    scope: data.scope,
  }
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<OCBCAuthToken> {
  const response = await fetch(`${OCBC_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${OCBC_CLIENT_ID}:${OCBC_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new OCBCApiException({
      code: 'REFRESH_FAILED',
      message: errorData.error_description || 'Failed to refresh access token',
      details: JSON.stringify(errorData),
    })
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    tokenType: data.token_type || 'Bearer',
    expiresIn: data.expires_in,
    expiresAt: Date.now() + (data.expires_in * 1000),
    scope: data.scope,
  }
}

export function isTokenExpired(token: OCBCAuthToken): boolean {
  // Consider token expired 5 minutes before actual expiry
  const bufferMs = 5 * 60 * 1000
  return Date.now() >= token.expiresAt - bufferMs
}

// ============================================================================
// API Client
// ============================================================================

export class OCBCClient {
  private accessToken: string
  private sessionToken?: string

  constructor(accessToken: string, sessionToken?: string) {
    this.accessToken = accessToken
    this.sessionToken = sessionToken
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await rateLimiter.waitIfNeeded()

    const url = `${OCBC_BASE_URL}${endpoint}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    // Add session token if available (required for transactional APIs)
    if (this.sessionToken) {
      headers['sessionToken'] = this.sessionToken
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    const data = await response.json()

    if (!response.ok || data.success === false) {
      throw new OCBCApiException({
        code: data.errorCode || `HTTP_${response.status}`,
        message: data.errorMessage || data.message || 'API request failed',
        details: JSON.stringify(data),
      })
    }

    return data as T
  }

  // ==========================================================================
  // Account APIs
  // ==========================================================================

  async getAccounts(): Promise<OCBCAccount[]> {
    const response = await this.request<OCBCAccountListResponse>(
      '/transactional/accountlisting/1.0'
    )
    return response.responseList || []
  }

  async getAccountBalance(accountNo: string): Promise<{
    ledgerBalance: number
    availableBalance: number
    holdAmount?: number
    dueDate?: string
  }> {
    const params = new URLSearchParams({ accountNo })
    if (this.sessionToken) {
      params.set('sessionToken', this.sessionToken)
    }

    const response = await this.request<OCBCAccountBalanceResponse>(
      `/transactional/accountbalance/1.0?${params.toString()}`
    )

    return {
      ...response.results.balance,
      dueDate: response.results.dueDate,
    }
  }

  // ==========================================================================
  // Transaction APIs
  // ==========================================================================

  async getTransactionHistory(
    params: TransactionHistoryParams
  ): Promise<{
    transactions: OCBCTransaction[]
    totalRecords?: number
    hasMore?: boolean
  }> {
    const queryParams = new URLSearchParams({
      accountNo: params.accountNo,
    })

    if (params.startDate) queryParams.set('startDate', params.startDate)
    if (params.endDate) queryParams.set('endDate', params.endDate)
    if (params.page) queryParams.set('page', String(params.page))
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))
    if (this.sessionToken) queryParams.set('sessionToken', this.sessionToken)

    const response = await this.request<OCBCTransactionHistoryResponse>(
      `/transactional/transactionhistory/1.0?${queryParams.toString()}`
    )

    return {
      transactions: response.responseList || [],
      totalRecords: response.totalRecords,
      hasMore: response.hasMore,
    }
  }

  // ==========================================================================
  // Transfer APIs
  // ==========================================================================

  async initiateTransfer(
    request: OCBCTransferRequest
  ): Promise<OCBCTransferResponse> {
    const endpoint = this.getTransferEndpoint(request.transferType)

    return this.request<OCBCTransferResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        sessionToken: this.sessionToken,
      }),
    })
  }

  private getTransferEndpoint(transferType: string): string {
    switch (transferType) {
      case 'FPS':
        return '/transactional/fps/1.0'
      case 'CHATS':
        return '/transactional/chats/1.0'
      case 'INTERNAL':
        return '/transactional/ift/1.0'
      case 'RTGS':
        return '/transactional/rtgs/1.0'
      case 'TT':
        return '/transactional/tt/1.0'
      default:
        throw new OCBCApiException({
          code: 'INVALID_TRANSFER_TYPE',
          message: `Unknown transfer type: ${transferType}`,
        })
    }
  }

  // ==========================================================================
  // Beneficiary APIs
  // ==========================================================================

  async getBeneficiaries(): Promise<OCBCBeneficiary[]> {
    const params = new URLSearchParams()
    if (this.sessionToken) {
      params.set('sessionToken', this.sessionToken)
    }

    const response = await this.request<OCBCBeneficiaryListResponse>(
      `/transactional/beneficiary/1.0/list?${params.toString()}`
    )
    return response.responseList || []
  }

  async addBeneficiary(
    request: OCBCAddBeneficiaryRequest
  ): Promise<string | undefined> {
    const response = await this.request<OCBCAddBeneficiaryResponse>(
      '/transactional/beneficiary/1.0/add',
      {
        method: 'POST',
        body: JSON.stringify({
          ...request,
          sessionToken: this.sessionToken,
        }),
      }
    )
    return response.beneficiaryId
  }

  async removeBeneficiary(beneficiaryId: string): Promise<boolean> {
    const response = await this.request<{ success: boolean }>(
      '/transactional/beneficiary/1.0/remove',
      {
        method: 'POST',
        body: JSON.stringify({
          beneficiaryId,
          sessionToken: this.sessionToken,
        }),
      }
    )
    return response.success
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createOCBCClient(
  accessToken: string,
  sessionToken?: string
): OCBCClient {
  return new OCBCClient(accessToken, sessionToken)
}

// ============================================================================
// OAuth URL Builder (OCBC Implicit Grant Flow)
// ============================================================================

/**
 * Build the OCBC OAuth authorization URL
 *
 * OCBC uses OAuth 2.0 Implicit Grant flow:
 * - Token is returned directly in URL fragment: redirect_uri#access_token=xxx
 * - No code exchange needed
 *
 * @see https://api.ocbc.com/store (Authorization API documentation)
 */
export function buildOAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: OCBC_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'transactional',
  })

  // OCBC OAuth endpoint (different from standard /oauth2/authorize)
  return `${OCBC_BASE_URL}/ocbcauthentication/api/oauth2/authorize?${params.toString()}`
}

/**
 * Parse token from URL fragment (for implicit grant flow)
 * Fragment format: #access_token=xxx&token_type=Bearer&expires_in=3600
 */
export function parseTokenFromFragment(fragment: string): OCBCAuthToken | null {
  if (!fragment || !fragment.startsWith('#')) {
    return null
  }

  const params = new URLSearchParams(fragment.substring(1))
  const accessToken = params.get('access_token')
  const tokenType = params.get('token_type')
  const expiresIn = params.get('expires_in')

  if (!accessToken) {
    return null
  }

  const expiresInSeconds = expiresIn ? parseInt(expiresIn, 10) : 3600

  return {
    accessToken,
    tokenType: tokenType || 'Bearer',
    expiresIn: expiresInSeconds,
    expiresAt: Date.now() + (expiresInSeconds * 1000),
    scope: 'transactional',
  }
}
