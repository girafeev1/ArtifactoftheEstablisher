import { initializeFirestore, getFirestore, collection, getDocs } from 'firebase/firestore'
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
    return snap.docs.map((d) => ({
      bankCode: d.id,
      bankName: (d.data() as any)?.name,
      docId: d.id,
      collectionId: 'bankAccount',
    }))
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
  const snap = await getDocs(collection(dbDirectory, 'bankAccount', bankCode, 'accounts'))
  return snap.docs.map((d) => ({ accountDocId: d.id, ...(d.data() as any) }))
}

export function buildBankLabel(b: BankInfo): string {
  if (b.bankName && b.bankCode) return `${b.bankName} ${b.bankCode}`
  const fallback = `${b.docId ?? ''} ${b.collectionId ?? ''}`.trim()
  return fallback || b.bankCode
}
