/**
 * Accounting Module
 *
 * Double-entry general ledger for the invoicing system.
 * Journal entries are now DERIVED from invoices and transactions on-the-fly.
 */

// Types
export * from './types'

// Account operations
export {
  getNormalBalance,
  createAccount,
  getAccount,
  listAccounts,
  updateAccount,
  deleteAccount,
  getBankGLAccountCode,
  getBankGLAccount,
  getSettings,
  updateSettings,
  seedAccounts,
  initializeSettings,
  initializeAccounting,
} from './accounts'

// Derived journal entries (computed on-the-fly, not stored)
export {
  getDerivedJournalEntries,
  getDerivedJournalEntry,
} from './derivedJournals'

// Reports
export {
  generateTrialBalance,
  generateProfitAndLoss,
  generateBalanceSheet,
  generateARAgingReport,
} from './reports'

// Description generator
export {
  generateDescription,
  getDescriptionParts,
  hasStructuredMetadata,
} from './descriptionGenerator'

// Bank transactions
export {
  createTransaction,
  createTransactionsBatch,
  getTransaction,
  listTransactions,
  updateTransaction,
  deleteTransaction,
  matchTransactionToInvoices,
  unmatchTransaction,
  findTransactionsForInvoice,
  getTotalPaidForInvoice,
  getTransactionStats,
  getPayerNames,
  getInvoiceAmountPaidFromTransactions,
  syncProjectWorkStatuses,
} from './transactions'
export type { TransactionStats } from './transactions'

// CSV parsing
export {
  parseCSV,
  validateCSV,
  getCSVHeaders,
  getCSVPreview,
} from './csvParser'
