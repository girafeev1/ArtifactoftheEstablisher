import { getFirestore, collection, getDocs } from 'firebase/firestore'
import { app } from './firebase'
import { doc, getDoc } from 'firebase/firestore'

export type SubsidiaryDoc = {
  identifier: string
  englishName?: string
  chineseName?: string
  addressLine1?: string
  addressLine2?: string
  addressLine3?: string
  region?: string
  email?: string
  phone?: string
  brNumber?: string  // Business Registration Number
}

const AOTE_REF_DB_ID = 'aote-ref'

const refDb = getFirestore(app, AOTE_REF_DB_ID)

export async function fetchSubsidiaryById(id: string): Promise<SubsidiaryDoc | null> {
  try {
    const r = await getDoc(doc(refDb, 'Subsidiaries', id))
    if (!r.exists()) return null
    return (r.data() as SubsidiaryDoc) || null
  } catch {
    return null
  }
}

export async function fetchSubsidiaries(): Promise<SubsidiaryDoc[]> {
  try {
    const snapshot = await getDocs(collection(refDb, 'Subsidiaries'))
    return snapshot.docs.map(doc => ({ identifier: doc.id, ...doc.data() } as SubsidiaryDoc))
  } catch (err) {
    console.error(err)
    return []
  }
}