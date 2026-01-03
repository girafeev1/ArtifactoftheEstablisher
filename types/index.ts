/**
 * Centralized Type Exports
 *
 * Re-exports all domain types for convenient importing.
 * Import from '@/types' instead of individual lib modules.
 *
 * Usage:
 *   import type { Account, JournalEntry, BankTransaction } from '@/types'
 */

// ============================================================================
// Accounting Types
// ============================================================================
export type {
  AccountType,
  NormalBalance,
  Account,
  AccountInput,
  JournalStatus,
  JournalSourceType,
  JournalSourceEvent,
  JournalSource,
  JournalLine,
  JournalEntry,
  JournalEntryInput,
  PaymentMethod,
  TransactionStatus,
  TransactionSource,
  ApiImportProvider,
  BankTransaction,
  BankTransactionInput,
  MatchedInvoice,
  ImportBatch,
  AccountingBasis,
  AccountingSettings,
  AccountBalance,
  TrialBalance,
  ProfitAndLoss,
  BalanceSheet,
  ReceiptStatus,
  ReceiptSource,
  ReceiptMimeType,
  Receipt,
  ReceiptInput,
} from '../lib/accounting/types'

// ============================================================================
// Invoice Types
// ============================================================================
export type {
  InvoiceItem,
  BankInfo as InvoiceBankInfo,
  Representative,
  InvoiceVariant,
  ThemeStyle,
} from '../lib/invoice/types'

// ============================================================================
// Project Invoice Types
// ============================================================================
export type {
  ProjectInvoiceRecord,
  ProjectInvoiceItemRecord,
  InvoiceRecordStatus,
  LinkedTransaction,
  FetchInvoicesOptions,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  DeleteInvoiceInput,
  DeleteInvoiceResult,
  RenameInvoiceInput,
  InvoiceClientPayload,
  InvoiceItemPayload,
  InvoicePdfMeta,
} from '../lib/projectInvoices'

// ============================================================================
// Project Types
// ============================================================================
export type {
  ProjectRecord,
  RecordStatus,
  WorkStatus,
  ProjectsDatabaseResult,
  ProjectUpdateInput,
  ProjectCreateInput,
  FetchProjectsOptions,
} from '../lib/projectsDatabase'

// ============================================================================
// Banking Types (Generic - Provider Agnostic)
// ============================================================================
export type {
  BankProviderId,
  BankFeature,
  BankProvider,
  AccountStatus as BankAccountStatus,
  BankAccount,
  AccountSummary,
  TransactionType as BankTransactionType,
  TransactionStatus as BankingTransactionStatus,
  Counterparty,
  BankTransaction as GenericBankTransaction,
  TransactionFilters,
  TransactionListResponse,
  TransferStatus,
  TransferType,
  TransferRequest,
  TransferResult,
  BeneficiaryStatus,
  BeneficiaryType,
  Beneficiary,
  BankAdapter,
  BankingApiResponse,
  MultiProviderResponse,
} from '../lib/banking/types'

// ============================================================================
// Airwallex Types
// ============================================================================
export type {
  AirwallexAuthToken,
  AirwallexAuthConfig,
  AirwallexAuthResponse,
  StoredAirwallexToken,
  AirwallexAuditLog,
  AirwallexAccount,
  AirwallexAccountListResponse,
  AirwallexBalanceResponse,
  AirwallexBalanceByCurrency,
  AirwallexTransaction,
  AirwallexTransactionListResponse,
  AirwallexTransactionParams,
  AirwallexTransactionType,
  AirwallexTransactionStatus,
  AirwallexPayment,
  AirwallexPaymentListResponse,
  AirwallexPaymentRequest,
  AirwallexPaymentStatus,
  AirwallexBeneficiary,
  AirwallexBeneficiaryListResponse,
  AirwallexApiError,
  AirwallexApiResponse,
} from '../lib/airwallex/types'

// ============================================================================
// OCBC Types
// ============================================================================
export type {
  OCBCAuthToken,
  OCBCAuthConfig,
  StoredOCBCToken,
  OCBCAuditLog,
  OCBCAccount,
  OCBCAccountListResponse,
  OCBCAccountBalanceResponse,
  OCBCTransaction,
  OCBCTransactionHistoryResponse,
  OCBCTransferRequest,
  OCBCTransferResponse,
  OCBCTransferStatus,
  OCBCBeneficiary,
  OCBCBeneficiaryListResponse,
  OCBCApiError,
  OCBCApiResponse,
} from '../lib/ocbc/types'

// ============================================================================
// GCP Billing Types
// ============================================================================
export type {
  GCPBillingRow,
  GCPBillingConfig,
  GCPDailyCost,
  GCPMonthlyInvoice,
  GCPCostBreakdown,
  GCPTransactionEvidence,
  GCPBillingQuery,
  GCPBillingQueryResult,
} from '../lib/gcpBilling/types'

// ============================================================================
// Coaching Types
// ============================================================================
export type {
  MainTab,
  BillingSubTab,
  StudentInfo,
  SessionRecord,
  PaymentRecord,
  VoucherRecord,
  SessionTableRow,
  PaymentTableRow,
  VoucherTableRow,
  StudentDialogProps,
  SessionDetailProps,
  PaymentModalProps,
  VoucherModalProps,
  RetainerModalProps,
} from './coaching'

// Re-export retainer types
export type { RetainerDoc, RetainerStatus, RetainerStatusColor } from '../lib/retainer'

// ============================================================================
// Shared/Utility Types
// ============================================================================
export type {
  ApiResponse,
  ApiErrorResponse,
  ApiResult,
  PaginatedResponse,
  SortDirection,
  DateRange,
  FilterState,
  LoadingState,
  SelectionState,
  FormFieldState,
  FormSubmitState,
  BaseEntity,
  SoftDeletableEntity,
  AuditableEntity,
  ModalState,
  TabState,
  NotificationType,
  Notification,
  CurrencyCode,
  Money,
  ExchangeRate,
  UploadState,
  FileMetadata,
} from './shared'

// ============================================================================
// Organization Types
// ============================================================================
export type { SubsidiaryDoc } from '../lib/subsidiaries'
