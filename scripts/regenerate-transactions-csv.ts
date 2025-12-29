/**
 * Regenerate Transactions CSV
 *
 * Reads raw bank statement CSVs and generates a consolidated CSV with:
 * - Method column (extracted from descriptions)
 * - Original Description (preserved)
 * - DisplayName (cleaned merchant/payee name)
 * - Proper Balance per bank account
 *
 * Usage: npx tsx scripts/regenerate-transactions-csv.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Types
// ============================================================================

interface RawTransaction {
  date: string
  description: string
  amount: number
  type: 'Credit' | 'Debit'
  balance: number
  reference: string
  bankAccount: string
}

interface ProcessedTransaction {
  date: string
  description: string
  displayName: string
  amount: number
  type: 'Credit' | 'Debit'
  method: string
  balance: number
  reference: string
  bankAccount: string
}

// ============================================================================
// Method Detection
// ============================================================================

function detectMethod(description: string): string {
  const desc = description.toUpperCase()

  // VISA card payments
  if (desc.includes('VISA')) {
    return 'VISA'
  }

  // FPS (Faster Payment System)
  if (desc.includes('FPS')) {
    return 'FPS'
  }

  // Mobile Transfer (including HMIT - HSBC Mobile Internet Transfer)
  if (desc.includes('MOBILE TRANSFER') || desc.includes('HMIT')) {
    return 'Mobile Transfer'
  }

  // Internet Transfer
  if (desc.includes('INTERNET TRANSFER') || desc.includes('INTERNETBANK')) {
    return 'Internet Transfer'
  }

  // Cheque
  if (desc.includes('CHEQUE') || desc.includes('CHQ') || desc.includes('CHECK')) {
    return 'Cheque'
  }

  // Cash
  if (desc.includes('CASH') || desc.includes('ATM')) {
    return 'Cash'
  }

  // Interest
  if (desc.includes('INTEREST')) {
    return 'Interest'
  }

  // Default: categorize remaining TRANSFER as Internet Transfer
  if (desc.includes('TRANSFER')) {
    return 'Internet Transfer'
  }

  // Fallback
  return 'Other'
}

// ============================================================================
// Display Name Extraction
// ============================================================================

function extractDisplayName(description: string, type: 'Credit' | 'Debit'): string {
  const desc = description.trim()

  // FPS patterns: "FPS TRANSFER DEPOSIT" → "FPS Deposit" or "FPS CREDIT - TACK TACK LIMITED" → "TACK TACK LIMITED"
  const fpsMatch = desc.match(/FPS\s+(?:CREDIT|TRANSFER\s+DEPOSIT)\s*[-–]?\s*(.+)?/i)
  if (fpsMatch && fpsMatch[1]) {
    return fpsMatch[1].trim()
  }
  if (desc.toUpperCase().includes('FPS TRANSFER DEPOSIT')) {
    return 'FPS Deposit'
  }

  // VISA patterns: "VISA DEBIT - GOOGLE GSUITE THEE" → "GOOGLE GSUITE THEE"
  const visaMatch = desc.match(/VISA\s+DEBIT\s*[-–]\s*(.+)/i)
  if (visaMatch) {
    return visaMatch[1].trim()
  }

  // Transfer patterns: "TRANSFER CREDIT - INTERNETBANK" → "Internet Transfer"
  if (desc.toUpperCase().includes('TRANSFER') && desc.toUpperCase().includes('INTERNETBANK')) {
    return type === 'Credit' ? 'Transfer In' : 'Transfer Out'
  }

  // HMIT transfers: "TRANSFER DEBIT - HMIT250605067811" → "Mobile Transfer"
  if (desc.match(/HMIT\d+/i)) {
    return type === 'Credit' ? 'Mobile Transfer In' : 'Mobile Transfer Out'
  }

  // Internet Transfer: "INTERNET TRANSFER W/D" or "INTERNET TRANSFER DEPOSIT"
  if (desc.toUpperCase().includes('INTERNET TRANSFER')) {
    if (desc.toUpperCase().includes('W/D')) {
      return 'Internet Transfer Out'
    }
    if (desc.toUpperCase().includes('DEPOSIT')) {
      return 'Internet Transfer In'
    }
    return 'Internet Transfer'
  }

  // Mobile Transfer: "MOBILE TRANSFER W/D"
  if (desc.toUpperCase().includes('MOBILE TRANSFER')) {
    if (desc.toUpperCase().includes('W/D')) {
      return 'Mobile Transfer Out'
    }
    return 'Mobile Transfer'
  }

  // Cheque: "CHEQUE DEPOSIT - CHQ NO.000098" → "Cheque #000098"
  const chequeMatch = desc.match(/CHEQUE\s+DEPOSIT\s*[-–]?\s*(?:CHQ\s+NO\.?)?(\d+)?/i)
  if (chequeMatch) {
    return chequeMatch[1] ? `Cheque #${chequeMatch[1]}` : 'Cheque Deposit'
  }
  if (desc.toUpperCase().includes('CHEQUE DEPOSIT')) {
    return 'Cheque Deposit'
  }

  // Cash: "CASH DEPOSIT" or "CASH DEPOSIT - ATM 9301"
  if (desc.toUpperCase().includes('CASH DEPOSIT')) {
    const atmMatch = desc.match(/ATM\s+(\d+)/i)
    return atmMatch ? `Cash Deposit (ATM ${atmMatch[1]})` : 'Cash Deposit'
  }

  // Interest
  if (desc.toUpperCase().includes('INTEREST')) {
    return 'Interest Payment'
  }

  // CO SEARCH FEE and similar
  if (desc.toUpperCase().includes('CO SEARCH FEE')) {
    return 'Company Search Fee'
  }

  // Default: clean up the description
  return desc
    .replace(/^TRANSFER\s+(CREDIT|DEBIT)\s*[-–]?\s*/i, '')
    .replace(/^VISA\s+DEBIT\s*[-–]?\s*/i, '')
    .trim() || desc
}

