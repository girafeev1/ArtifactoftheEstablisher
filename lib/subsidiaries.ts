import { getFirestore } from 'firebase/firestore'
import { app } from './firebase'
import { doc, getDoc } from 'firebase/firestore'

export type SubsidiaryDoc = {
  englishName?: string
  chineseName?: string
  addressLine1?: string
  addressLine2?: string
  addressLine3?: string
  region?: string
  email?: string
  phone?: string
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

