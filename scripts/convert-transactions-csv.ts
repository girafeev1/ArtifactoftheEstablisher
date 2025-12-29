/**
 * Convert Transactions CSV
 *
 * Reads existing transaction CSV files and converts them to the new format
 * with structured columns for import.
 *
 * Run with: npx tsx scripts/convert-transactions-csv.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import Papa from 'papaparse'

// ============================================================================
// Types
// ============================================================================

interface RawTransaction {
  Date: string
  Description: string
  Amount: string
  Type: string
  Balance: string
  Reference: string
  BankAccount: string
}

// Format expected by web app's generic CSV parser
interface ConvertedTransaction {
  Date: string           // DD/MM/YYYY format
  Description: string    // Transaction description (use displayName)
  Amount: string         // Numeric amount
  Type: string           // "Credit" or "Debit"
  Balance: string        // Balance (can be empty)
  Reference: string      // Reference number
  BankAccount: string    // e.g., "ERL-OCBC-S"
}

// ============================================================================
// Bank Account Parsing
// ============================================================================

const BANK_ABBREVIATIONS: Record<string, string> = {
  'OCBC': 'OCBC',
  'DBS': 'DBS',
  'DSB': 'Dah Sing',
  'FBO': 'Fubon',
  'HSBC': 'HSBC',
  'BOC': 'BOC',
  'SCB': 'SCB',
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  'S': 'Savings',
  'C': 'Current',
  'D': 'Deposit',
}

function parseBankAccountId(bankAccountId: string): {
  subsidiary: string
  bank: string
  accountType: string
} {
  const parts = bankAccountId?.split('-') || []
  return {
    subsidiary: parts[0]?.toLowerCase() || '',
    bank: BANK_ABBREVIATIONS[parts[1]] || parts[1] || '',
    accountType: ACCOUNT_TYPE_LABELS[parts[2]] || parts[2] || '',
  }
}

// ============================================================================
// Payment Method Detection
// ============================================================================

function detectPaymentMethod(description: string): string {
  const desc = description.toUpperCase()

  if (desc.includes('VISA')) return 'VISA'
  if (desc.includes('MASTERCARD') || desc.includes('MC ')) return 'Mastercard'
  if (desc.includes('FPS')) return 'FPS'
  if (desc.includes('CHEQUE') || desc.includes('CHQ')) return 'Cheque'
  if (desc.includes('CASH DEPOSIT') || desc.includes('CASH W/D') || desc.includes('ATM')) return 'Cash'
  if (desc.includes('TRANSFER') || desc.includes('INTERNET')) return 'Transfer'
  if (desc.includes('INTEREST')) return 'Interest'

  return 'Other'
}

// ============================================================================
// Payer/Payee Name Extraction
// ============================================================================

function extractPayerName(description: string): string {
  const desc = description.toUpperCase()

  // Remove common prefixes to get the actual name
  const prefixes = [
    'VISA DEBIT - ',
    'FPS CREDIT - ',
    'FPS TRANSFER DEPOSIT',
    'TRANSFER CREDIT - INTERNETBANK',
    'TRANSFER CREDIT - ',
    'TRANSFER DEBIT - ',
    'CHEQUE DEPOSIT - CQM QDP',
    'CHEQUE DEPOSIT - CHQ NO.',
    'CHEQUE DEPOSIT',
    'CASH DEPOSIT - ',
    'CASH DEPOSIT',
    'INTEREST PAYMENT',
    'INTEREST DEPOSIT',
    'INTERNET TRANSFER W/D',
    'INTERNET TRANSFER DEPOSIT',
    'MOBILE TRANSFER W/D',
    'MISC DEBIT',
  ]

  let name = description
  for (const prefix of prefixes) {
    if (desc.startsWith(prefix)) {
      name = description.substring(prefix.length).trim()
      break
    }
  }

  // If name starts with a reference number pattern, try to extract actual name
  if (/^[A-Z0-9]{8,}$/.test(name)) {
    return '' // Just a reference number, no name
  }

  // Clean up name
  name = name.replace(/^-\s*/, '').trim()

  return name
}

// ============================================================================
// Generate Display Name
// ============================================================================

