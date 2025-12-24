/**
 * CSV Parser for Bank Statements
 *
 * Parses bank statement CSV files and converts them to BankTransactionInput objects.
 * Supports multiple bank formats with configurable column mappings.
 */

import type { BankTransactionInput, PaymentMethod, TransactionSource } from './types'

// ============================================================================
// Types
// ============================================================================

export interface CSVParseOptions {
  /** The bank account ID this statement is for */
  bankAccountId: string
  /** The subsidiary ID (e.g., "erl") */
  subsidiaryId: string
  /** Default currency if not in CSV */
  defaultCurrency?: string
  /** Default payment method if not determinable */
  defaultPaymentMethod?: PaymentMethod
  /** Whether to skip the header row (default: true) */
  skipHeader?: boolean
  /** Column mapping preset */
  preset?: BankPreset
  /** Custom column mapping (overrides preset) */
  columnMapping?: ColumnMapping
  /** Date format used in the CSV (default: 'DD/MM/YYYY') */
  dateFormat?: string
}

export interface ColumnMapping {
  date: number | string
  description?: number | string
  debit?: number | string
  credit?: number | string
  amount?: number | string // Use if single amount column (positive = credit, negative = debit)
  type?: number | string   // "Credit" or "Debit" column (used with amount column)
  reference?: number | string
  balance?: number | string
  bankAccount?: number | string // Bank account identifier column (e.g., "ERL-OCBC-S")
}

export type BankPreset = 'dbs' | 'ocbc' | 'fubon' | 'generic'

export interface ParsedRow {
  transactionDate: Date
  amount: number
  description: string
  reference?: string
  balance?: number
  bankAccountId?: string // Bank account identifier from CSV
}

export interface ParseResult {
  success: boolean
  transactions: BankTransactionInput[]
  errors: ParseError[]
  skipped: number
  total: number
}

export interface ParseError {
  row: number
  message: string
  rawData?: string
}

// ============================================================================
// Bank Presets
// ============================================================================

const BANK_PRESETS: Record<BankPreset, ColumnMapping> = {
  dbs: {
    date: 0,
    description: 1,
    debit: 2,
    credit: 3,
    balance: 4,
    reference: 5,
  },
  ocbc: {
    date: 0,
    description: 1,
    debit: 2,
    credit: 3,
    balance: 4,
  },
  fubon: {
    date: 0,
    description: 1,
    amount: 2, // Positive = credit, negative = debit
    balance: 3,
    reference: 4,
  },
  generic: {
    date: 0,
    description: 1,
    amount: 2,
    type: 3,    // "Credit" or "Debit"
    balance: 4,
    reference: 5,
    bankAccount: 6, // Bank account identifier (e.g., "ERL-OCBC-S")
  },
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse a CSV string into bank transactions.
 */
export function parseCSV(csvContent: string, options: CSVParseOptions): ParseResult {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  const errors: ParseError[] = []
  const transactions: BankTransactionInput[] = []
  let skipped = 0

  // Get column mapping
  const mapping = options.columnMapping || BANK_PRESETS[options.preset || 'generic']

  // Skip header if needed
  const startRow = options.skipHeader !== false ? 1 : 0

  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i]
    const rowNum = i + 1

    try {
      const columns = parseCSVLine(line)

      if (columns.length === 0) {
        skipped++
        continue
      }

      const parsed = parseRow(columns, mapping, options, rowNum)

      if (!parsed) {
        skipped++
        continue
      }

      // Store absolute amount - debits are negative in parsed.amount
      const isDebit = parsed.amount < 0

      const transaction: BankTransactionInput = {
        transactionDate: parsed.transactionDate,
        amount: Math.abs(parsed.amount),
        isDebit,
        currency: options.defaultCurrency || 'HKD',
        bankAccountId: parsed.bankAccountId || options.bankAccountId,
        paymentMethod: inferPaymentMethod(parsed.description, options.defaultPaymentMethod),
        referenceNumber: parsed.reference,
        payerName: extractPayerName(parsed.description),
        payerReference: parsed.reference,
        subsidiaryId: options.subsidiaryId,
        memo: parsed.description,
        source: 'csv_import' as TransactionSource,
      }

      transactions.push(transaction)
    } catch (error) {
      errors.push({
        row: rowNum,
        message: error instanceof Error ? error.message : 'Unknown parsing error',
        rawData: line,
      })
    }
  }

  return {
    success: errors.length === 0,
    transactions,
    errors,
    skipped,
    total: lines.length - (options.skipHeader !== false ? 1 : 0),
  }
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

