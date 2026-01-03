/**
 * Accounting Module Types
 *
 * Core type definitions for the double-entry accounting system.
 */

import type { Timestamp } from 'firebase/firestore'

// ============================================================================
// Account Types
// ============================================================================

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export type NormalBalance = 'debit' | 'credit'

export interface Account {
  code: string
  name: string
  type: AccountType
  normalBalance: NormalBalance
  linkedBankAccount?: string // Links to bankAccount/{id} for bank accounts
  active: boolean
  isSystem: boolean // Prevent deletion of core accounts
  createdAt: Timestamp
}

export interface AccountInput {
  code: string
  name: string
  type: AccountType
  linkedBankAccount?: string
  active?: boolean
  isSystem?: boolean
}

// ============================================================================
// Journal Entry Types
// ============================================================================

export type JournalStatus = 'posted' | 'void'

export type JournalSourceType = 'invoice' | 'manual' | 'migration'

export type JournalSourceEvent = 'ISSUED' | 'PAID' | 'ADJUSTMENT' | 'VOID'

export interface JournalSource {
  type: JournalSourceType
  path?: string // Firestore path to source document (e.g., invoice)
  event?: JournalSourceEvent
  // Structured fields for dynamic description generation
  invoiceNumber?: string // e.g., "2025-016-0924"
  companyName?: string // e.g., "Ksana Productions Limited"
  projectId?: string // For linking back to project
  transactionId?: string // For PAID entries, links to the bank transaction
  // Project details for tooltip display
  presenter?: string // e.g., "John Doe"
  workType?: string // e.g., "Photography"
  projectTitle?: string // e.g., "Annual Report 2024"
  projectNature?: string // e.g., "Event Photography"
}

export interface JournalLine {
  accountCode: string
  debit: number
  credit: number
  memo?: string
}

export interface JournalEntry {
  id?: string // Document ID (set after creation)
  postingDate: Timestamp
  description?: string // Optional - generated from source metadata at display time
  status: JournalStatus
  source: JournalSource
  lines: JournalLine[]
  subsidiaryId?: string // Which subsidiary this entry belongs to (e.g., "erl")
  createdAt: Timestamp
  createdBy: string
}

export interface JournalEntryInput {
  postingDate: Date
  description?: string // Optional - can be generated from source metadata
  source: JournalSource
  lines: JournalLine[]
  subsidiaryId?: string
  createdBy: string
}

// ============================================================================
// Bank Transaction Types (Evidence-Based Payments)
// ============================================================================

export type PaymentMethod = 'bank_transfer' | 'check' | 'cash' | 'credit_card' | 'other'

export type TransactionStatus = 'unmatched' | 'matched' | 'partial' | 'categorized'

export type TransactionSource = 'manual' | 'csv_import' | 'api_import'

// API import source providers
export type ApiImportProvider = 'airwallex' | 'ocbc' | 'gcp_billing'

export interface MatchedInvoice {
  invoiceNumber: string
  projectId: string
  year: string
  amount: number // Amount applied to this invoice
  paidJournalId?: string // Journal entry ID for voiding on unmatch
}

export interface ImportBatch {
  filename: string
  importedAt: Timestamp
  importedBy: string
  // For API imports
  provider?: ApiImportProvider
  syncId?: string // Unique ID for this sync operation
}

export interface BankTransaction {
  id?: string

  // Transaction details
  transactionDate: Timestamp
  amount: number
  isDebit: boolean // true = outgoing (debit), false = incoming (credit)
  currency: string // "HKD", "USD", etc.

  // Bank details
  bankAccountId: string // Which account received it (e.g., "ERL-DBS-S")
  paymentMethod: PaymentMethod
  referenceNumber?: string // Bank reference, check #, transaction ID

  // Payer info
  payerName: string
  payerReference?: string // Customer's reference if any

  // Display & categorization
  displayName?: string // User-editable display name
  originalDescription?: string // Original description from import (for tooltip)
  accountCode?: string // GL account code for expense/revenue categorization

  // Matching
  status: TransactionStatus
  matchedInvoices?: MatchedInvoice[]

  // Source tracking
  source: TransactionSource
  importBatch?: ImportBatch

