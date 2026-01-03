/**
 * Accounting Reports
 *
 * Generate Trial Balance, Profit & Loss, and Balance Sheet reports.
 * Supports both accrual and cash basis views.
 */

import type {
  AccountBalance,
  TrialBalance,
  ProfitAndLoss,
  BalanceSheet,
  AccountingBasis,
  Account,
  JournalEntry,
} from './types'
import { listAccounts, getNormalBalance } from './accounts'
import { getDerivedJournalEntries } from './derivedJournals'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate the balance for an account based on its normal balance.
 * For debit-normal accounts: balance = debits - credits (positive is normal)
 * For credit-normal accounts: balance = credits - debits (positive is normal)
 */
function calculateBalance(
  debit: number,
  credit: number,
  normalBalance: 'debit' | 'credit'
): number {
  if (normalBalance === 'debit') {
    return debit - credit
  } else {
    return credit - debit
  }
}

/**
 * Build AccountBalance from account and transaction totals.
 */
function buildAccountBalance(
  account: Account,
  debit: number,
  credit: number
): AccountBalance {
  return {
    accountCode: account.code,
    accountName: account.name,
    accountType: account.type,
    debit,
    credit,
    balance: calculateBalance(debit, credit, account.normalBalance),
  }
}

// ============================================================================
// Trial Balance
// ============================================================================

/**
 * Helper to convert a Timestamp or Date to milliseconds.
 */
function toMillis(val: any): number {
  if (!val) return 0
  if (typeof val.toMillis === 'function') return val.toMillis()
  if (typeof val.getTime === 'function') return val.getTime()
  if (typeof val === 'number') return val
  return new Date(val).getTime()
}

/**
 * Generate a Trial Balance report.
 * Lists all accounts with their debit/credit totals.
 */
export async function generateTrialBalance(options?: {
  asOf?: Date
  basis?: AccountingBasis
}): Promise<TrialBalance> {
  const asOf = options?.asOf ?? new Date()
  const basis = options?.basis ?? 'accrual'

  // Get all accounts
  const accounts = await listAccounts({ activeOnly: true })
  const accountMap = new Map(accounts.map((a) => [a.code, a]))

  // Get all derived journal entries
  const allEntries = await getDerivedJournalEntries()

  // Filter to entries up to asOf date and posted status
  let entries = allEntries.filter((e) => {
    if (e.status !== 'posted') return false
    const postingMillis = toMillis(e.postingDate)
    return postingMillis <= asOf.getTime()
  })

  // For cash basis, only include entries where the source event is PAID
  // (or non-invoice entries which are always included)
  if (basis === 'cash') {
    entries = entries.filter(
      (e) => e.source.type !== 'invoice' || e.source.event === 'PAID'
    )
  }

  // Aggregate by account
  const balances = new Map<string, { debit: number; credit: number }>()
  for (const entry of entries) {
    for (const line of entry.lines) {
      const current = balances.get(line.accountCode) || { debit: 0, credit: 0 }
      balances.set(line.accountCode, {
        debit: current.debit + (line.debit || 0),
        credit: current.credit + (line.credit || 0),
      })
    }
  }

  // Build account balances
  const accountBalances: AccountBalance[] = []
  let totalDebits = 0
  let totalCredits = 0

  for (const [code, { debit, credit }] of balances) {
    const account = accountMap.get(code)
    if (!account) {
      console.warn(`Account ${code} not found in COA`)
      continue
    }

    // Only include accounts with activity
    if (debit > 0 || credit > 0) {
      accountBalances.push(buildAccountBalance(account, debit, credit))
      totalDebits += debit
      totalCredits += credit
    }
  }

  // Sort by account code
  accountBalances.sort((a, b) => a.accountCode.localeCompare(b.accountCode))

  return {
    asOf,
    accounts: accountBalances,
    totalDebits,
    totalCredits,
    isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
  }
}

// ============================================================================
// Profit & Loss (Income Statement)
// ============================================================================

/**
 * Generate a Profit & Loss report for a date range.
 */