/**
 * Parse a single row using the column mapping.
 */
function parseRow(
  columns: string[],
  mapping: ColumnMapping,
  options: CSVParseOptions,
  rowNum: number
): ParsedRow | null {
  const getColumn = (index: number | string | undefined): string => {
    if (index === undefined) return ''
    if (typeof index === 'string') {
      // Named column (not implemented yet, would require header parsing)
      return ''
    }
    return columns[index] || ''
  }

  // Parse date
  const dateStr = getColumn(mapping.date)
  if (!dateStr) {
    return null // Skip rows without date
  }

  const transactionDate = parseDate(dateStr, options.dateFormat)
  if (!transactionDate) {
    throw new Error(`Invalid date format: "${dateStr}"`)
  }

  // Parse amount
  let amount = 0

  if (mapping.amount !== undefined) {
    // Single amount column with optional type column
    const amountStr = getColumn(mapping.amount)
    const amountValue = parseAmount(amountStr)

    if (mapping.type !== undefined) {
      // Type column specifies Credit or Debit
      const typeStr = getColumn(mapping.type).toLowerCase()
      if (typeStr === 'credit' || typeStr === 'cr') {
        amount = amountValue  // Credit = positive (incoming)
      } else if (typeStr === 'debit' || typeStr === 'dr') {
        amount = -amountValue // Debit = negative (outgoing)
      } else {
        // Unknown type, treat as credit if positive
        amount = amountValue
      }
    } else {
      // No type column, assume positive = credit
      amount = amountValue
    }
  } else {
    // Separate debit/credit columns
    const debitStr = getColumn(mapping.debit)
    const creditStr = getColumn(mapping.credit)
    const debit = parseAmount(debitStr)
    const credit = parseAmount(creditStr)

    // We only care about credits (incoming money)
    amount = credit - debit
  }

  // Parse description
  const description = getColumn(mapping.description) || ''

  // Parse reference
  const reference = getColumn(mapping.reference) || undefined

  // Parse balance (optional, for validation)
  const balanceStr = getColumn(mapping.balance)
  const balance = balanceStr ? parseAmount(balanceStr) : undefined

  // Parse bank account identifier (optional, for Claude Import format)
  const bankAccountId = getColumn(mapping.bankAccount) || undefined

  return {
    transactionDate,
    amount,
    description,
    reference,
    balance,
    bankAccountId,
  }
}

/**
 * Month name to number mapping
 */
const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

/**
 * Parse a date string in various formats.
 */
function parseDate(dateStr: string, format?: string): Date | null {
  // Try DD-MMM-YYYY format (e.g., 14-Nov-2024)
  const ddmmmyyyy = dateStr.match(/^(\d{1,2})[\/\-]([A-Za-z]+)[\/\-](\d{4})$/)
  if (ddmmmyyyy) {
    const [, day, monthStr, year] = ddmmmyyyy
    const month = MONTH_NAMES[monthStr.toLowerCase()]
    if (month !== undefined) {
      return new Date(parseInt(year), month, parseInt(day))
    }
  }

  // Try DD/MM/YYYY format (most common for HK banks)
  const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // Try YYYY-MM-DD format
  const yyyymmdd = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // Try MM/DD/YYYY format (US)
  const mmddyyyy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (mmddyyyy && format === 'MM/DD/YYYY') {
    const [, month, day, year] = mmddyyyy
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // Try JavaScript Date constructor as fallback
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime())) {
    return parsed
  }

  return null
}

/**
 * Parse an amount string, handling various formats.
 */
function parseAmount(amountStr: string): number {
  if (!amountStr || amountStr.trim() === '') {
    return 0
  }

  // Remove currency symbols and thousands separators
  let cleaned = amountStr
    .replace(/[$£€¥HK$]/g, '')
    .replace(/,/g, '')
    .trim()

  // Handle parentheses for negative numbers
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }

  const amount = parseFloat(cleaned)
  return isNaN(amount) ? 0 : amount
}

/**
 * Infer payment method from transaction description.
 * Auto-detects based on common banking keywords.
 */
