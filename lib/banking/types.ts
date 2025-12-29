/**
 * Generic Banking Types
 *
 * Provider-agnostic types for multi-bank dashboard.
 * All bank-specific data is normalized to these types via adapters.
 */

// ============================================================================
// Provider Types
// ============================================================================

export type BankProviderId = 'airwallex' | 'ocbc' | 'hsbc' | string

export type BankFeature =
  | 'accounts'
  | 'transactions'
  | 'transfers'
  | 'payments'
  | 'beneficiaries'
  | 'fx'
  | 'statements'

export interface BankProvider {
  id: BankProviderId
  name: string
  shortName: string
  logo?: string
  color: string // Brand color for UI
  features: BankFeature[]
  connected: boolean
  lastSynced?: string // ISO date
}

// ============================================================================
// Account Types
// ============================================================================

export type AccountStatus = 'active' | 'inactive' | 'pending' | 'suspended'

export interface BankAccount {
  id: string
  provider: BankProviderId
  currency: string
  accountName: string
  accountNumber?: string
  accountType?: string // e.g., 'savings', 'current', 'wallet'
  availableBalance: number
  totalBalance: number
  pendingBalance?: number
  reservedBalance?: number
  status: AccountStatus
  createdAt?: string
  updatedAt?: string
  raw?: Record<string, unknown> // Original provider data
}

export interface AccountSummary {
  provider: BankProviderId
  totalAccounts: number
  currencies: string[]
  balancesByCurrency: Record<string, {
    available: number
    total: number
    pending: number
  }>
  totalEquivalent?: {
    amount: number
    currency: string
  }
}

// ============================================================================
// Transaction Types
// ============================================================================

export type TransactionType = 'credit' | 'debit'

export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'reversed'

export interface Counterparty {
  name?: string
  accountNumber?: string
  bankName?: string
  bankCode?: string
  country?: string
}

export interface BankTransaction {
  id: string
  provider: BankProviderId
  accountId: string
  date: string // ISO date
  postedDate?: string // When it posted to account
  description: string
  amount: number
  currency: string
  type: TransactionType
  status: TransactionStatus
  counterparty?: Counterparty
  reference?: string
  runningBalance?: number
  category?: string // Auto-categorized
  metadata?: Record<string, string>
  raw?: Record<string, unknown> // Original provider data
}

export interface TransactionFilters {
  accountId?: string
  fromDate?: string
  toDate?: string
  type?: TransactionType
  status?: TransactionStatus
  minAmount?: number
  maxAmount?: number
  search?: string
  pageNum?: number
  pageSize?: number
}

export interface TransactionListResponse {
  transactions: BankTransaction[]
  hasMore: boolean
  totalCount?: number
  pageNum: number
}

// ============================================================================
// Transfer/Payment Types
// ============================================================================

export type TransferStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TransferType =
  | 'internal' // Same bank
  | 'domestic' // Same country
  | 'international' // Cross-border
  | 'fps' // HK FPS
  | 'chats' // HK CHATS

export interface TransferRequest {
  provider: BankProviderId
  fromAccountId: string
  toAccountId?: string
  beneficiaryId?: string
  amount: number
  currency: string
  transferType?: TransferType
  reference?: string
  remarks?: string
  // FPS-specific
  fpsProxyType?: 'MOBILE' | 'EMAIL' | 'FPSID'
  fpsProxyValue?: string
}

export interface TransferResult {
  id: string
  provider: BankProviderId
  status: TransferStatus
  amount: number
  currency: string
  fee?: number
  feeCurrency?: string
  reference?: string
  createdAt: string
  estimatedArrival?: string
  raw?: Record<string, unknown>
}

// ============================================================================
// Beneficiary Types
// ============================================================================

export type BeneficiaryStatus = 'active' | 'pending' | 'disabled'
export type BeneficiaryType = 'personal' | 'company'

export interface Beneficiary {
  id: string
  provider: BankProviderId
  name: string
  nickname?: string
  type: BeneficiaryType
  accountNumber?: string
  bankName?: string
  bankCode?: string
  country?: string
  currency?: string
  status: BeneficiaryStatus
  // FPS-specific
  fpsProxyType?: 'MOBILE' | 'EMAIL' | 'FPSID'
  fpsProxyValue?: string
  createdAt?: string
  raw?: Record<string, unknown>
}

// ============================================================================
// Adapter Interface
// ============================================================================

export interface BankAdapter {
  providerId: BankProviderId

  // Connection
  isConnected(): Promise<boolean>
  connect(): Promise<boolean>
  disconnect(): Promise<void>

  // Accounts
  getAccounts(): Promise<BankAccount[]>
  getAccountBalance(accountId: string): Promise<BankAccount | null>

  // Transactions
  getTransactions(filters?: TransactionFilters): Promise<TransactionListResponse>

  // Transfers (optional based on provider features)
  createTransfer?(request: TransferRequest): Promise<TransferResult>
  getTransferStatus?(transferId: string): Promise<TransferResult | null>

  // Beneficiaries (optional)
  getBeneficiaries?(): Promise<Beneficiary[]>
  getBeneficiary?(id: string): Promise<Beneficiary | null>
}

// ============================================================================
// API Response Types
// ============================================================================

export interface BankingApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  provider?: BankProviderId
}

export interface MultiProviderResponse<T> {
  success: boolean
  providers: Array<{
    provider: BankProviderId
    connected: boolean
    data?: T
    error?: string
  }>
}

// ============================================================================
// Provider Registry
// ============================================================================

export const BANK_PROVIDERS: Record<BankProviderId, Omit<BankProvider, 'connected'>> = {
  airwallex: {
    id: 'airwallex',
    name: 'Airwallex',
    shortName: 'AWX',
    color: '#722ed1',
    features: ['accounts', 'transactions', 'transfers', 'payments', 'beneficiaries', 'fx'],
  },
  ocbc: {
    id: 'ocbc',
    name: 'OCBC Bank',
    shortName: 'OCBC',
    color: '#e60012',
    features: ['accounts', 'transactions', 'transfers', 'beneficiaries'],
  },
  hsbc: {
    id: 'hsbc',
    name: 'HSBC',
    shortName: 'HSBC',
    color: '#db0011',
    features: ['accounts', 'transactions'],
  },
}
