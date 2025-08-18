import { initializeFirestore, getFirestore, collection, getDocs } from 'firebase/firestore'
import { app } from './firebase'

export interface BankAccount {
  id: string
  accountType?: string
  [key: string]: any
}

export interface Bank {
  code: string
  name: string
  accounts: BankAccount[]
}

let bankCache: Bank[] | null = null

export const dbDirectory = (() => {
  try {
    return getFirestore(app, 'erl-directory')
  } catch {
    return initializeFirestore(app, {}, 'erl-directory')
  }
})()

export async function fetchBanks(): Promise<Bank[]> {
  if (bankCache) return bankCache
  try {
    const banksSnap = await getDocs(collection(dbDirectory, 'banks'))
    const banks: Bank[] = []
    for (const docSnap of banksSnap.docs) {
      const data = docSnap.data() as any
      const accountsSnap = await getDocs(collection(docSnap.ref, 'accounts'))
      const accounts: BankAccount[] = accountsSnap.docs.map((a) => ({
        id: a.id,
        ...(a.data() as any),
      }))
      banks.push({
        code: data.code || docSnap.id,
        name: data.name || docSnap.id,
        accounts,
      })
    }
    bankCache = banks
    return banks
  } catch (e) {
    console.warn('preferred bank directory failed', e)
    try {
      const legacySnap = await getDocs(collection(dbDirectory, 'bankAccount'))
      const banks: Bank[] = []
      for (const docSnap of legacySnap.docs) {
        const accountsSnap = await getDocs(collection(docSnap.ref, 'accounts'))
        const accounts: BankAccount[] = accountsSnap.docs.map((a) => ({
          id: a.id,
          ...(a.data() as any),
        }))
        banks.push({
          code: docSnap.id,
          name: docSnap.id,
          accounts,
        })
      }
      bankCache = banks
      return banks
    } catch (err) {
      console.error('bank directory unavailable', err)
      throw err
    }
  }
}

