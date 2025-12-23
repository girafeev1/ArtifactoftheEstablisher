/**
 * Accounting Module
 *
 * Double-entry general ledger for the invoicing system.
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

// Journal operations
export {
  validateJournalBalance,
  createJournalEntry,
  getJournalEntry,
  listJournalEntries,
  findJournalEntriesForSource,
  hasJournalEntryForEvent,
  voidJournalEntry,
  getAccountBalances,
  getLedgerTotals,
} from './journals'

// Posting engine
export {
  postInvoiceEvent,
  resolveBankAccountCode,
  handleInvoiceStatusChange,
  migrateInvoiceToGL,
  getInvoiceJournalEntries,
} from './posting'

// Reports
export {
  generateTrialBalance,
  generateProfitAndLoss,
  generateBalanceSheet,
  generateARAgingReport,
} from './reports'