export async function generateProfitAndLoss(options: {
  startDate: Date
  endDate: Date
  basis?: AccountingBasis
}): Promise<ProfitAndLoss> {
  const { startDate, endDate } = options
  const basis = options.basis ?? 'accrual'

  // Get all accounts
  const accounts = await listAccounts({ activeOnly: true })
  const accountMap = new Map(accounts.map((a) => [a.code, a]))

  // Get all derived journal entries
  const allEntries = await getDerivedJournalEntries()

  // Filter to entries in date range and posted status
  let entries = allEntries.filter((e) => {
    if (e.status !== 'posted') return false
    const postingMillis = toMillis(e.postingDate)
    return postingMillis >= startDate.getTime() && postingMillis <= endDate.getTime()
  })

  // For cash basis, only include PAID events for invoices
  if (basis === 'cash') {
    entries = entries.filter(
      (e) => e.source.type !== 'invoice' || e.source.event === 'PAID'
    )
  }

  // Aggregate by account
  const balances = new Map<string, { debit: number; credit: number }>()
  for (const entry of entries) {
    for (const line of entry.lines) {
      const current = balances.get(line.accountCode) || { debit: 0, credit: 0 }
      balances.set(line.accountCode, {
        debit: current.debit + (line.debit || 0),
        credit: current.credit + (line.credit || 0),
      })
    }
  }

  // Separate revenue and expenses
  const revenue: AccountBalance[] = []
  const expenses: AccountBalance[] = []
  let totalRevenue = 0
  let totalExpenses = 0

  for (const [code, { debit, credit }] of balances) {
    const account = accountMap.get(code)
    if (!account) continue

    if (account.type === 'revenue') {
      const balance = buildAccountBalance(account, debit, credit)
      revenue.push(balance)
      totalRevenue += balance.balance
    } else if (account.type === 'expense') {
      const balance = buildAccountBalance(account, debit, credit)
      expenses.push(balance)
      totalExpenses += balance.balance
    }
  }

  // Sort by account code
  revenue.sort((a, b) => a.accountCode.localeCompare(b.accountCode))
  expenses.sort((a, b) => a.accountCode.localeCompare(b.accountCode))

  return {
    startDate,
    endDate,
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  }
}

// ============================================================================
// Balance Sheet
// ============================================================================

/**
 * Generate a Balance Sheet as of a specific date.
 */
export async function generateBalanceSheet(options?: {
  asOf?: Date
  basis?: AccountingBasis
}): Promise<BalanceSheet> {
  const asOf = options?.asOf ?? new Date()
  const basis = options?.basis ?? 'accrual'

  // Get all accounts
  const accounts = await listAccounts({ activeOnly: true })
  const accountMap = new Map(accounts.map((a) => [a.code, a]))

  // Get all derived journal entries
  const allEntries = await getDerivedJournalEntries()

  // Filter to entries up to asOf date and posted status
  let entries = allEntries.filter((e) => {
    if (e.status !== 'posted') return false
    const postingMillis = toMillis(e.postingDate)
    return postingMillis <= asOf.getTime()
  })

  // For cash basis, only include PAID events for invoices
  if (basis === 'cash') {
    entries = entries.filter(
      (e) => e.source.type !== 'invoice' || e.source.event === 'PAID'
    )
  }

  // Aggregate by account
  const balances = new Map<string, { debit: number; credit: number }>()
  for (const entry of entries) {
    for (const line of entry.lines) {
      const current = balances.get(line.accountCode) || { debit: 0, credit: 0 }
      balances.set(line.accountCode, {
        debit: current.debit + (line.debit || 0),
        credit: current.credit + (line.credit || 0),
      })
    }
  }

  // Separate by account type
  const assets: AccountBalance[] = []
  const liabilities: AccountBalance[] = []
  const equity: AccountBalance[] = []

  let totalAssets = 0
  let totalLiabilities = 0
  let totalEquity = 0

  // Also calculate net income (revenue - expenses) to add to equity
  let netIncome = 0

  for (const [code, { debit, credit }] of balances) {
    const account = accountMap.get(code)
    if (!account) continue

    const balance = buildAccountBalance(account, debit, credit)

    switch (account.type) {
      case 'asset':
        assets.push(balance)
        totalAssets += balance.balance
        break
      case 'liability':
        liabilities.push(balance)
        totalLiabilities += balance.balance
        break
      case 'equity':
        equity.push(balance)
        totalEquity += balance.balance
        break
      case 'revenue':
        // Revenue increases equity
        netIncome += balance.balance
        break
      case 'expense':
        // Expenses decrease equity
        netIncome -= balance.balance
        break
    }
  }

  // Add net income to equity (as "Current Period Earnings")
  if (netIncome !== 0) {
    equity.push({
      accountCode: 'NET_INCOME',
      accountName: 'Current Period Net Income',
      accountType: 'equity',
      debit: netIncome < 0 ? Math.abs(netIncome) : 0,
      credit: netIncome > 0 ? netIncome : 0,
      balance: netIncome,
    })
    totalEquity += netIncome
  }

  // Sort by account code
  assets.sort((a, b) => a.accountCode.localeCompare(b.accountCode))
  liabilities.sort((a, b) => a.accountCode.localeCompare(b.accountCode))
  equity.sort((a, b) => a.accountCode.localeCompare(b.accountCode))

  // Balance sheet equation: Assets = Liabilities + Equity
  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01

  return {
    asOf,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    isBalanced,
  }
}

