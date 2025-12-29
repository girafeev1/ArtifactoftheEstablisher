/**
 * Bank Account Utilities
 *
 * Parses bank account identifiers and provides display formatting.
 * Bank account ID format: {SUBSIDIARY}-{BANK}-{TYPE}
 * Example: "ERL-OCBC-S" -> { subsidiary: "erl", bank: "OCBC", type: "Savings" }
 */

// ============================================================================
// Types
// ============================================================================

export interface ParsedBankAccount {
  subsidiary: string
  bank: string
  bankAbbr: string
  bankFullName: string
  accountType: string
  accountTypeLabel: string
  original: string
}

// ============================================================================
// Bank Mappings
// ============================================================================

/**
 * Bank abbreviation to full name mapping
 * Note: Use actual full names as stored in Firestore
 * Display rule: 3 words or less = show full name, 4+ words = show abbreviation
 */
export const BANK_ABBREVIATIONS: Record<string, string> = {
  OCBC: 'Oversea-Chinese Banking Corporation',  // 4 words → shows "OCBC"
  DBS: 'DBS Bank',                              // 2 words → shows "DBS Bank"
  DSB: 'Dah Sing Bank',                         // 3 words → shows "Dah Sing Bank"
  FBO: 'Fubon Bank',                            // 2 words → shows "Fubon Bank"
  HSBC: 'HSBC',                                 // 1 word → shows "HSBC"
  SCB: 'Standard Chartered Bank',               // 3 words → shows "Standard Chartered Bank"
  BOC: 'Bank of China',                         // 3 words → shows "Bank of China"
  ICBC: 'ICBC',                                 // 1 word → shows "ICBC"
  CMB: 'China Merchants Bank',                  // 3 words → shows "China Merchants Bank"
  BEA: 'Bank of East Asia',                     // 4 words → shows "BEA"
  AWX: 'Airwallex',                             // 1 word → shows "Airwallex"
}

/**
 * Account type abbreviation to full name mapping
 */
export const ACCOUNT_TYPES: Record<string, string> = {
  S: 'Savings',
  C: 'Current',
  D: 'Deposit',
  F: 'Fixed Deposit',
}

/**
 * Account type colors for UI display (Ant Design compatible)
 */
export const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  S: 'blue',
  C: 'green',
  D: 'purple',
  F: 'orange',
}

/**
 * Subsidiary display names
 */
export const SUBSIDIARY_NAMES: Record<string, string> = {
  erl: 'Establisher Resources Limited',
  ehl: 'Establisher Holdings Limited',
}

/**
 * Subsidiary short names for tags
 */
