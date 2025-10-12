import { initializeFirestore, getFirestore, collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore'
import { app, DIRECTORY_FIRESTORE_DATABASE_ID } from './firebase'

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

export const dbDirectory = (() => {
  try {
    return getFirestore(app, DIRECTORY_FIRESTORE_DATABASE_ID)
  } catch {
    return initializeFirestore(app, {}, DIRECTORY_FIRESTORE_DATABASE_ID)
  }
})()

export function normalizeCode(code: string | number): { code: string; raw: string } {
  const digits = typeof code === 'number' ? String(code) : String(code)
  const num = digits.replace(/[^0-9]/g, '')
  const normalized = num.padStart(3, '0')
  return { code: normalized, raw: `(${normalized})` }
}

export async function listBanks(): Promise<BankInfo[]> {
  try {
    // Flat structure: bankAccount/{identifier} with fields: bankName, bankCode, ...
    const snap = await getDocs(collection(dbDirectory, 'bankAccount'))
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
    return Array.from(byCode.values()).sort((a, b) =>
      a.bankCode.localeCompare(b.bankCode, undefined, { numeric: true })
    )
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('bank directory failed', e)
    }
    return []
  }
}

export async function listAccounts(bank: BankInfo): Promise<AccountInfo[]> {
  try {
    // Flat structure: bankAccount/{identifier} with fields including bankCode/bankName
    const q = query(
      collection(dbDirectory, 'bankAccount'),
      where('bankCode', '==', bank.bankCode)
    )
    const snap = await getDocs(q)
    return snap.docs
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
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('accounts load failed', e)
    }
    return []
  }
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
  // Flat lookup by identifier
  const ref = doc(dbDirectory, 'bankAccount', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
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
  // 1) Flat lookup (preferred) — now under 'bankAccount'
  try {
    const flat = await getDoc(doc(dbDirectory, 'bankAccount', identifier))
    if (flat.exists()) {
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
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('bankAccountLookup read failed', e)
    }
  }

  // 2) Not found
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