// ============================================================================
// CSV Parsing
// ============================================================================

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
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

function parseCSVFile(filePath: string): RawTransaction[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split(/\r?\n/).filter(line => line.trim())
  const transactions: RawTransaction[] = []

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const columns = parseCSVLine(lines[i])
    if (columns.length < 7) continue

    const [date, description, amountStr, type, balanceStr, reference, bankAccount] = columns

    if (!date || !description) continue

    transactions.push({
      date,
      description,
      amount: parseFloat(amountStr) || 0,
      type: type as 'Credit' | 'Debit',
      balance: parseFloat(balanceStr) || 0,
      reference: reference || '',
      bankAccount: bankAccount || ''
    })
  }

  return transactions
}

// ============================================================================
// Date Parsing and Sorting
// ============================================================================

function parseDate(dateStr: string): Date {
  // Expected format: DD/MM/YYYY
  const parts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (parts) {
    const [, day, month, year] = parts
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }
  return new Date(dateStr)
}

// ============================================================================
// Main Processing
// ============================================================================

function processTransactions(rawTransactions: RawTransaction[]): ProcessedTransaction[] {
  return rawTransactions.map(tx => ({
    date: tx.date,
    description: tx.description,
    displayName: extractDisplayName(tx.description, tx.type),
    amount: tx.amount,
    type: tx.type,
    method: detectMethod(tx.description),
    balance: tx.balance,
    reference: tx.reference,
    bankAccount: tx.bankAccount
  }))
}

function recalculateBalances(transactions: ProcessedTransaction[]): ProcessedTransaction[] {
  // Group by bank account
  const byBank: Record<string, ProcessedTransaction[]> = {}

  for (const tx of transactions) {
    if (!byBank[tx.bankAccount]) {
      byBank[tx.bankAccount] = []
    }
    byBank[tx.bankAccount].push(tx)
  }

  // Sort each bank's transactions by date and recalculate balance
  for (const bankAccount of Object.keys(byBank)) {
    const bankTxs = byBank[bankAccount]

    // Sort by date
    bankTxs.sort((a, b) => {
      const dateA = parseDate(a.date)
      const dateB = parseDate(b.date)
      return dateA.getTime() - dateB.getTime()
    })

    // Use the balances from the raw data (they're already calculated correctly)
    // Just ensure ordering is correct
  }

  // Flatten back and sort globally by date, then by bank account
  const all = Object.values(byBank).flat()
  all.sort((a, b) => {
    const dateA = parseDate(a.date)
    const dateB = parseDate(b.date)
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime()
    }
    return a.bankAccount.localeCompare(b.bankAccount)
  })

  return all
}

function generateCSV(transactions: ProcessedTransaction[]): string {
  const header = 'Date,Description,DisplayName,Amount,Type,Method,Balance,Reference,BankAccount'

  const rows = transactions.map(tx => {
    const escapeCsv = (val: string | number) => {
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    return [
      tx.date,
      escapeCsv(tx.description),
      escapeCsv(tx.displayName),
      tx.amount.toFixed(2),
      tx.type,
      tx.method,
      tx.balance.toFixed(2),
      tx.reference,
      tx.bankAccount
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const importsDir = path.join(process.cwd(), 'data', 'imports')

  console.log('Reading raw CSV files...')

  // Read all raw CSV files
  const rawFiles = [
    'DahSing_Savings.csv',
    'OCBC_Statement_Savings.csv',
    'OCBC_Current.csv'
  ]

  const allTransactions: RawTransaction[] = []

  for (const filename of rawFiles) {
    const filePath = path.join(importsDir, filename)
    if (fs.existsSync(filePath)) {
      console.log(`  Reading ${filename}...`)
      const transactions = parseCSVFile(filePath)
      console.log(`    Found ${transactions.length} transactions`)
      allTransactions.push(...transactions)
    } else {
      console.log(`  [SKIP] ${filename} not found`)
    }
  }

  console.log(`\nTotal raw transactions: ${allTransactions.length}`)

  // Process transactions
  console.log('\nProcessing transactions...')
  const processed = processTransactions(allTransactions)

  // Recalculate balances and sort
  console.log('Sorting and organizing...')
  const final = recalculateBalances(processed)

  // Generate CSV
  console.log('Generating CSV...')
  const csv = generateCSV(final)

  // Write output
  const outputPath = path.join(importsDir, 'transactions_converted.csv')
  fs.writeFileSync(outputPath, csv, 'utf-8')

  console.log(`\nOutput written to: ${outputPath}`)
  console.log(`Total transactions: ${final.length}`)

  // Print method summary
  const methodCounts: Record<string, number> = {}
  for (const tx of final) {
    methodCounts[tx.method] = (methodCounts[tx.method] || 0) + 1
  }
  console.log('\nMethod breakdown:')
  for (const [method, count] of Object.entries(methodCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${method}: ${count}`)
  }
}

main().catch(console.error)