export const SUBSIDIARY_SHORT_NAMES: Record<string, string> = {
  erl: 'ERL',
  ehl: 'EHL',
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse a bank account identifier string
 *
 * @param bankAccountId - The bank account ID (e.g., "ERL-OCBC-S")
 * @returns Parsed bank account object (never null - uses defaults for invalid input)
 */
export function parseBankAccountId(bankAccountId: string): ParsedBankAccount {
  if (!bankAccountId) {
    return {
      subsidiary: '',
      bank: '',
      bankAbbr: '',
      bankFullName: '',
      accountType: '',
      accountTypeLabel: '',
      original: bankAccountId || '',
    }
  }

  const parts = bankAccountId.split('-')
  const subsidiary = parts[0]?.toLowerCase() || ''
  const bank = parts[1] || ''
  const accountType = parts[2] || 'S' // Default to Savings if not specified

  const fullName = BANK_ABBREVIATIONS[bank] || bank
  // Display rule: 3 words or less = show full name, 4+ words = show abbreviation
  const wordCount = fullName.split(/\s+/).length
  const displayAbbr = wordCount >= 4 ? bank : fullName

  return {
    subsidiary,
    bank,
    bankAbbr: displayAbbr,
    bankFullName: fullName,
    accountType,
    accountTypeLabel: ACCOUNT_TYPES[accountType] || accountType,
    original: bankAccountId,
  }
}

/**
 * Get display name for a bank abbreviation
 */
export function getBankDisplayName(abbreviation: string): string {
  return BANK_ABBREVIATIONS[abbreviation] || abbreviation
}

/**
 * Get full name for account type abbreviation
 */
export function getAccountTypeName(abbreviation: string): string {
  return ACCOUNT_TYPES[abbreviation] || abbreviation
}

/**
 * Get color for account type (Ant Design Tag color)
 */
export function getAccountTypeColor(type: string): string {
  return ACCOUNT_TYPE_COLORS[type] || 'default'
}

/**
 * Format bank account for display
 * Shows just the bank abbreviation
 */
export function formatBankShort(bankAccountId: string): string {
  const parsed = parseBankAccountId(bankAccountId)
  if (!parsed.bank) return bankAccountId

  return parsed.bankAbbr
}

/**
 * Format bank account with type
 * Shows "OCBC Savings" style
 */
export function formatBankWithType(bankAccountId: string): string {
  const parsed = parseBankAccountId(bankAccountId)
  if (!parsed.bank) return bankAccountId

  return `${parsed.bankAbbr} ${parsed.accountTypeLabel}`
}

/**
 * Format bank account full
 * Shows "ERL - OCBC Bank (Savings)"
 */
export function formatBankFull(bankAccountId: string): string {
  const parsed = parseBankAccountId(bankAccountId)
  if (!parsed.bank) return bankAccountId

  const subsidiaryName = parsed.subsidiary.toUpperCase()
  return `${subsidiaryName} - ${parsed.bankFullName} (${parsed.accountTypeLabel})`
}

/**
 * Extract subsidiary from bank account ID
 */
export function extractSubsidiary(bankAccountId: string): string | null {
  const parsed = parseBankAccountId(bankAccountId)
  return parsed?.subsidiary || null
}

/**
 * Get subsidiary short name (ERL, EHL)
 */
export function getSubsidiaryShortName(subsidiaryId: string): string {
  return SUBSIDIARY_SHORT_NAMES[subsidiaryId.toLowerCase()] || subsidiaryId.toUpperCase()
}

/**
 * Get subsidiary full name
 */
export function getSubsidiaryFullName(subsidiaryId: string): string {
  return SUBSIDIARY_NAMES[subsidiaryId.toLowerCase()] || subsidiaryId
}

/**
 * Get all unique banks from a list of transactions
 */
export function getUniqueBanks(bankAccountIds: string[]): string[] {
  const banks = new Set<string>()
  for (const id of bankAccountIds) {
    const parsed = parseBankAccountId(id)
    if (parsed) {
      banks.add(parsed.bank)
    }
  }
  return Array.from(banks).sort()
}

/**
 * Group bank account IDs by subsidiary
 */
export function groupBySubsidiary(bankAccountIds: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {}

  for (const id of bankAccountIds) {
    const parsed = parseBankAccountId(id)
    if (parsed) {
      if (!groups[parsed.subsidiary]) {
        groups[parsed.subsidiary] = []
      }
      groups[parsed.subsidiary].push(id)
    }
  }

  return groups
}

/**
 * Format payment method for display
 */
export function formatPaymentMethod(method: string): string {
  const methodMap: Record<string, string> = {
    bank_transfer: 'Transfer',
    check: 'Cheque',
    cash: 'Cash',
    credit_card: 'Card',
    other: 'Other',
  }
  return methodMap[method] || method
}

/**
 * Get payment method icon name (for Ant Design icons)
 */
export function getPaymentMethodIcon(method: string): string {
  const iconMap: Record<string, string> = {
    bank_transfer: 'SwapOutlined',
    check: 'FileTextOutlined',
    cash: 'DollarOutlined',
    credit_card: 'CreditCardOutlined',
    other: 'QuestionOutlined',
  }
  return iconMap[method] || 'QuestionOutlined'
}

/**
 * Get payment method display text with smart detection from description
 * Enhanced detection for VISA, FPS, KPAY, etc.
 */
export function getPaymentMethodDisplay(method: string, description?: string): string {
  // First check description for specific payment types
  // Order matters: more specific types should be checked first
  if (description) {
    const desc = description.toUpperCase()
    // Interest must be checked early - bank interest descriptions may contain product names like "PAYME"
    if (desc.includes('INTEREST')) return 'Interest'
    if (desc.includes('VISA') || desc.includes('MASTERCARD')) return 'VISA'
    if (desc.includes('FPS')) return 'FPS'
    if (desc.includes('KPAY') || desc.includes('K PAY')) return 'KPAY'
    if (desc.includes('PAYME')) return 'PayMe'
    if (desc.includes('CHEQUE') || desc.includes('CHQ')) return 'Cheque'
    if (desc.includes('ATM') || desc.includes('CASH DEPOSIT')) return 'Cash'
    if (desc.includes('HMIT') || desc.includes('TRF') || desc.includes('TRANSFER')) return 'Transfer'
  }

  // Fall back to method-based display
  return formatPaymentMethod(method)
}

/**
 * Format amount with sign for display
 * Returns display string and color based on debit/credit
 */
export function formatAmountWithSign(
  amount: number,
  isDebit: boolean,
  currency: string = 'HKD'
): { display: string; color: string } {
  const formatter = new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  })

  const formatted = formatter.format(amount)
  const sign = isDebit ? '-' : '+'
  const color = isDebit ? '#cf1322' : '#389e0d'

  return {
    display: `${sign}${formatted}`,
    color,
  }
}