function generateDisplayName(description: string, payerName: string, paymentMethod: string): string {
  // If we have a payer name, use it
  if (payerName && payerName.length > 2) {
    return payerName
  }

  // Generate a friendly name based on the description
  const desc = description.toUpperCase()

  if (desc.includes('GOOGLE GSUITE')) return 'Google Workspace'
  if (desc.includes('GOOGLE CLOUD')) return 'Google Cloud'
  if (desc.includes('7-ELEVEN')) return '7-Eleven'
  if (desc.includes('INTEREST')) return 'Interest Payment'
  if (desc.includes('MISC DEBIT')) return 'Bank Fee'
  if (desc.includes('CHEQUE DEPOSIT')) return 'Cheque Deposit'
  if (desc.includes('CASH DEPOSIT')) return 'Cash Deposit'
  if (desc.includes('TRANSFER CREDIT') || desc.includes('TRANSFER DEPOSIT')) return 'Transfer In'
  if (desc.includes('TRANSFER DEBIT') || desc.includes('TRANSFER W/D')) return 'Transfer Out'

  // Return original description as fallback
  return description
}

// ============================================================================
// Convert Date Format
// ============================================================================

function convertDate(dateStr: string): string {
  // Input format: DD/MM/YYYY
  // Output format: YYYY-MM-DD
  const parts = dateStr.split('/')
  if (parts.length !== 3) return dateStr

  const [day, month, year] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// ============================================================================
// Main Conversion
// ============================================================================

function convertTransaction(raw: RawTransaction): ConvertedTransaction {
  const paymentMethod = detectPaymentMethod(raw.Description)
  const payerName = extractPayerName(raw.Description)
  const displayName = generateDisplayName(raw.Description, payerName, paymentMethod)
  const isDebit = raw.Type.toLowerCase() === 'debit'

  // Use display name as Description for cleaner import
  // The original description is still preserved in the raw data
  const description = displayName || raw.Description

  return {
    Date: raw.Date,  // Keep original DD/MM/YYYY format - web app parser expects this
    Description: description,
    Amount: raw.Amount,
    Type: isDebit ? 'Debit' : 'Credit',
    Balance: raw.Balance || '',
    Reference: raw.Reference || '',
    BankAccount: raw.BankAccount,
  }
}

async function main() {
  const importDir = path.join(process.cwd(), 'data', 'imports')
  const outputFile = path.join(importDir, 'transactions_converted.csv')

  // Find all CSV files in the imports directory
  const files = fs.readdirSync(importDir).filter(f => f.endsWith('.csv') && !f.includes('converted'))

  console.log(`Found ${files.length} CSV files to convert:`)
  files.forEach(f => console.log(`  - ${f}`))

  const allTransactions: ConvertedTransaction[] = []

  for (const file of files) {
    const filePath = path.join(importDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')

    const result = Papa.parse<RawTransaction>(content, {
      header: true,
      skipEmptyLines: true,
    })

    console.log(`\nProcessing ${file}: ${result.data.length} transactions`)

    for (const raw of result.data) {
      if (!raw.Date || !raw.Amount) continue
      const converted = convertTransaction(raw)
      allTransactions.push(converted)
    }
  }

  // Sort by date (DD/MM/YYYY format, so convert for proper sorting)
  allTransactions.sort((a, b) => {
    const [dayA, monthA, yearA] = a.Date.split('/')
    const [dayB, monthB, yearB] = b.Date.split('/')
    const dateA = `${yearA}-${monthA}-${dayA}`
    const dateB = `${yearB}-${monthB}-${dayB}`
    return dateA.localeCompare(dateB)
  })

  console.log(`\nTotal transactions: ${allTransactions.length}`)

  // Generate CSV in the format expected by web app
  const csv = Papa.unparse(allTransactions, {
    columns: [
      'Date',
      'Description',
      'Amount',
      'Type',
      'Balance',
      'Reference',
      'BankAccount',
    ],
  })

  fs.writeFileSync(outputFile, csv)
  console.log(`\nConverted CSV written to: ${outputFile}`)

  // Print summary
  console.log('\n=== Summary ===')
  const byType = new Map<string, number>()
  const byBank = new Map<string, number>()

  for (const t of allTransactions) {
    byType.set(t.Type, (byType.get(t.Type) || 0) + 1)
    const { bank } = parseBankAccountId(t.BankAccount)
    byBank.set(bank, (byBank.get(bank) || 0) + 1)
  }

  console.log('\nBy Type:')
  for (const [type, count] of byType) {
    console.log(`  ${type}: ${count}`)
  }

  console.log('\nBy Bank:')
  for (const [bank, count] of byBank) {
    console.log(`  ${bank}: ${count}`)
  }
}

main().catch(console.error)
