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
    const snap = await getDocs(collection(dbDirectory, 'banks'))
    const banks = snap.docs.map((d) => {
      const data = d.data() as any
      const { code, raw } = normalizeCode(d.id)
      return {
        bankCode: code,
        bankName: data.name || '',
        rawCodeSegment: raw,
      } as BankInfo
    })
    if (banks.length) return banks
    throw new Error('empty banks collection')
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('preferred bank directory failed', e)
    }
    const snap = await getDocs(collection(dbDirectory, 'bankAccount'))
    const banks: BankInfo[] = []
    snap.docs.forEach((d) => {
      const data = d.data() as any
      if (!Array.isArray(data.code))
        throw new Error(`missing code for bank ${d.id}`)
      ;[...new Set(data.code)].forEach((c: any) => {
        const { code, raw } = normalizeCode(c)
        banks.push({ bankCode: code, bankName: d.id, rawCodeSegment: raw })
      })
    })
    if (!banks.length) throw new Error('empty bankAccount directory')
    return banks
  }
}

export async function listAccounts(bank: BankInfo): Promise<AccountInfo[]> {
  const res: Record<string, AccountInfo> = {}
  try {
    const snap = await getDocs(
      collection(dbDirectory, 'banks', bank.bankCode, 'accounts'),
    )
    snap.docs.forEach((d) => {
      res[d.id] = { accountDocId: d.id, ...(d.data() as any) }
    })
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('preferred accounts failed', e)
    }
  }
  try {
    const snap = await getDocs(
      collection(
        dbDirectory,
        'bankAccount',
        bank.bankName,
        bank.rawCodeSegment,
      ),
    )
    snap.docs.forEach((d) => {
      if (!res[d.id]) res[d.id] = { accountDocId: d.id, ...(d.data() as any) }
    })
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('legacy accounts failed', e)
    }
  }
  return Object.values(res)
}

export function buildBankLabel(b: BankInfo): string {
  if (b.bankName && b.bankCode) return `${b.bankName} (${b.bankCode})`
  return b.bankCode
}
