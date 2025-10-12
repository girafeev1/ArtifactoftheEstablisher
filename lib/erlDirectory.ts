import { collection, getDoc, getDocs, doc, query, where } from 'firebase/firestore'
import { getDirectoryFirestoreClients } from './firebase'

export interface BankInfo {
  bankCode: string
  bankName: string
  rawCodeSegment: string
}

export interface AccountInfo {
  accountDocId: string
  accountType?: string
  accountNumber?: string
  accountNo?: string
  acctNumber?: string
  number?: string
  [key: string]: any
}

const directoryClients = getDirectoryFirestoreClients()
const primaryDirectoryClient = directoryClients[0]

if (!primaryDirectoryClient) {
  throw new Error('No directory Firestore databases configured')
}

export const dbDirectory = primaryDirectoryClient.db

const logDirectoryWarning = (dbId: string, message: string, error: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[erlDirectory:${dbId}] ${message}`, error)
  }
}

export function normalizeCode(code: string | number): { code: string; raw: string } {
  const digits = typeof code === 'number' ? String(code) : String(code)
  const num = digits.replace(/[^0-9]/g, '')
  const normalized = num.padStart(3, '0')
  return { code: normalized, raw: `(${normalized})` }
}

export async function listBanks(): Promise<BankInfo[]> {
  for (const { id, db } of directoryClients) {
    try {
      const snap = await getDocs(collection(db, 'bankAccount'))
      if (snap.empty) {
        continue
      }

      const byCode = new Map<string, BankInfo>()
      for (const d of snap.docs) {
        const data = d.data() as any
        const bankCode = String(data.bankCode || '').replace(/[^0-9]/g, '').padStart(3, '0')
        if (!bankCode) continue
        const bankName = typeof data.bankName === 'string' && data.bankName.trim().length > 0 ? data.bankName : ''
        const raw = `(${bankCode})`
        const key = `${bankCode}::${bankName}`
        if (!byCode.has(key)) {
          byCode.set(key, { bankCode, bankName, rawCodeSegment: raw })
        }
      }

      if (byCode.size > 0) {
        return Array.from(byCode.values()).sort((a, b) =>
          a.bankCode.localeCompare(b.bankCode, undefined, { numeric: true }),
        )
      }
    } catch (error) {
      logDirectoryWarning(id, 'bank directory failed', error)
    }
  }

  return []
}

export async function listAccounts(bank: BankInfo): Promise<AccountInfo[]> {
  for (const { id, db } of directoryClients) {
    try {
      const q = query(collection(db, 'bankAccount'), where('bankCode', '==', bank.bankCode))
      const snap = await getDocs(q)
      if (snap.empty) {
        continue
      }

      const results = snap.docs
        .filter((d) => {
          const data = d.data() as any
          if (bank.bankName) {
            const name = typeof data.bankName === 'string' ? data.bankName : ''
            return name === bank.bankName
          }
          return true
        })
        .map((d) => {
          const data = d.data() as any
          const number = data.accountNumber || data.accountNo || data.acctNumber || data.number
          return { accountDocId: d.id, accountType: data.accountType, accountNumber: number }
        })

      if (results.length > 0) {
        return results
      }
    } catch (error) {
      logDirectoryWarning(id, 'accounts load failed', error)
    }
  }

  return []
}

export async function lookupAccount(
  id: string,
): Promise<
  | {
      bankName: string
      bankCode: string
      accountType?: string
      accountNumber?: string
    }
  | null
> {
  for (const { id: dbId, db } of directoryClients) {
    try {
      const snap = await getDoc(doc(db, 'bankAccount', id))
      if (!snap.exists()) {
        continue
      }
      const data = snap.data() as any
      const number = data.accountNumber || data.accountNo || data.acctNumber || data.number
      const bankCode = String(data.bankCode || '').replace(/[^0-9]/g, '').padStart(3, '0')
      const bankName = typeof data.bankName === 'string' ? data.bankName : ''
      return {
        bankName,
        bankCode,
        accountType: data.accountType,
        accountNumber: number,
      }
    } catch (error) {
      logDirectoryWarning(dbId, 'lookup account failed', error)
    }
  }

  return null
}

/**
 * Resolve an invoice `paidTo` identifier into bank-account details efficiently.
 * Strategy:
 *   1) Try flat lookup: bankAccountLookup/{identifier}
 *   2) Fallback: direct doc get across bankAccount/{bankName}/({code})/{identifier}
 */
export async function resolveBankAccountIdentifier(
  identifier: string,
): Promise<
  | {
      bankName: string
      bankCode: string
      accountType?: string
      accountNumber?: string
      fpsId?: string | null
      fpsEmail?: string | null
      status?: boolean | null
    }
  | null
> {
  for (const { id: dbId, db } of directoryClients) {
    try {
      const flat = await getDoc(doc(db, 'bankAccount', identifier))
      if (!flat.exists()) {
        continue
      }
      const data = flat.data() as any
      return {
        bankName: data.bankName,
        bankCode: data.bankCode,
        accountType: data.accountType,
        accountNumber: data.accountNumber || data.accountNumberMasked,
        fpsId: data['FPS ID'] || data.fpsId || null,
        fpsEmail: data['FPS Email'] || data.fpsEmail || null,
        status: typeof data.status === 'boolean' ? data.status : null,
      }
    } catch (error) {
      logDirectoryWarning(dbId, 'bankAccount lookup failed', error)
    }
  }

  return null
}

export function buildBankLabel(b: BankInfo): string {
  if (b.bankName && b.bankCode) return `${b.bankName} (${b.bankCode})`
  return b.bankCode
}

export function maskAccountNumber(num?: string): string | undefined {
  if (!num) return undefined
  const digits = String(num).replace(/[^0-9]/g, '')
  if (!digits) return undefined
  return `\u2022\u2022\u2022\u2022${digits.slice(-4)}`
}

export function buildAccountLabel(a: AccountInfo): string {
  const num =
    a.accountNumber || a.accountNo || a.acctNumber || a.number || undefined
  const masked = maskAccountNumber(num)
  const type = a.accountType || 'N/A'
  return masked ? `${type} · ${masked}` : type
}
