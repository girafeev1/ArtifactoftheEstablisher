/**
 * Accounting Admin Operations
 *
 * Uses Firebase Admin SDK for server-side scripts.
 * This module mirrors the client-side operations but uses the Admin SDK.
 */

import { Firestore, Timestamp, FieldValue } from '@google-cloud/firestore'
import type {
  Account,
  AccountInput,
  AccountType,
  NormalBalance,
  AccountingSettings,
  AccountingSettingsInput,
  JournalEntry,
  JournalEntryInput,
  JournalLine,
  JournalStatus,
} from './types'
import {
  ACCOUNTING_COLLECTION,
  ACCOUNTS_SUBCOLLECTION,
  JOURNALS_SUBCOLLECTION,
  SETTINGS_DOC_ID,
  SETTINGS_MAIN_DOC_ID,
  SEED_ACCOUNTS,
  DEFAULT_SETTINGS,
} from './types'

// ============================================================================
// Admin Firestore Client
// ============================================================================

let _db: Firestore | null = null

function getAdminDb(): Firestore {
  if (_db) return _db

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  const privateKey = privateKeyRaw?.replace(/\\n/g, '\n')
  const databaseId = process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'tebs-erl'

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials in environment')
  }

  _db = new Firestore({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
    databaseId,
  })

  return _db
}

// ============================================================================
// Helper Functions
// ============================================================================

function getNormalBalance(type: AccountType): NormalBalance {
  switch (type) {
    case 'asset':
    case 'expense':
      return 'debit'
    case 'liability':
    case 'equity':
    case 'revenue':
      return 'credit'
  }
}

function getAccountsCollection() {
  return getAdminDb().collection(ACCOUNTING_COLLECTION).doc(SETTINGS_DOC_ID).collection(ACCOUNTS_SUBCOLLECTION)
}

function getJournalsCollection() {
  return getAdminDb().collection(ACCOUNTING_COLLECTION).doc(JOURNALS_SUBCOLLECTION).collection('entries')
}

function getSettingsDocRef() {
  return getAdminDb().collection(ACCOUNTING_COLLECTION).doc(SETTINGS_DOC_ID).collection('config').doc(SETTINGS_MAIN_DOC_ID)
}

// ============================================================================
// Account Operations
// ============================================================================

export async function createAccount(input: AccountInput): Promise<Account> {
  const accountRef = getAccountsCollection().doc(input.code)
  const existing = await accountRef.get()

  if (existing.exists) {
    throw new Error(`Account with code ${input.code} already exists`)
  }

  const account = {
    code: input.code,
    name: input.name,
    type: input.type,
    normalBalance: getNormalBalance(input.type),
    linkedBankAccount: input.linkedBankAccount ?? null,
    active: input.active ?? true,
    isSystem: input.isSystem ?? false,
    createdAt: FieldValue.serverTimestamp(),
  }

  await accountRef.set(account)
  const created = await accountRef.get()
  return { ...created.data(), code: created.id } as Account
}

export async function getAccount(code: string): Promise<Account | null> {
  const snapshot = await getAccountsCollection().doc(code).get()
  if (!snapshot.exists) return null
  return { ...snapshot.data(), code: snapshot.id } as Account
}

export async function listAccounts(): Promise<Account[]> {
  const snapshot = await getAccountsCollection().orderBy('code').get()
  return snapshot.docs.map((d) => ({ ...d.data(), code: d.id } as Account))
}

// ============================================================================
// Settings Operations
// ============================================================================

export async function getSettings(): Promise<AccountingSettings | null> {
  const snapshot = await getSettingsDocRef().get()
  if (!snapshot.exists) return null
  return snapshot.data() as AccountingSettings
}

export async function updateSettings(updates: AccountingSettingsInput): Promise<AccountingSettings> {
  const settingsRef = getSettingsDocRef()
  const existing = await settingsRef.get()

  if (!existing.exists) {
    const settings = {
      ...DEFAULT_SETTINGS,
      ...updates,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }
    await settingsRef.set(settings)
  } else {
    await settingsRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  const updated = await settingsRef.get()
  return updated.data() as AccountingSettings
}

// ============================================================================
// Seed Operations
// ============================================================================

export async function seedAccounts(): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = []
  const skipped: string[] = []

  for (const accountInput of SEED_ACCOUNTS) {
    try {
      const existing = await getAccount(accountInput.code)
      if (existing) {
        skipped.push(accountInput.code)
        continue
      }
      await createAccount(accountInput)
      created.push(accountInput.code)
    } catch (error) {
      console.error(`Failed to seed account ${accountInput.code}:`, error)
      skipped.push(accountInput.code)
    }
  }

  return { created, skipped }
}

export async function initializeSettings(): Promise<AccountingSettings> {
  const existing = await getSettings()
  if (existing) return existing
  return updateSettings(DEFAULT_SETTINGS)
}

export async function initializeAccounting(): Promise<{
  settings: AccountingSettings
  accounts: { created: string[]; skipped: string[] }
}> {
  const settings = await initializeSettings()
  const accounts = await seedAccounts()
  return { settings, accounts }
}

// ============================================================================
// Journal Operations
// ============================================================================

