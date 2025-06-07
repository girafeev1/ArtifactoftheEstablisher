import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

export interface SubsidiaryData {
  identifier: string
  englishName: string
  chineseName: string
  email: string
  phone: string
  room: string
  building: string
  street: string
  district: string
  region: string
}

export async function fetchSubsidiaries(): Promise<SubsidiaryData[]> {
  const snap = await getDocs(collection(db, 'Subsidiaries'))
  return snap.docs.map(d => {
    const data = d.data() as any
    return {
      identifier: d.id,
      englishName: data.englishName || '',
      chineseName: data.chineseName || '',
      email: data.email || '',
      phone: data.phone || '',
      room: data.addressLine1 || '',
      building: data.addressLine2 || '',
      street: data.addressLine3 || '',
      district: data.addressLine4 || '',
      region: data.region || '',
    }
  })
}
