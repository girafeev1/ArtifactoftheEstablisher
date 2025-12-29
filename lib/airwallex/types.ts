/**
 * Airwallex API Type Definitions
 * Corporate Banking & Payment APIs
 * https://www.airwallex.com/docs/api
 */

// ============================================================================
// Authentication Types
// ============================================================================

export interface AirwallexAuthToken {
  token: string
  expiresAt: string // ISO datetime when token expires
  expiresAtMs: number // Unix timestamp in milliseconds
}

export interface AirwallexAuthConfig {
  clientId: string
  apiKey: string
  baseUrl: string // 'https://api.airwallex.com' or 'https://api-demo.airwallex.com'
}

export interface AirwallexAuthResponse {
  token: string
  expires_at: string // ISO datetime from API
}

// ============================================================================
// Account Types
// ============================================================================

export interface AirwallexAccount {
  id: string
  account_name: string
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  currency: string
  available_balance: number
  pending_balance: number
  reserved_balance: number
  total_balance: number
  created_at?: string
  updated_at?: string
}

export interface AirwallexAccountListResponse {
  items: AirwallexAccount[]
  has_more: boolean
  page_num?: number
}

export interface AirwallexBalanceResponse {
  available_amount: number
  pending_amount: number
  reserved_amount: number
  total_amount: number
  currency: string
}

export interface AirwallexBalanceByCurrency extends AirwallexBalanceResponse {
  prepayment_amount?: number
}

// ============================================================================
// Transaction Types
// ============================================================================

export type AirwallexTransactionType = 'credit' | 'debit'

export type AirwallexTransactionStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'CANCELLED'
  | 'FAILED'

export interface AirwallexTransaction {
  id: string
  account_id: string
  amount: number
  currency: string
  type: AirwallexTransactionType
  status: AirwallexTransactionStatus
  created_at: string
  updated_at: string
  posted_at?: string
  description?: string
  reference?: string
  counterparty?: {
    name?: string
    account_number?: string
    bank_name?: string
    bank_country_code?: string
  }
  running_balance?: number
  metadata?: Record<string, string>
}

export interface AirwallexTransactionListResponse {
  items: AirwallexTransaction[]
  has_more: boolean
  page_num?: number
}

export interface AirwallexTransactionParams {
  account_id?: string
  from_created_at?: string // ISO datetime
  to_created_at?: string   // ISO datetime
  page_num?: number
  page_size?: number
  status?: AirwallexTransactionStatus
  type?: AirwallexTransactionType
}

// ============================================================================
// Financial Transactions (actual Airwallex endpoint for this account)
// ============================================================================

export interface AirwallexFinancialTransaction {
  id: string
  batch_id?: string | null
  source_id?: string | null
  funding_source_id?: string | null
  source_type?: string | null
  transaction_type?: string | null
  currency: string
  amount: number
  client_rate?: number | null
  currency_pair?: string | null
  net?: number | null
  fee?: number | null
  estimated_settled_at?: string | null
  settled_at?: string | null
  description?: string | null
  status?: string | null
  created_at: string
}

export interface AirwallexFinancialTransactionListResponse {
  items: AirwallexFinancialTransaction[]
  has_more: boolean
}

// ============================================================================
// Payment/Transfer Types
// ============================================================================

export type AirwallexPaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'PROCESSING'
  | 'PAID'
  | 'CANCELLED'
  | 'FAILED'

export interface AirwallexPaymentRequest {
  source_id: string // Account ID to pay from
  beneficiary_id: string
  amount: number
  currency: string
  reference?: string
  reason?: string
}

export interface AirwallexPayment {
  id: string
  source_id: string
  beneficiary_id: string
  amount: number
  currency: string
  status: AirwallexPaymentStatus
  reference?: string
  reason?: string
  created_at: string
  updated_at: string
  paid_at?: string
  fee_amount?: number
  fee_currency?: string
}

export interface AirwallexPaymentListResponse {
  items: AirwallexPayment[]
  has_more: boolean
  page_num: number
}

// ============================================================================
// Beneficiary Types
// ============================================================================

export type AirwallexBeneficiaryStatus = 'CREATED' | 'VERIFIED' | 'DISABLED'

// Actual API response structure (nested)
export interface AirwallexBeneficiaryBankDetails {
  account_currency?: string
  account_name?: string
  account_number?: string
  account_routing_type1?: string
  account_routing_value1?: string
  bank_country_code?: string
  bank_name?: string
  local_clearing_system?: string
  swift_code?: string
  iban?: string
}

export interface AirwallexBeneficiaryDetails {
  additional_info?: Record<string, string>
  bank_details: AirwallexBeneficiaryBankDetails
  entity_type: 'PERSONAL' | 'COMPANY'
  company_name?: string
  first_name?: string
  last_name?: string
}

export interface AirwallexBeneficiaryApiResponse {
  beneficiary: AirwallexBeneficiaryDetails
  beneficiary_id: string
  payer_entity_type?: string
  payment_methods?: string[]
  created_at?: string
  updated_at?: string
}

// Normalized beneficiary for app use
export interface AirwallexBeneficiary {
  id: string
  name: string
  nick_name?: string
  account_number?: string
  bank_name?: string
  bank_country_code?: string
  account_currency?: string
  entity_type: 'PERSONAL' | 'COMPANY'
  payment_methods?: string[]
}

export interface AirwallexBeneficiaryListResponse {
  items: AirwallexBeneficiaryApiResponse[]
  has_more: boolean
  page_num?: number
}

// ============================================================================
// API Error Types
// ============================================================================

export interface AirwallexApiError {
  code: string
  message: string
  source?: string
  details?: Record<string, unknown>
}

