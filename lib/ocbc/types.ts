/**
 * OCBC CONNECT2OCBC API Type Definitions
 * Hong Kong Corporate Banking APIs
 */

// ============================================================================
// Authentication Types
// ============================================================================

export interface OCBCAuthToken {
  accessToken: string
  refreshToken?: string
  tokenType: string
  expiresIn: number
  expiresAt: number // Unix timestamp when token expires
  scope?: string
}

export interface OCBCAuthConfig {
  clientId: string
  clientSecret: string
  baseUrl: string
  redirectUri?: string
}

// ============================================================================
// Account Types
// ============================================================================

export interface OCBCAccount {
  accountNo: string
  accountType: string
  accountName?: string
  currency: string
  balance: number
  availableBalance: number
  ledgerBalance?: number
  holdAmount?: number
  status?: string
}

export interface OCBCAccountListResponse {
  success: boolean
  errorMessage?: string
  responseList: OCBCAccount[]
}

export interface OCBCAccountBalanceResponse {
  success: boolean
  errorMessage?: string
  results: {
    balance: {
      ledgerBalance: number
      availableBalance: number
      holdAmount?: number
    }
    dueDate?: string
  }
}

// ============================================================================
// Transaction Types
// ============================================================================

export type TransactionType = 'credit' | 'debit'

export interface OCBCTransaction {
  transactionId: string
  transactionDate: string
  valueDate?: string
  postingDate?: string
  description: string
  narrative?: string
  amount: number
  currency: string
  runningBalance?: number
  type: TransactionType
  reference?: string
  chequeNumber?: string
}

export interface OCBCTransactionHistoryResponse {
  success: boolean
  errorMessage?: string
  responseList: OCBCTransaction[]
  totalRecords?: number
  pageNumber?: number
  pageSize?: number
  hasMore?: boolean
}

export interface TransactionHistoryParams {
  accountNo: string
  startDate?: string // YYYY-MM-DD
  endDate?: string   // YYYY-MM-DD
  page?: number
  pageSize?: number
}

// ============================================================================
// Transfer Types
// ============================================================================

export type TransferType = 'FPS' | 'CHATS' | 'INTERNAL' | 'RTGS' | 'TT'

export interface OCBCTransferRequest {
  fromAccountNo: string
  toAccountNo?: string
  beneficiaryId?: string
  amount: number
  currency: string
  transferType: TransferType
  reference?: string
  narrative?: string
  fpsProxyType?: 'MOBILE' | 'EMAIL' | 'FPSID'
  fpsProxyValue?: string
}

export interface OCBCTransferResponse {
  success: boolean
  errorMessage?: string
  transactionId?: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REJECTED'
  reference?: string
  timestamp?: string
}

export interface OCBCTransferStatus {
  transactionId: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED'
  statusDescription?: string
  completedAt?: string
}

// ============================================================================
// Beneficiary Types
// ============================================================================

export interface OCBCBeneficiary {
  beneficiaryId: string
  beneficiaryName: string
  accountNo?: string
  bankCode?: string
  bankName?: string
  fpsProxyType?: 'MOBILE' | 'EMAIL' | 'FPSID'
  fpsProxyValue?: string
  nickname?: string
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  createdAt?: string
  updatedAt?: string
}

export interface OCBCBeneficiaryListResponse {
  success: boolean
  errorMessage?: string
  responseList: OCBCBeneficiary[]
}

export interface OCBCAddBeneficiaryRequest {
  beneficiaryName: string
  accountNo?: string
  bankCode?: string
  fpsProxyType?: 'MOBILE' | 'EMAIL' | 'FPSID'
  fpsProxyValue?: string
  nickname?: string
}

export interface OCBCAddBeneficiaryResponse {
  success: boolean
  errorMessage?: string
  beneficiaryId?: string
}

// ============================================================================
// API Error Types
// ============================================================================

export interface OCBCApiError {
  code: string
  message: string
  details?: string
  timestamp?: string
}

export interface OCBCApiResponse<T> {
  success: boolean
  data?: T
  error?: OCBCApiError
}

// ============================================================================
// Internal App Types (for UI state)
// ============================================================================

export interface FinanceState {
  selectedAccountNo: string | null
  accounts: OCBCAccount[]
  transactions: OCBCTransaction[]
  beneficiaries: OCBCBeneficiary[]
  isLoading: boolean
  error: string | null
  lastRefreshed: number | null
}

export interface TransferFormData {
  fromAccountNo: string
  transferType: TransferType
  toAccountNo?: string
  beneficiaryId?: string
  fpsProxyType?: 'MOBILE' | 'EMAIL' | 'FPSID'
  fpsProxyValue?: string
  amount: string
  currency: string
  reference?: string
  narrative?: string
}

export interface TransactionFilter {
  startDate?: string
  endDate?: string
  type?: TransactionType | 'all'
  minAmount?: number
  maxAmount?: number
  searchText?: string
}

// ============================================================================
// Firestore Storage Types (for token persistence)
// ============================================================================

export interface StoredOCBCToken {
  accessToken: string // Encrypted
  refreshToken?: string // Encrypted
  expiresAt: number
  createdAt: number
  updatedAt: number
  userId: string
}

export interface OCBCAuditLog {
  id?: string
  userId: string
  action: string
  endpoint: string
  method: string
  timestamp: number
  success: boolean
  errorMessage?: string
  metadata?: Record<string, unknown>
}
