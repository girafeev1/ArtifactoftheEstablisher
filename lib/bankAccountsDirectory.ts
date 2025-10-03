// lib/bankAccountsDirectory.ts

import { collection, getDocs } from 'firebase/firestore'

import { getFirestoreForDatabase } from './firebase'

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

export const fetchBankAccountsDirectory = async (): Promise<BankAccountDirectoryRecord[]> => {
  const directoryDb = getFirestoreForDatabase('erl-directory')
  const bankSnapshot = await getDocs(collection(directoryDb, 'bankAccount'))

  const results: BankAccountDirectoryRecord[] = []

  await Promise.all(
    bankSnapshot.docs.map(async (bankDoc) => {
      const bankData = bankDoc.data() as Record<string, unknown>
      const bankName = bankDoc.id
      const codes = normalizeBankCodes(bankData.code)

      if (codes.length === 0) {
        // No sub-collections; treat as a placeholder without accounts
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
        return
      }

      await Promise.all(
        codes.map(async (code) => {
          const subcollectionName = `(${code})`
          const accountsSnapshot = await getDocs(collection(bankDoc.ref, subcollectionName))

          accountsSnapshot.forEach((accountDoc) => {
            const accountData = accountDoc.data() as Record<string, unknown>
            const fpsId =
              toOptionalString(accountData['FPS ID']) ?? toOptionalString(accountData['fpsId'])
            const fpsEmail =
              toOptionalString(accountData['FPS Email']) ??
              toOptionalString(accountData['fpsEmail']) ??
              toOptionalString(accountData['FPS EMAIL'])

            results.push({
              bankName,
              bankCode: code,
              accountId: accountDoc.id,
              accountType: toOptionalString(accountData.accountType),
              accountNumber: toOptionalString(accountData.accountNumber),
              status: toOptionalBoolean(accountData.status),
              fpsId,
              fpsEmail,
            })
          })
        })
      )
    })
  )

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
