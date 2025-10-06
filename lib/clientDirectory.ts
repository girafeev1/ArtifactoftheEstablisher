// lib/clientDirectory.ts

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

import { getFirestoreForDatabase, getFirebaseDiagnosticsSnapshot } from './firebase'

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
  console.info('[client-directory] Fetching clients from Firestore', {
    databaseId: 'epl-directory',
  })

  try {
    const directoryDb = getFirestoreForDatabase('epl-directory')
    const snap = await getDocs(collection(directoryDb, 'clients'))

    const records: ClientDirectoryRecord[] = snap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>
      const companyName = sanitizeString(data.companyName) ?? doc.id
      const title = sanitizeString(data.title)
      const name = sanitizeString(data.name)
      let nameAddressed = sanitizeString(data.nameAddressed)

      if (!nameAddressed) {
        nameAddressed = name ?? null
      }

      if (title && nameAddressed) {
        const normalizedTitle = title.toLowerCase()
        if (nameAddressed.toLowerCase().startsWith(normalizedTitle)) {
          nameAddressed = nameAddressed.slice(title.length).trimStart()
        }
      }

      return {
        companyName,
        title,
        name,
        nameAddressed,
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
  } catch (error) {
    const diagnostics = getFirebaseDiagnosticsSnapshot()
    console.error('[client-directory] Failed to fetch clients', {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { message: 'Unknown error', raw: error },
      firebase: diagnostics,
    })
    throw error
  }
}

export interface ClientDirectoryWriteInput {
  companyName: string
  title?: string | null
  name?: string | null
  nameAddressed?: string | null
  emailAddress?: string | null
  phone?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  addressLine3?: string | null
  addressLine4?: string | null
  addressLine5?: string | null
  region?: string | null
}

const CLIENT_COLLECTION = 'clients'
const CLIENT_LOG_COLLECTION = 'updateLogs'

const sanitizeWriteValue = (value: unknown): string | null => sanitizeString(value)

const buildClientDocument = (input: ClientDirectoryWriteInput, options?: { fallbackName?: string }) => {
  const name = sanitizeWriteValue(input.name)
  const nameAddressed =
    sanitizeWriteValue(input.nameAddressed) ?? name ?? sanitizeWriteValue(options?.fallbackName)

  return {
    companyName: sanitizeWriteValue(input.companyName) ?? '',
    title: sanitizeWriteValue(input.title),
    name: name ?? nameAddressed,
    nameAddressed,
    emailAddress: sanitizeWriteValue(input.emailAddress),
    phone: sanitizeWriteValue(input.phone),
    addressLine1: sanitizeWriteValue(input.addressLine1),
    addressLine2: sanitizeWriteValue(input.addressLine2),
    addressLine3: sanitizeWriteValue(input.addressLine3),
    addressLine4: sanitizeWriteValue(input.addressLine4),
    addressLine5: sanitizeWriteValue(input.addressLine5) ?? sanitizeWriteValue(input.region),
    region: sanitizeWriteValue(input.region),
  }
}

const hasValueChanged = (current: unknown, next: unknown) => {
  const currentNormal = current ?? null
  const nextNormal = next ?? null
  return currentNormal !== nextNormal
}

export const addClientToDirectory = async ({
  client,
  createdBy,
}: {
  client: ClientDirectoryWriteInput
  createdBy: string
}) => {
  const trimmedName = client.companyName?.trim()
  if (!trimmedName) {
    throw new Error('Company name is required')
  }

  const directoryDb = getFirestoreForDatabase('epl-directory')
  const docRef = doc(directoryDb, CLIENT_COLLECTION, trimmedName)
  const snapshot = await getDoc(docRef)

  if (snapshot.exists()) {
    throw new Error('Client already exists')
  }

  const payload = buildClientDocument(client)
  const timestamp = serverTimestamp()

  await setDoc(docRef, {
    ...payload,
    createdAt: timestamp,
    createdBy,
    updatedAt: timestamp,
    updatedBy: createdBy,
  })

  await addDoc(collection(docRef, CLIENT_LOG_COLLECTION), {
    field: 'created',
    editedBy: createdBy,
    timestamp: serverTimestamp(),
  })

  return { id: trimmedName }
}

export const updateClientInDirectory = async ({
  id,
  updates,
  editedBy,
}: {
  id: string
  updates: ClientDirectoryWriteInput
  editedBy: string
}) => {
  const directoryDb = getFirestoreForDatabase('epl-directory')
  const docRef = doc(directoryDb, CLIENT_COLLECTION, id)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    throw new Error('Client record not found')
  }

  const sanitized = buildClientDocument({ ...updates, companyName: updates.companyName ?? id })

  const updatePayload: Record<string, unknown> = {}
  const changedFields: string[] = []

  Object.entries(sanitized).forEach(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(updates, key)) {
      return
    }
    if (hasValueChanged(snapshot.get(key), value)) {
      updatePayload[key] = value
      changedFields.push(key)
    }
  })

  if (changedFields.length === 0) {
    return { updatedFields: [] as string[] }
  }

  updatePayload.updatedAt = serverTimestamp()
  updatePayload.updatedBy = editedBy

  await updateDoc(docRef, updatePayload)

  const logsCollection = collection(docRef, CLIENT_LOG_COLLECTION)
  await Promise.all(
    changedFields.map((field) =>
      addDoc(logsCollection, {
        field,
        editedBy,
        timestamp: serverTimestamp(),
      })
    )
  )

  return { updatedFields: changedFields }
}
