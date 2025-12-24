/**
 * Bank Account Utilities
 * Parse bank account IDs and provide display formatting
 */

// Bank name abbreviations (4+ character names get abbreviated)
export const BANK_ABBREVIATIONS: Record<string, string> = {
  OCBC: 'OCBC',
  DBS: 'DBS',
  DSB: 'DSB', // Dah Sing Bank
  FBO: 'FBO', // Fubon Bank
  HSBC: 'HSBC',
  BOC: 'BOC', // Bank of China
  SCB: 'SCB', // Standard Chartered
  CITI: 'CITI',
  HASE: 'HASE', // Hang Seng
}

// Full bank names for display
export const BANK_FULL_NAMES: Record<string, string> = {
  OCBC: 'OCBC Bank',
  DBS: 'DBS Bank',
  DSB: 'Dah Sing Bank',
  FBO: 'Fubon Bank',
  HSBC: 'HSBC',
  BOC: 'Bank of China',
  SCB: 'Standard Chartered',
  CITI: 'Citibank',
  HASE: 'Hang Seng Bank',
}

// Account type labels
export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  S: 'Savings',
  C: 'Current',
  D: 'Deposit',
  F: 'Fixed',
}

// Account type colors for Ant Design tags
export const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  S: 'blue', // Savings
  C: 'green', // Current
  D: 'purple', // Deposit
  F: 'orange', // Fixed
}

// Payment method display labels
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Transfer',
  check: 'Cheque',
  cash: 'Cash',
  credit_card: 'Card',
  other: 'Other',
}

// Payment method detection from description
export const PAYMENT_METHOD_PATTERNS: Record<string, RegExp> = {
  fps: /\bFPS\b/i,
  visa: /\bVISA\b/i,
  mastercard: /\bMASTERCARD\b|\bMC\b/i,
  cheque: /\bCHEQUE\b|\bCHQ\b|\bCHECK\b/i,
  internet: /\bINTERNET\s*(BANKING|TRANSFER)?\b/i,
  mobile: /\bMOBILE\s*(TRANSFER|BANKING)?\b/i,
  atm: /\bATM\b|\bCASH\s*DEPOSIT\b/i,
}

export interface ParsedBankAccountId {
  subsidiary: string
  subsidiaryLower: string
  bank: string
  bankAbbr: string
  bankFullName: string
  accountType: string
  accountTypeLabel: string
  accountTypeColor: string
  raw: string
}

/**
 * Parse a bank account ID into its components
 * Format: {SUBSIDIARY}-{BANK}-{TYPE}
 * Example: "ERL-OCBC-S" -> { subsidiary: "ERL", bank: "OCBC", accountType: "S", ... }
 */
export function parseBankAccountId(bankAccountId: string): ParsedBankAccountId {
  const parts = bankAccountId?.split('-') || []
  const subsidiary = parts[0] || ''
  const bank = parts[1] || ''
  const accountType = parts[2] || ''

  return {
    subsidiary,
    subsidiaryLower: subsidiary.toLowerCase(),
    bank,
    bankAbbr: BANK_ABBREVIATIONS[bank] || bank,
    bankFullName: BANK_FULL_NAMES[bank] || bank,
    accountType,
    accountTypeLabel: ACCOUNT_TYPE_LABELS[accountType] || accountType,
    accountTypeColor: ACCOUNT_TYPE_COLORS[accountType] || 'default',
    raw: bankAccountId,
  }
}

/**
 * Extract subsidiary ID from bank account ID
 * Example: "ERL-OCBC-S" -> "erl"
 */
export function getSubsidiaryFromBankAccountId(bankAccountId: string): string {
  if (!bankAccountId) return ''
  const parts = bankAccountId.split('-')
  return parts[0]?.toLowerCase() || ''
}

/**
 * Get display-friendly payment method from transaction description
 */
export function getPaymentMethodDisplay(
  paymentMethod: string,
  description?: string
): string {
  // First check if we can get more specific from description
  if (description) {
    if (PAYMENT_METHOD_PATTERNS.fps.test(description)) return 'FPS'
    if (PAYMENT_METHOD_PATTERNS.visa.test(description)) return 'VISA'
    if (PAYMENT_METHOD_PATTERNS.mastercard.test(description)) return 'MC'
    if (PAYMENT_METHOD_PATTERNS.internet.test(description)) return 'Internet'
    if (PAYMENT_METHOD_PATTERNS.mobile.test(description)) return 'Mobile'
    if (PAYMENT_METHOD_PATTERNS.atm.test(description)) return 'ATM'
    if (PAYMENT_METHOD_PATTERNS.cheque.test(description)) return 'Cheque'
  }

  // Fall back to stored payment method
  return PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod || 'Other'
}

/**
 * Format currency with sign and color info
 */
export function formatAmountWithSign(
  amount: number,
  isDebit: boolean,
  currency = 'HKD'
): { display: string; color: string } {
  const sign = isDebit ? '-' : '+'
  const color = isDebit ? '#cf1322' : '#389e0d'
  const formatted = amount.toLocaleString('en-HK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  // Currency symbol mapping
  const symbols: Record<string, string> = {
    HKD: 'HK$',
    USD: 'US$',
    GBP: '£',
    EUR: '€',
    CNY: '¥',
  }
  const symbol = symbols[currency] || `${currency} `

  return {
    display: `${sign}${symbol}${formatted}`,
    color,
  }
}
