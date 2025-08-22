import {
  initializeFirestore,
  getFirestore,
  collection,
  getDocs,
} from 'firebase/firestore'
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

export function buildAccountsPath(code: string | number): [string, string, string] {
  const { raw } = normalizeCode(code)
  return ['bankAccount', raw, 'accounts']
}

export async function listBanks(): Promise<BankInfo[]> {
  try {
    const snap = await getDocs(collection(dbDirectory, 'bankAccount'))
    const banks: BankInfo[] = []
    snap.docs.forEach((d) => {
      const data = d.data() as any
      if (!Array.isArray(data.code)) return
      data.code.forEach((c: any) => {
        const { code, raw } = normalizeCode(c)
        banks.push({ bankCode: code, bankName: data.name || d.id, rawCodeSegment: raw })
      })
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
    const snap = await getDocs(
      collection(dbDirectory, ...buildAccountsPath(bank.rawCodeSegment)),
    )
    return snap.docs.map((d) => {
      const data = d.data() as any
      const number =
        data.accountNumber || data.accountNo || data.acctNumber || data.number
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
  const banks = await listBanks()
  for (const b of banks) {
    const accounts = await listAccounts(b)
    const match = accounts.find((a) => a.accountDocId === id)
    if (match)
      return {
        bankName: b.bankName,
        bankCode: b.bankCode,
        accountType: match.accountType,
        accountNumber:
          match.accountNumber ||
          match.accountNo ||
          match.acctNumber ||
          match.number,
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
