/**
 * Airwallex Adapter
 *
 * Converts Airwallex API responses to generic banking types.
 */

import type {
  BankAdapter,
  BankAccount,
  BankTransaction,
  TransactionFilters,
  TransactionListResponse,
  TransferRequest,
  TransferResult,
  Beneficiary,
  TransactionStatus,
  TransferStatus,
  AccountSummary,
} from '../types'
import type {
  AirwallexAccount,
  AirwallexTransaction,
  AirwallexPayment,
  AirwallexBeneficiary,
  AirwallexTransactionStatus,
  AirwallexPaymentStatus,
} from '../../airwallex/types'

// ============================================================================
// Status Mappers
// ============================================================================

function mapTransactionStatus(status: AirwallexTransactionStatus): TransactionStatus {
  switch (status) {
    case 'PENDING':
      return 'pending'
    case 'PROCESSING':
      return 'processing'
    case 'RECEIVED':
    case 'SUCCEEDED':
      return 'completed'
    case 'FAILED':
      return 'failed'
    case 'CANCELLED':
      return 'cancelled'
    default:
      return 'pending'
  }
}

function mapPaymentStatus(status: AirwallexPaymentStatus): TransferStatus {
  switch (status) {
    case 'CREATED':
      return 'created'
    case 'PENDING':
    case 'IN_REVIEW':
      return 'pending'
    case 'PROCESSING':
      return 'processing'
    case 'PAID':
      return 'completed'
    case 'FAILED':
      return 'failed'
    case 'CANCELLED':
      return 'cancelled'
    default:
      return 'pending'
  }
}

// ============================================================================
// Data Mappers
// ============================================================================

export function mapAirwallexAccount(account: AirwallexAccount): BankAccount {
  return {
    id: account.id,
    provider: 'airwallex',
    currency: account.currency,
    accountName: account.account_name || `${account.currency} Wallet`,
    accountType: 'wallet',
    availableBalance: account.available_balance,
    totalBalance: account.total_balance,
    pendingBalance: account.pending_balance,
    reservedBalance: account.reserved_balance,
    status: account.status === 'ACTIVE' ? 'active' : account.status === 'PENDING' ? 'pending' : 'inactive',
    createdAt: account.created_at,
    updatedAt: account.updated_at,
    raw: account as unknown as Record<string, unknown>,
  }
}

export function mapAirwallexTransaction(tx: AirwallexTransaction): BankTransaction {
  return {
    id: tx.id,
    provider: 'airwallex',
    accountId: tx.account_id,
    date: tx.created_at,
    postedDate: tx.posted_at,
    description: tx.description || 'Transaction',
    amount: tx.amount,
    currency: tx.currency,
    type: tx.type === 'credit' ? 'credit' : 'debit',
    status: mapTransactionStatus(tx.status),
    counterparty: tx.counterparty ? {
      name: tx.counterparty.name,
      accountNumber: tx.counterparty.account_number,
      bankName: tx.counterparty.bank_name,
      country: tx.counterparty.bank_country_code,
    } : undefined,
    reference: tx.reference,
    runningBalance: tx.running_balance,
    metadata: tx.metadata,
    raw: tx as unknown as Record<string, unknown>,
  }
}

export function mapAirwallexPayment(payment: AirwallexPayment): TransferResult {
  return {
    id: payment.id,
    provider: 'airwallex',
    status: mapPaymentStatus(payment.status),
    amount: payment.amount,
    currency: payment.currency,
    fee: payment.fee_amount,
    feeCurrency: payment.fee_currency,
    reference: payment.reference,
    createdAt: payment.created_at,
    raw: payment as unknown as Record<string, unknown>,
  }
}

export function mapAirwallexBeneficiary(ben: AirwallexBeneficiary): Beneficiary {
  return {
    id: ben.id,
    provider: 'airwallex',
    name: ben.name,
    nickname: ben.nick_name,
    type: ben.entity_type === 'PERSONAL' ? 'personal' : 'company',
    accountNumber: ben.account_number,
    bankName: ben.bank_name,
    country: ben.bank_country_code,
    currency: ben.account_currency,
    status: 'active', // API doesn't return status in normalized form
    raw: ben as unknown as Record<string, unknown>,
  }
}

// ============================================================================
// Summary Helpers
// ============================================================================