export interface AirwallexApiResponse<T> {
  success: boolean
  data?: T
  error?: AirwallexApiError
}

// ============================================================================
// Internal App Types
// ============================================================================

export interface AirwallexConnectionStatus {
  connected: boolean
  accountId?: string
  accountName?: string
  expiresAt?: number
  lastSynced?: number
}

export interface AirwallexSyncResult {
  imported: number
  skipped: number
  autoLinked: number
  errors: string[]
  startDate: string
  endDate: string
}

// ============================================================================
// Firestore Storage Types
// ============================================================================

export interface StoredAirwallexToken {
  token: string // Encrypted in production
  expiresAt: number
  createdAt: number
  updatedAt: number
  userId: string
  accountId: string
}

export interface AirwallexAuditLog {
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

// ============================================================================
// Bank Account ID Mapping
// ============================================================================

/**
 * Airwallex accounts use the format: ERL-AWX-{type}
 * Where type can be:
 * - S: Primary/Settlement account
 * - W: Wallet account
 */
export const AIRWALLEX_BANK_PREFIX = 'AWX'
export const AIRWALLEX_DEFAULT_ACCOUNT_ID = 'ERL-AWX-S'

// ============================================================================
// Global Accounts Types
// ============================================================================

export interface AirwallexGlobalAccountInstitution {
  name: string
  address?: {
    city?: string
    country_code?: string
    postcode?: string
    state?: string
    street_address?: string
  }
}

export interface AirwallexGlobalAccountFeature {
  currency: string
  transfer_method: 'LOCAL' | 'SWIFT'
  local_clearing_system?: string
}

export interface AirwallexGlobalAccount {
  id: string
  account_name: string
  account_number: string
  bank_code?: string
  branch_code?: string
  swift_code?: string
  iban?: string
  bsb_code?: string
  sort_code?: string
  routing_number?: string
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  institution: AirwallexGlobalAccountInstitution
  supported_features: AirwallexGlobalAccountFeature[]
  created_at?: string
  updated_at?: string
  nickname?: string
}

export interface AirwallexGlobalAccountListResponse {
  items: AirwallexGlobalAccount[]
  has_more: boolean
}

// ============================================================================
// FX Rate Types
// ============================================================================

export interface AirwallexFxRateDetail {
  buy_amount: number
  level: string
  rate: number
  sell_amount: number
}

export interface AirwallexFxRateResponse {
  buy_currency: string
  sell_currency: string
  conversion_date: string
  created_at: string
  currency_pair: string
  dealt_currency: string
  rate: number
  rate_details: AirwallexFxRateDetail[]
}

export interface AirwallexFxRateParams {
  buy_currency: string
  sell_currency: string
  buy_amount?: number
  sell_amount?: number
  conversion_date?: string
}

// ============================================================================
// Card Issuing Types (Issuing API)
// ============================================================================

export type AirwallexCardTransactionType =
  | 'AUTHORIZATION'
  | 'CLEARING'
  | 'REFUND'
  | 'REVERSAL'
  | 'ORIGINAL_CREDIT'

export type AirwallexCardTransactionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'REVERSED'
  | 'CLEARED'

export interface AirwallexCardMerchant {
  name: string
  city?: string
  country?: string
  category_code?: string // MCC code
  postal_code?: string
  state?: string
}

export interface AirwallexCardTransaction {
  transaction_id: string
  card_id: string
  card_nickname?: string
  masked_card_number?: string
  transaction_type: AirwallexCardTransactionType
  transaction_amount: number
  transaction_currency: string
  billing_amount: number
  billing_currency: string
  transaction_date: string
  posted_date?: string
  status: AirwallexCardTransactionStatus
  auth_code?: string
  retrieval_ref?: string
  network_transaction_id?: string
  merchant: AirwallexCardMerchant
  decline_reason?: string
  created_at: string
  updated_at?: string
}

export interface AirwallexCardTransactionListResponse {
  items: AirwallexCardTransaction[]
  has_more: boolean
  page_num?: number
}

export interface AirwallexCardTransactionParams {
  card_id?: string
  from_created_date?: string // ISO date
  to_created_date?: string   // ISO date
  billing_currency?: string
  transaction_type?: AirwallexCardTransactionType
  page_num?: number
  page_size?: number
}

// Card details
export interface AirwallexCard {
  card_id: string
  card_nickname?: string
  card_number?: string // Only returned on creation
  masked_card_number: string
  card_status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'EXPIRED'
  card_type: 'VIRTUAL' | 'PHYSICAL'
  cardholder_name: string
  expiry_month: string
  expiry_year: string
  billing_currency: string
  spend_limit?: number
  spend_limit_interval?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL_TIME'
  created_at: string
  updated_at?: string
}

export interface AirwallexCardListResponse {
  items: AirwallexCard[]
  has_more: boolean
  page_num?: number
}

// MCC (Merchant Category Code) mapping for display
export const MCC_CATEGORIES: Record<string, string> = {
  '5812': 'Restaurants',
  '5814': 'Fast Food',
  '5411': 'Grocery Stores',
  '5541': 'Service Stations',
  '5942': 'Book Stores',
  '5045': 'Computers & Software',
  '5734': 'Computer Software Stores',
  '7372': 'Software - Software Services',
  '4816': 'Computer Network Services',
  '5817': 'Digital Goods - Software',
  '5818': 'Digital Goods - Large Seller',
  '7311': 'Advertising Services',
  '7399': 'Business Services',
  '4121': 'Taxi & Rideshare',
  '4131': 'Bus Lines',
  '5311': 'Department Stores',
  '5651': 'Clothing Stores',
  '5691': 'Clothing Stores',
  '5912': 'Drug Stores',
  '5999': 'Miscellaneous Retail',
}