// ============================================================================
// AR Aging Report (Bonus)
// ============================================================================

export interface ARAgingEntry {
  invoicePath: string
  invoiceNumber: string
  companyName: string
  amount: number
  issueDate: Date
  daysOutstanding: number
  agingBucket: '0-30' | '31-60' | '61-90' | '90+'
}

export interface ARAgingReport {
  asOf: Date
  entries: ARAgingEntry[]
  totalAR: number
  buckets: {
    '0-30': number
    '31-60': number
    '61-90': number
    '90+': number
  }
}

/**
 * Generate AR Aging report.
 * Shows outstanding invoices grouped by age.
 */
export async function generateARAgingReport(asOf?: Date): Promise<ARAgingReport> {
  const reportDate = asOf ?? new Date()

  // Get all derived journal entries
  const allEntries = await getDerivedJournalEntries()

  // Filter to entries up to reportDate and posted status
  const entries = allEntries.filter((e) => {
    if (e.status !== 'posted') return false
    const postingMillis = toMillis(e.postingDate)
    return postingMillis <= reportDate.getTime()
  })

  // Filter to invoice-related entries
  const invoiceEntries = entries.filter((e) => e.source.type === 'invoice' || e.source.type === 'migration')

  // Group by invoice path
  const invoiceMap = new Map<
    string,
    {
      issued?: JournalEntry
      paid?: JournalEntry
    }
  >()

  for (const entry of invoiceEntries) {
    const path = entry.source.path
    if (!path) continue

    const current = invoiceMap.get(path) || {}
    if (entry.source.event === 'ISSUED') {
      current.issued = entry
    } else if (entry.source.event === 'PAID') {
      current.paid = entry
    }
    invoiceMap.set(path, current)
  }

  // Find unpaid invoices (issued but not paid)
  const unpaidInvoices: ARAgingEntry[] = []
  const buckets = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  }

  for (const [path, { issued, paid }] of invoiceMap) {
    // Skip if paid
    if (paid) continue

    // Skip if not issued
    if (!issued) continue

    // Extract invoice info from journal entry
    const arLine = issued.lines.find((l) => l.accountCode === '1100')
    if (!arLine) continue

    const amount = arLine.debit
    const issueDate = issued.postingDate.toDate()
    const daysOutstanding = Math.floor(
      (reportDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    let agingBucket: ARAgingEntry['agingBucket']
    if (daysOutstanding <= 30) {
      agingBucket = '0-30'
    } else if (daysOutstanding <= 60) {
      agingBucket = '31-60'
    } else if (daysOutstanding <= 90) {
      agingBucket = '61-90'
    } else {
      agingBucket = '90+'
    }

    buckets[agingBucket] += amount

    // Extract invoice number and company from description
    const descMatch = issued.description?.match(/Invoice (.+?) issued to (.+)/)
    const invoiceNumber = descMatch?.[1] ?? path.split('/').pop() ?? 'Unknown'
    const companyName = descMatch?.[2] ?? 'Unknown'

    unpaidInvoices.push({
      invoicePath: path,
      invoiceNumber,
      companyName,
      amount,
      issueDate,
      daysOutstanding,
      agingBucket,
    })
  }

  // Sort by days outstanding (oldest first)
  unpaidInvoices.sort((a, b) => b.daysOutstanding - a.daysOutstanding)

  const totalAR = unpaidInvoices.reduce((sum, i) => sum + i.amount, 0)

  return {
    asOf: reportDate,
    entries: unpaidInvoices,
    totalAR,
    buckets,
  }
}