export function calculateAccountSummary(accounts: BankAccount[]): AccountSummary {
  const balancesByCurrency: Record<string, { available: number; total: number; pending: number }> = {}
  const currencies: string[] = []

  for (const account of accounts) {
    if (!balancesByCurrency[account.currency]) {
      balancesByCurrency[account.currency] = { available: 0, total: 0, pending: 0 }
      currencies.push(account.currency)
    }
    balancesByCurrency[account.currency].available += account.availableBalance
    balancesByCurrency[account.currency].total += account.totalBalance
    balancesByCurrency[account.currency].pending += account.pendingBalance || 0
  }

  return {
    provider: 'airwallex',
    totalAccounts: accounts.length,
    currencies,
    balancesByCurrency,
  }
}

// ============================================================================
// Adapter Implementation
// ============================================================================

export class AirwallexAdapter implements BankAdapter {
  providerId = 'airwallex' as const

  async isConnected(): Promise<boolean> {
    try {
      const response = await fetch('/api/airwallex/auth?action=status', {
        credentials: 'include',
      })
      const data = await response.json()
      return data.data?.connected || false
    } catch {
      return false
    }
  }

  async connect(): Promise<boolean> {
    try {
      const response = await fetch('/api/airwallex/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      const data = await response.json()
      return data.success === true
    } catch {
      return false
    }
  }

  async disconnect(): Promise<void> {
    await fetch('/api/airwallex/auth', {
      method: 'DELETE',
      credentials: 'include',
    })
  }

  async getAccounts(): Promise<BankAccount[]> {
    const response = await fetch('/api/airwallex/accounts', {
      credentials: 'include',
    })
    const data = await response.json()

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch accounts')
    }

    return (data.data.accounts || []).map(mapAirwallexAccount)
  }

  async getAccountBalance(accountId: string): Promise<BankAccount | null> {
    const accounts = await this.getAccounts()
    return accounts.find(a => a.id === accountId) || null
  }

  async getTransactions(filters?: TransactionFilters): Promise<TransactionListResponse> {
    const params = new URLSearchParams()

    if (filters?.accountId) params.set('account_id', filters.accountId)
    if (filters?.fromDate) params.set('from_date', filters.fromDate)
    if (filters?.toDate) params.set('to_date', filters.toDate)
    if (filters?.type) params.set('type', filters.type)
    if (filters?.pageNum !== undefined) params.set('page_num', String(filters.pageNum))
    if (filters?.pageSize !== undefined) params.set('page_size', String(filters.pageSize))

    const response = await fetch(`/api/airwallex/transactions?${params.toString()}`, {
      credentials: 'include',
    })
    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch transactions')
    }

    return {
      transactions: (data.data?.transactions || []).map(mapAirwallexTransaction),
      hasMore: data.data?.hasMore || false,
      pageNum: filters?.pageNum || 0,
    }
  }

  async createTransfer(request: TransferRequest): Promise<TransferResult> {
    const response = await fetch('/api/airwallex/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        source_id: request.fromAccountId,
        beneficiary_id: request.beneficiaryId,
        amount: request.amount,
        currency: request.currency,
        reference: request.reference,
        reason: request.remarks,
      }),
    })
    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Failed to create transfer')
    }

    return mapAirwallexPayment(data.data)
  }

  async getTransferStatus(transferId: string): Promise<TransferResult | null> {
    const response = await fetch(`/api/airwallex/payments/${transferId}`, {
      credentials: 'include',
    })
    const data = await response.json()

    if (!data.success || !data.data) {
      return null
    }

    return mapAirwallexPayment(data.data)
  }

  async getBeneficiaries(): Promise<Beneficiary[]> {
    const response = await fetch('/api/airwallex/beneficiaries', {
      credentials: 'include',
    })
    const data = await response.json()

    if (!data.success || !data.data) {
      return []
    }

    return (data.data.beneficiaries || []).map(mapAirwallexBeneficiary)
  }

  async getBeneficiary(id: string): Promise<Beneficiary | null> {
    const beneficiaries = await this.getBeneficiaries()
    return beneficiaries.find(b => b.id === id) || null
  }
}

// ============================================================================
// Export singleton
// ============================================================================

export const airwallexAdapter = new AirwallexAdapter()
export default airwallexAdapter