  // Audit fields
  subsidiaryId: string
  memo?: string
  supportingDocument?: string // File path/URL to uploaded proof (legacy)
  receiptIds?: string[]       // Array of linked receipt IDs
  createdAt: Timestamp
  createdBy: string
  updatedAt?: Timestamp
  updatedBy?: string
}

export interface BankTransactionInput {
  transactionDate: Date
  amount: number
  isDebit?: boolean // true = outgoing (debit), false = incoming (credit)
  currency: string
  bankAccountId: string
  paymentMethod: PaymentMethod
  referenceNumber?: string
  payerName: string
  payerReference?: string
  displayName?: string // User-editable display name
  originalDescription?: string // Original description from import
  accountCode?: string // GL account for categorization
  subsidiaryId: string
  memo?: string
  supportingDocument?: string
  source: TransactionSource
  importBatch?: Omit<ImportBatch, 'importedAt'> & { importedAt?: Date }
}

// ============================================================================
// Settings Types
// ============================================================================

export type AccountingBasis = 'accrual' | 'cash'

export interface AccountingSettings {
  defaultBasis: AccountingBasis
  currency: string
  fiscalYearStartMonth: number // 1-12 (4 = April for HK)
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface AccountingSettingsInput {
  defaultBasis?: AccountingBasis
  currency?: string
  fiscalYearStartMonth?: number
}

// ============================================================================
// Report Types
// ============================================================================

export interface AccountBalance {
  accountCode: string
  accountName: string
  accountType: AccountType
  debit: number
  credit: number
  balance: number // Calculated based on normal balance
}

export interface TrialBalance {
  asOf: Date
  accounts: AccountBalance[]
  totalDebits: number
  totalCredits: number
  isBalanced: boolean
}

export interface ProfitAndLoss {
  startDate: Date
  endDate: Date
  revenue: AccountBalance[]
  expenses: AccountBalance[]
  totalRevenue: number
  totalExpenses: number
  netIncome: number
}

export interface BalanceSheet {
  asOf: Date
  assets: AccountBalance[]
  liabilities: AccountBalance[]
  equity: AccountBalance[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  isBalanced: boolean // Assets = Liabilities + Equity
}

// ============================================================================
// Posting Types (for invoice → journal conversion)
// ============================================================================

export type InvoiceEvent = 'ISSUED' | 'PAID'

export interface PostingContext {
  invoicePath: string
  invoiceNumber: string
  companyName: string
  amount: number
  event: InvoiceEvent
  eventDate: Date
  bankAccountCode?: string // For PAID events, which bank GL account
  subsidiaryId?: string // Which subsidiary this entry belongs to
  transactionId?: string // For PAID events, the linked bank transaction ID
  createdBy: string
}

// ============================================================================
// Seed Data
// ============================================================================

export const SEED_ACCOUNTS: AccountInput[] = [
  // Assets - Bank Accounts (Format: <Subsidiary> - <Bank Full Name> (<Account Type> Account))
  { code: '1000', name: 'The Establishers - DBS Bank (Savings Account)', type: 'asset', linkedBankAccount: 'ERL-DBS-S', isSystem: true },
  { code: '1001', name: 'The Establishers - DBS Bank (Current Account)', type: 'asset', linkedBankAccount: 'ERL-DBS-C', isSystem: true },
  { code: '1002', name: 'The Establishers - OCBC Bank (Savings Account)', type: 'asset', linkedBankAccount: 'ERL-OCBC-S', isSystem: true },
  { code: '1003', name: 'The Establishers - OCBC Bank (Current Account)', type: 'asset', linkedBankAccount: 'ERL-OCBC-C', isSystem: true },
  { code: '1004', name: 'The Establishers - Fubon Bank (Current Account)', type: 'asset', linkedBankAccount: 'ERL-FBO-C', isSystem: true },

  // Assets - Receivables
  { code: '1100', name: 'Accounts Receivable', type: 'asset', isSystem: true },

  // Equity
  { code: '3000', name: 'Retained Earnings', type: 'equity', isSystem: true },

  // Revenue
  { code: '4000', name: 'Service Revenue', type: 'revenue', isSystem: true },
]

export const DEFAULT_SETTINGS: AccountingSettingsInput = {
  defaultBasis: 'accrual',
  currency: 'HKD',
  fiscalYearStartMonth: 4, // April (HK tax year)
}

// ============================================================================
// Constants
// ============================================================================

export const ACCOUNTING_COLLECTION = 'accounting'
export const ACCOUNTS_SUBCOLLECTION = 'accounts'
export const JOURNALS_SUBCOLLECTION = 'journals'
export const TRANSACTIONS_SUBCOLLECTION = 'transactions'
export const SETTINGS_DOC_ID = 'settings'
export const SETTINGS_MAIN_DOC_ID = 'main'

// Account codes for posting rules
export const ACCOUNT_CODES = {
  ACCOUNTS_RECEIVABLE: '1100',
  SERVICE_REVENUE: '4000',
  RETAINED_EARNINGS: '3000',
} as const

// Map bankAccount IDs to GL account codes
export const BANK_ACCOUNT_TO_GL: Record<string, string> = {
  'ERL-DBS-S': '1000',
  'ERL-DBS-C': '1001',
  'ERL-OCBC-S': '1002',
  'ERL-OCBC-C': '1003',
  'ERL-FBO-C': '1004',
  'ERL-AWX-S': '1005', // Airwallex
}

// ============================================================================
// Document Types (Supporting Documents - Receipts, Invoices, Contracts, etc.)
// ============================================================================

/**
 * Document type classification
 * - receipt: Uploaded receipt/proof of payment
 * - invoice_pdf: Generated invoice PDF
 * - contract: Contract or agreement
 * - quote: Quote or estimate
 * - other: Other supporting document
 */
export type DocumentType = 'receipt' | 'invoice_pdf' | 'contract' | 'quote' | 'other'

export type DocumentStatus = 'inbox' | 'matched' | 'orphaned'

export type DocumentSource = 'telegram' | 'web' | 'system'

export interface Document {
  id?: string

