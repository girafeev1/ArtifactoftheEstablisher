import { initializeFirestore, getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { app } from './firebase'

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
    return getFirestore(app, 'erl-directory')
  } catch {
    return initializeFirestore(app, {}, 'erl-directory')
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
    const snap = await getDocs(collection(dbDirectory, 'bankAccount'))
    const banks: BankInfo[] = []
    snap.docs.forEach((d) => {
      const data = d.data() as any
      // In the actual directory, codes live as an array field and the bank name is the doc id.
      const codes = Array.isArray(data.code) ? data.code : [data.code].filter(Boolean)
      if (!codes.length) return
      for (const c of codes) {
        const { code, raw } = normalizeCode(c)
        banks.push({
          bankCode: code,
          bankName: data.name || d.id,
          rawCodeSegment: raw,
        })
      }
    })
    return banks
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('bank directory failed', e)
    }
    return []
  }
}

export async function listAccounts(bank: BankInfo): Promise<AccountInfo[]> {
  try {
    // Actual structure:
    // bankAccount/{bankName}/({code})/{identifier}
    const snap = await getDocs(collection(dbDirectory, 'bankAccount', bank.bankName, bank.rawCodeSegment))
    return snap.docs.map((d) => {
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
  // Fallback scan across banks/codes for the identifier
  const banks = await listBanks()
  for (const b of banks) {
    const ref = doc(dbDirectory, 'bankAccount', b.bankName, b.rawCodeSegment, id)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const data = snap.data() as any
      const number = data.accountNumber || data.accountNo || data.acctNumber || data.number
      return {
        bankName: b.bankName,
        bankCode: b.bankCode,
        accountType: data.accountType,
        accountNumber: number,
      }
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
      path: string
      accountType?: string
      accountNumber?: string
      fpsId?: string | null
      fpsEmail?: string | null
      status?: boolean | null
    }
  | null
> {
  // 1) Flat lookup (preferred)
  try {
    const flat = await getDoc(doc(dbDirectory, 'bankAccountLookup', identifier))
    if (flat.exists()) {
      const data = flat.data() as any
      return {
        bankName: data.bankName,
        bankCode: data.bankCode,
        path: typeof data.path === 'string' ? data.path : '',
        accountType: data.accountType,
        accountNumber: data.accountNumber,
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

  // 2) Fallback scan across banks/codes
  const banks = await listBanks()
  for (const b of banks) {
    const ref = doc(dbDirectory, 'bankAccount', b.bankName, b.rawCodeSegment, identifier)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const data = snap.data() as any
      const number = data.accountNumber || data.accountNo || data.acctNumber || data.number
      return {
        bankName: b.bankName,
        bankCode: b.bankCode,
        path: `bankAccount/${b.bankName}/${b.rawCodeSegment}/${identifier}`,
        accountType: data.accountType,
        accountNumber: number,
        fpsId: data['FPS ID'] || null,
        fpsEmail: data['FPS Email'] || null,
        status: typeof data.status === 'boolean' ? data.status : null,
      }
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
