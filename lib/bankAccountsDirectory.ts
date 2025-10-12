// lib/bankAccountsDirectory.ts

import { collection, getDocs } from 'firebase/firestore'

import { getDirectoryFirestoreClients } from './firebase'

export interface BankAccountDirectoryRecord {
  bankName: string
  bankCode: string | null
  accountId: string
  accountType: string | null
  accountNumber: string | null
  status: boolean | null
  fpsId: string | null
  fpsEmail: string | null
}

const toOptionalString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return null
}

const toOptionalBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value
  }
  return null
}

const normalizeBankCodes = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((value) => {
      if (typeof value === 'number') {
        return value
      }
      if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
      }
      return null
    })
    .filter((value): value is number => value !== null)
    .map((value) => value.toString().padStart(3, '0'))
}

const directoryClients = getDirectoryFirestoreClients()

const logDirectoryWarning = (dbId: string, message: string, error: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[bankAccountsDirectory:${dbId}] ${message}`, error)
  }
}

export const fetchBankAccountsDirectory = async (): Promise<BankAccountDirectoryRecord[]> => {
  for (const { id, db } of directoryClients) {
    try {
      const bankSnapshot = await getDocs(collection(db, 'bankAccount'))
      if (bankSnapshot.empty) {
        continue
      }

      const results: BankAccountDirectoryRecord[] = []

      for (const bankDoc of bankSnapshot.docs) {
        const bankData = bankDoc.data() as Record<string, unknown>
        const bankName = bankDoc.id
        const codes = normalizeBankCodes(bankData.code)

        if (codes.length === 0) {
          results.push({
            bankName,
            bankCode: null,
            accountId: `${bankDoc.id}-unknown`,
            accountType: null,
            accountNumber: null,
            status: null,
            fpsId: null,
            fpsEmail: null,
          })
          continue
        }

        for (const code of codes) {
          const subcollectionName = `(${code})`
          try {
            const accountsSnapshot = await getDocs(collection(bankDoc.ref, subcollectionName))
            accountsSnapshot.forEach((accountDoc) => {
              const accountData = accountDoc.data() as Record<string, unknown>
              const fpsId =
                toOptionalString(accountData['FPS ID']) ??
                toOptionalString(accountData['fpsId']) ??
                toOptionalString(accountData['fpsID'])
              const fpsEmail =
                toOptionalString(accountData['FPS Email']) ??
                toOptionalString(accountData['fpsEmail']) ??
                toOptionalString(accountData['FPS EMAIL'])

              results.push({
                bankName,
                bankCode: `(${code})`,
                accountId: accountDoc.id,
                accountType: toOptionalString(accountData.accountType),
                accountNumber:
                  toOptionalString(accountData.accountNumber) ??
                  toOptionalString(accountData.accountNumberMasked),
                status: toOptionalBoolean(accountData.status),
                fpsId,
                fpsEmail,
              })
            })
          } catch (error) {
            logDirectoryWarning(id, `failed to load accounts for ${bankDoc.id}/${subcollectionName}`, error)
          }
        }
      }

      if (results.length > 0) {
        return results.sort((a, b) => {
          const nameCompare = a.bankName.localeCompare(b.bankName)
          if (nameCompare !== 0) {
            return nameCompare
          }
          const codeCompare = (a.bankCode ?? '').localeCompare(b.bankCode ?? '')
          if (codeCompare !== 0) {
            return codeCompare
          }
          return a.accountId.localeCompare(b.accountId)
        })
      }
    } catch (error) {
      logDirectoryWarning(id, 'failed to load bank account directory', error)
    }
  }

  return []
}

export const buildBankAccountLabel = (record: BankAccountDirectoryRecord) =>
  record.accountType ? `${record.bankName} - ${record.accountType} Account` : record.bankName
