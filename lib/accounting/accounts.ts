/**
 * Chart of Accounts Operations
 *
 * CRUD operations for GL accounts stored in Firestore.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { projectsDb } from '../firebase'
import type {
  Account,
  AccountInput,
  AccountType,
  NormalBalance,
  AccountingSettings,
  AccountingSettingsInput,
} from './types'
import {
  ACCOUNTING_COLLECTION,
  ACCOUNTS_SUBCOLLECTION,
  SETTINGS_DOC_ID,
  SETTINGS_MAIN_DOC_ID,
  SEED_ACCOUNTS,
  DEFAULT_SETTINGS,
  BANK_ACCOUNT_TO_GL,
} from './types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine the normal balance for an account type.
 * Assets and Expenses have debit normal balance.
 * Liabilities, Equity, and Revenue have credit normal balance.
 */
export function getNormalBalance(type: AccountType): NormalBalance {
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

/**
 * Get the Firestore collection reference for accounts.
 */
function getAccountsCollection() {
  return collection(projectsDb, ACCOUNTING_COLLECTION, SETTINGS_DOC_ID, ACCOUNTS_SUBCOLLECTION)
}

/**
 * Get the Firestore document reference for settings.
 */
function getSettingsDocRef() {
  return doc(projectsDb, ACCOUNTING_COLLECTION, SETTINGS_DOC_ID, 'config', SETTINGS_MAIN_DOC_ID)
}

// ============================================================================
// Account CRUD Operations
// ============================================================================

/**
 * Create a new account in the Chart of Accounts.
 */
export async function createAccount(input: AccountInput): Promise<Account> {
  const accountsCol = getAccountsCollection()
  const accountRef = doc(accountsCol, input.code)

  // Check if account already exists
  const existing = await getDoc(accountRef)
  if (existing.exists()) {
    throw new Error(`Account with code ${input.code} already exists`)
  }

  const account: Omit<Account, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    code: input.code,
    name: input.name,
    type: input.type,
    normalBalance: getNormalBalance(input.type),
    linkedBankAccount: input.linkedBankAccount ?? undefined,
    active: input.active ?? true,
    isSystem: input.isSystem ?? false,
    createdAt: serverTimestamp(),
  }

  // Remove undefined fields
  const cleanAccount = Object.fromEntries(
    Object.entries(account).filter(([, v]) => v !== undefined)
  )

  await setDoc(accountRef, cleanAccount)

  const created = await getDoc(accountRef)
  return { ...created.data(), code: created.id } as Account
}

/**
 * Get an account by its code.
 */
export async function getAccount(code: string): Promise<Account | null> {
  const accountRef = doc(getAccountsCollection(), code)
  const snapshot = await getDoc(accountRef)

  if (!snapshot.exists()) {
    return null
  }

  return { ...snapshot.data(), code: snapshot.id } as Account
}

/**
 * Get all accounts, optionally filtered by type or active status.
 */
export async function listAccounts(options?: {
  type?: AccountType
  activeOnly?: boolean
}): Promise<Account[]> {
  const accountsCol = getAccountsCollection()
  let q = query(accountsCol, orderBy('code'))

  if (options?.type) {
    q = query(accountsCol, where('type', '==', options.type), orderBy('code'))
  }

  const snapshot = await getDocs(q)
  let accounts = snapshot.docs.map((d) => ({ ...d.data(), code: d.id } as Account))

  if (options?.activeOnly) {
    accounts = accounts.filter((a) => a.active)
  }

  return accounts
}

/**
 * Update an existing account.
 */
export async function updateAccount(
  code: string,
  updates: Partial<Pick<Account, 'name' | 'linkedBankAccount' | 'active'>>
): Promise<Account> {
  const accountRef = doc(getAccountsCollection(), code)
  const existing = await getDoc(accountRef)

  if (!existing.exists()) {
    throw new Error(`Account with code ${code} not found`)
  }

  const currentData = existing.data() as Account

  // Prevent modifying system accounts' core properties
  if (currentData.isSystem && 'name' in updates) {
    // Allow name changes for system accounts, but log a warning
    console.warn(`Modifying system account ${code} name`)
  }

  await updateDoc(accountRef, updates)

  const updated = await getDoc(accountRef)
  return { ...updated.data(), code: updated.id } as Account
}

/**
 * Delete an account (soft delete by setting active = false for system accounts).
 */
export async function deleteAccount(code: string): Promise<void> {
  const accountRef = doc(getAccountsCollection(), code)
  const existing = await getDoc(accountRef)

  if (!existing.exists()) {
    throw new Error(`Account with code ${code} not found`)
  }

  const currentData = existing.data() as Account

  if (currentData.isSystem) {
    // Soft delete for system accounts
    await updateDoc(accountRef, { active: false })
  } else {
    // Hard delete for non-system accounts
    await deleteDoc(accountRef)
  }
}

/**
 * Look up the GL account code for a bank account ID.
 */
export function getBankGLAccountCode(bankAccountId: string): string | null {
  return BANK_ACCOUNT_TO_GL[bankAccountId] ?? null
}

/**
 * Look up the GL account for a bank account ID (fetches from Firestore).
 */
export async function getBankGLAccount(bankAccountId: string): Promise<Account | null> {
  const code = getBankGLAccountCode(bankAccountId)
  if (!code) {
    return null
  }
  return getAccount(code)
}

// ============================================================================
// Settings Operations
// ============================================================================

/**
 * Get accounting settings.
 */
export async function getSettings(): Promise<AccountingSettings | null> {
  const settingsRef = getSettingsDocRef()
  const snapshot = await getDoc(settingsRef)

  if (!snapshot.exists()) {
    return null
  }

  return snapshot.data() as AccountingSettings
}

/**
 * Update accounting settings.
 */
export async function updateSettings(updates: AccountingSettingsInput): Promise<AccountingSettings> {
  const settingsRef = getSettingsDocRef()
  const existing = await getDoc(settingsRef)

  const now = serverTimestamp()

  if (!existing.exists()) {
    // Create with defaults
    const settings = {
      ...DEFAULT_SETTINGS,
      ...updates,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(settingsRef, settings)
  } else {
    await updateDoc(settingsRef, {
      ...updates,
      updatedAt: now,
    })
  }

  const updated = await getDoc(settingsRef)
  return updated.data() as AccountingSettings
}

// ============================================================================
// Seed Operations
// ============================================================================

/**
 * Seed the Chart of Accounts with default accounts.
 * Skips accounts that already exist.
 */
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

/**
 * Initialize accounting settings with defaults if not exists.
 */
export async function initializeSettings(): Promise<AccountingSettings> {
  const existing = await getSettings()
  if (existing) {
    return existing
  }

  return updateSettings(DEFAULT_SETTINGS)
}

/**
 * Full initialization: seed accounts and settings.
 */
export async function initializeAccounting(): Promise<{
  settings: AccountingSettings
  accounts: { created: string[]; skipped: string[] }
}> {
  const settings = await initializeSettings()
  const accounts = await seedAccounts()

  return { settings, accounts }
}