function inferPaymentMethod(description: string, defaultMethod?: PaymentMethod): PaymentMethod {
  const desc = description.toUpperCase()

  // Check for cheque/check
  if (desc.includes('CHEQUE') || desc.includes('CHQ') || desc.includes('CHECK')) {
    return 'check'
  }

  // Check for cash
  if (desc.includes('CASH') || desc.includes('ATM')) {
    return 'cash'
  }

  // Check for card payments
  if (desc.includes('VISA') || desc.includes('MASTERCARD') || desc.includes('CARD') ||
      desc.includes('KPAY') || desc.includes('PAYME')) {
    return 'credit_card'
  }

  // Check for bank transfers (FPS, TT, TRF, etc.)
  if (desc.includes('FPS') || desc.includes('TRANSFER') || desc.includes('TRF') ||
      desc.includes('TT ') || desc.includes('HMIT') || desc.includes('INTERNETBANK') ||
      desc.includes('MOBILE') || desc.includes('INTERNET') || desc.includes('DIRECT CREDIT')) {
    return 'bank_transfer'
  }

  // Check for interest (bank credit)
  if (desc.includes('INTEREST')) {
    return 'bank_transfer'
  }

  // Default
  return defaultMethod || 'bank_transfer'
}

/**
 * Extract payer name from transaction description.
 * This is a heuristic - may need adjustment based on actual bank formats.
 */
function extractPayerName(description: string): string {
  // Common patterns in HK bank statements
  // "TRF FROM COMPANY NAME" -> "COMPANY NAME"
  // "INWARD TT FROM ABC LIMITED" -> "ABC LIMITED"
  // "CHQ DEP ABC COMPANY" -> "ABC COMPANY"

  const patterns = [
    /^TRF\s+FROM\s+(.+)$/i,
    /^INWARD\s+TT\s+FROM\s+(.+)$/i,
    /^TRANSFER\s+FROM\s+(.+)$/i,
    /^CHQ\s+DEP\s+(.+)$/i,
    /^CHEQUE\s+DEPOSIT\s+(.+)$/i,
    /^DEPOSIT\s+FROM\s+(.+)$/i,
    /^PAYMENT\s+FROM\s+(.+)$/i,
    /^FROM\s+(.+)$/i,
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  // If no pattern matched, return the full description as payer name
  // User can edit this later
  return description.substring(0, 100) // Limit length
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a CSV content before parsing.
 */
export function validateCSV(csvContent: string): {
  valid: boolean
  errors: string[]
  rowCount: number
  columnCount: number
} {
  const errors: string[] = []

  if (!csvContent || csvContent.trim().length === 0) {
    return { valid: false, errors: ['CSV content is empty'], rowCount: 0, columnCount: 0 }
  }

  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())

  if (lines.length < 2) {
    errors.push('CSV must have at least a header row and one data row')
  }

  // Check first line for columns
  const firstLine = parseCSVLine(lines[0])
  const columnCount = firstLine.length

  if (columnCount < 3) {
    errors.push('CSV must have at least 3 columns (date, description, amount)')
  }

  // Check for consistent column count
  for (let i = 1; i < Math.min(lines.length, 10); i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length !== columnCount && cols.length > 0) {
      errors.push(`Row ${i + 1} has ${cols.length} columns, expected ${columnCount}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    rowCount: lines.length - 1, // Excluding header
    columnCount,
  }
}

/**
 * Get column headers from CSV for mapping UI.
 */
export function getCSVHeaders(csvContent: string): string[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  return parseCSVLine(lines[0])
}

/**
 * Get a preview of the first N rows of parsed data.
 */
export function getCSVPreview(
  csvContent: string,
  options: CSVParseOptions,
  maxRows: number = 5
): {
  headers: string[]
  rows: string[][]
  parsed: ParsedRow[]
} {
  const headers = getCSVHeaders(csvContent)
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  const rows: string[][] = []
  const parsed: ParsedRow[] = []

  const mapping = options.columnMapping || BANK_PRESETS[options.preset || 'generic']
  const startRow = options.skipHeader !== false ? 1 : 0

  for (let i = startRow; i < Math.min(lines.length, startRow + maxRows); i++) {
    const columns = parseCSVLine(lines[i])
    rows.push(columns)

    try {
      const parsedRow = parseRow(columns, mapping, options, i + 1)
      if (parsedRow) {
        parsed.push(parsedRow)
      }
    } catch {
      // Ignore parse errors in preview
    }
  }

  return { headers, rows, parsed }
}
