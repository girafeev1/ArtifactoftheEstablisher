// lib/clientDirectory.ts

import { collection, getDocs } from 'firebase/firestore'

import { getFirestoreForDatabase } from './firebase'

export interface ClientDirectoryRecord {
  companyName: string
  title: string | null
  name: string | null
  nameAddressed: string | null
  emailAddress: string | null
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  addressLine4: string | null
  addressLine5: string | null
  region: string | null
}

const sanitizeString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

export const fetchClientsDirectory = async (): Promise<ClientDirectoryRecord[]> => {
  const directoryDb = getFirestoreForDatabase('epl-directory')
  const snap = await getDocs(collection(directoryDb, 'clients'))

  const records: ClientDirectoryRecord[] = snap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>
    const companyName = sanitizeString(data.companyName) ?? doc.id
    const title = sanitizeString(data.title)
    const name = sanitizeString(data.name)

    return {
      companyName,
      title,
      name,
      nameAddressed:
        sanitizeString(data.nameAddressed) ??
        (([title, name].filter(Boolean).join(' ') || null) as string | null),
      emailAddress: sanitizeString(data.email) ?? sanitizeString(data.emailAddress),
      phone: sanitizeString(data.phone),
      addressLine1: sanitizeString(data.addressLine1),
      addressLine2: sanitizeString(data.addressLine2),
      addressLine3: sanitizeString(data.addressLine3),
      addressLine4: sanitizeString(data.addressLine4),
      addressLine5: sanitizeString(data.addressLine5),
      region: sanitizeString(data.region),
    }
  })

  return records.sort((a, b) => a.companyName.localeCompare(b.companyName))
}