function validateJournalBalance(lines: JournalLine[]): {
  isBalanced: boolean
  totalDebits: number
  totalCredits: number
} {
  const totalDebits = lines.reduce((sum, line) => sum + (line.debit || 0), 0)
  const totalCredits = lines.reduce((sum, line) => sum + (line.credit || 0), 0)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01
  return { isBalanced, totalDebits, totalCredits }
}

export async function createJournalEntry(input: JournalEntryInput): Promise<JournalEntry> {
  const balance = validateJournalBalance(input.lines)
  if (!balance.isBalanced) {
    throw new Error(
      `Journal entry is not balanced. Debits: ${balance.totalDebits}, Credits: ${balance.totalCredits}`
    )
  }

  const journalData = {
    postingDate: Timestamp.fromDate(input.postingDate),
    description: input.description,
    status: 'posted' as JournalStatus,
    source: input.source,
    lines: input.lines,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: input.createdBy,
  }

  const docRef = await getJournalsCollection().add(journalData)
  const created = await docRef.get()
  return { ...created.data(), id: created.id } as JournalEntry
}

export async function listJournalEntries(options?: {
  startDate?: Date
  endDate?: Date
  status?: JournalStatus
}): Promise<JournalEntry[]> {
  let query = getJournalsCollection().orderBy('postingDate', 'desc')

  if (options?.startDate) {
    query = query.where('postingDate', '>=', Timestamp.fromDate(options.startDate))
  }
  if (options?.endDate) {
    query = query.where('postingDate', '<=', Timestamp.fromDate(options.endDate))
  }
  if (options?.status) {
    query = query.where('status', '==', options.status)
  }

  const snapshot = await query.get()
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as JournalEntry))
}

export async function hasJournalEntryForEvent(
  sourcePath: string,
  event: string
): Promise<boolean> {
  const entries = await listJournalEntries()
  return entries.some(
    (e) => e.source.path === sourcePath && e.source.event === event && e.status === 'posted'
  )
}

// ============================================================================
// Migration Helper
// ============================================================================

import { ACCOUNT_CODES, BANK_ACCOUNT_TO_GL } from './types'

export interface InvoiceForMigration {
  path: string
  invoiceNumber: string
  companyName: string
  amount: number
  onDate: Date
  paidOn?: Date
  paidTo?: string
  paymentStatus: string
}

export async function migrateInvoiceToGL(
  invoice: InvoiceForMigration,
  migratedBy: string
): Promise<{
  issuedEntry?: { created: boolean; journalId?: string; skipped?: string }
  paidEntry?: { created: boolean; journalId?: string; skipped?: string }
}> {
  const results: {
    issuedEntry?: { created: boolean; journalId?: string; skipped?: string }
    paidEntry?: { created: boolean; journalId?: string; skipped?: string }
  } = {}

  const status = invoice.paymentStatus.toLowerCase().trim()
  const isCleared = ['cleared', 'paid', 'received', 'complete'].includes(status)
  const isDue = ['due', 'issued', 'pending', 'unpaid'].includes(status)

  if (!isCleared && !isDue) {
    return results // Skip drafts
  }

  // Create ISSUED entry
  const issuedExists = await hasJournalEntryForEvent(invoice.path, 'ISSUED')
  if (issuedExists) {
    results.issuedEntry = { created: false, skipped: 'ISSUED entry already exists' }
  } else {
    const issuedEntry = await createJournalEntry({
      postingDate: invoice.onDate,
      description: `Invoice ${invoice.invoiceNumber} issued to ${invoice.companyName}`,
      source: {
        type: 'migration',
        path: invoice.path,
        event: 'ISSUED',
      },
      lines: [
        { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: invoice.amount, credit: 0, memo: `AR - ${invoice.companyName}` },
        { accountCode: ACCOUNT_CODES.SERVICE_REVENUE, debit: 0, credit: invoice.amount, memo: `Revenue - ${invoice.invoiceNumber}` },
      ],
      createdBy: migratedBy,
    })
    results.issuedEntry = { created: true, journalId: issuedEntry.id }
  }

  // Create PAID entry for cleared invoices
  if (isCleared) {
    if (!invoice.paidOn || !invoice.paidTo) {
      results.paidEntry = { created: false, skipped: 'Missing paidOn or paidTo' }
      return results
    }

    const bankCode = BANK_ACCOUNT_TO_GL[invoice.paidTo]
    if (!bankCode) {
      results.paidEntry = { created: false, skipped: `Unknown bank account: ${invoice.paidTo}` }
      return results
    }

    const paidExists = await hasJournalEntryForEvent(invoice.path, 'PAID')
    if (paidExists) {
      results.paidEntry = { created: false, skipped: 'PAID entry already exists' }
    } else {
      const paidEntry = await createJournalEntry({
        postingDate: invoice.paidOn,
        description: `Payment received for Invoice ${invoice.invoiceNumber} from ${invoice.companyName}`,
        source: {
          type: 'migration',
          path: invoice.path,
          event: 'PAID',
        },
        lines: [
          { accountCode: bankCode, debit: invoice.amount, credit: 0, memo: `Payment received` },
          { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: 0, credit: invoice.amount, memo: `AR cleared` },
        ],
        createdBy: migratedBy,
      })
      results.paidEntry = { created: true, journalId: paidEntry.id }
    }
  }

  return results
}
