import {
  initializeFirestore,
  getFirestore,
  collection,
  collectionGroup,
  getDocs,
} from 'firebase/firestore'
import { app } from './firebase'

export interface BankInfo {
  bankCode: string
  bankName?: string
  docId?: string
  collectionId?: string
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

export async function listBanks(): Promise<BankInfo[]> {
  try {
    const snap = await getDocs(collection(dbDirectory, 'banks'))
    const banks = snap.docs.map((d) => {
      const data = d.data() as any
      return {
        bankCode: data.code || d.id,
        bankName: data.name,
        docId: d.id,
        collectionId: 'banks',
      } as BankInfo
    })
    if (banks.length) return banks
    throw new Error('empty banks collection')
  } catch (e) {
    console.warn('preferred bank directory failed', e)
    const snap = await getDocs(collection(dbDirectory, 'bankAccount'))
    const banks = snap.docs.map((d) => {
      const data = d.data() as any
      if (typeof data.code !== 'string')
        throw new Error(`missing code for bank ${d.id}`)
      return {
        bankCode: data.code,
        bankName: d.id,
        docId: d.id,
        collectionId: 'bankAccount',
      } as BankInfo
    })
    if (!banks.length) throw new Error('empty bankAccount directory')
    return banks
  }
}

export async function listAccounts(bankCode: string): Promise<AccountInfo[]> {
  try {
    const snap = await getDocs(collection(dbDirectory, 'banks', bankCode, 'accounts'))
    if (!snap.empty)
      return snap.docs.map((d) => ({ accountDocId: d.id, ...(d.data() as any) }))
  } catch (e) {
    console.warn('preferred accounts failed', e)
  }
  const snap = await getDocs(collectionGroup(dbDirectory, bankCode))
  return snap.docs
    .filter((d) => d.ref.path.includes('/bankAccount/'))
    .map((d) => ({ accountDocId: d.id, ...(d.data() as any) }))
}

export function buildBankLabel(b: BankInfo): string {
  if (b.bankName && b.bankCode) return `${b.bankName} ${b.bankCode}`
  const fallback = `${b.docId ?? ''} ${b.collectionId ?? ''}`.trim()
  return fallback || b.bankCode
}
