/**
 * Accounting Admin Operations
 *
 * Uses Firebase Admin SDK for server-side scripts.
 * This module mirrors the client-side operations but uses the Admin SDK.
 *
 * Note: Journal entries are now DERIVED from invoices and transactions on-the-fly.
 * No journal entries are stored in Firestore.
 */

import { Firestore, FieldValue } from '@google-cloud/firestore'
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
} from './types'
// ============================================================================
// Admin Firestore Client
// ============================================================================

let _db: Firestore | null = null

function getAdminDb(): Firestore {
  if (_db) return _db

  // Read credentials from environment variables
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
  // Path: accounting/accounts/entries/{accountCode}
  return getAdminDb().collection(ACCOUNTING_COLLECTION).doc(ACCOUNTS_SUBCOLLECTION).collection('entries')
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