  // Document type
  type: DocumentType            // Classification of the document

  // File information
  storagePath: string           // Firebase Storage path: documents/{subsidiaryId}/{year}/{month}/{filename}
  originalFilename: string      // Original filename from upload
  mimeType: string              // image/jpeg, image/png, image/heic, application/pdf
  fileSize: number              // Bytes
  thumbnailPath?: string        // Optional thumbnail for images

  // Linking information
  status: DocumentStatus
  transactionId?: string        // Linked transaction ID (when matched)
  invoiceNumber?: string        // Linked invoice number (for invoice PDFs)
  referenceNumber?: string      // User-provided reference for auto-matching

  // Source tracking
  source: DocumentSource
  telegramUserId?: number       // For Telegram uploads
  telegramFileId?: string       // Telegram file_id for re-download if needed

  // Organizational
  subsidiaryId: string
  uploadedAt: Timestamp
  uploadedBy: string            // User email or 'tg:{telegramUserId}'
  matchedAt?: Timestamp
  matchedBy?: string

  // Metadata
  memo?: string                 // User notes about the document
}

export interface DocumentInput {
  type?: DocumentType           // Defaults to 'receipt' if not specified
  storagePath: string
  originalFilename: string
  mimeType: string
  fileSize: number
  thumbnailPath?: string
  invoiceNumber?: string
  referenceNumber?: string
  source: DocumentSource
  telegramUserId?: number
  telegramFileId?: string
  subsidiaryId: string
  uploadedBy: string
  memo?: string
}

// Backward compatibility aliases
export type ReceiptStatus = DocumentStatus
export type ReceiptSource = DocumentSource
export type Receipt = Document
export type ReceiptInput = DocumentInput

// Allowed MIME types for document uploads
export const DOCUMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'application/pdf',
] as const

export type DocumentMimeType = typeof DOCUMENT_ALLOWED_MIME_TYPES[number]

// Backward compatibility alias
export const RECEIPT_ALLOWED_MIME_TYPES = DOCUMENT_ALLOWED_MIME_TYPES
export type ReceiptMimeType = DocumentMimeType

// Document collection constants
export const DOCUMENTS_SUBCOLLECTION = 'documents'
export const RECEIPTS_SUBCOLLECTION = 'receipts' // Backward compatibility (points to same collection)
