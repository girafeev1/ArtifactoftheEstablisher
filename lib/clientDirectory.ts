// lib/clientDirectory.ts

import {
  Timestamp,
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
import { fetchProjectsFromDatabase } from './projectsDatabase'

export interface ClientDirectoryRecord {
  documentId: string
  companyName: string
  title: string | null
  representative: string | null
  email: string | null
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  addressLine4: string | null
  addressLine5: string | null
  region: string | null
  createdAt: string | null
  hasOverduePayment: boolean
}

const sanitizeString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

const normalizeCompanyKey = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed.toLowerCase() : null
}

const computeOverdueCompanySet = async (): Promise<Set<string>> => {
  try {
    const { projects } = await fetchProjectsFromDatabase()
    const overdue = new Set<string>()

    projects.forEach((project) => {
      if (project.paid === false) {
        const key = normalizeCompanyKey(project.clientCompany)
        if (key) {
          overdue.add(key)
        }
      }
    })

    return overdue
  } catch (error) {
    console.error('[client-directory] Failed to compute payment diagnostics from projects database', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    })
    return new Set<string>()
  }
}

export const fetchClientsDirectory = async (): Promise<ClientDirectoryRecord[]> => {
  console.info('[client-directory] Fetching clients from Firestore', {
    databaseId: 'epl-directory',
  })

  try {
    const directoryDb = getFirestoreForDatabase('epl-directory')
    const [overdueCompanies, snap] = await Promise.all([
      computeOverdueCompanySet(),
      getDocs(collection(directoryDb, 'clients')),
    ])

    const records: ClientDirectoryRecord[] = snap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>
      const documentId = doc.id
      const companyName = sanitizeString(data.companyName) ?? doc.id
      const title = sanitizeString(data.title)
      let representative = sanitizeString(data.representative)

      if (title && representative) {
        const normalizedTitle = title.toLowerCase()
        if (representative.toLowerCase().startsWith(normalizedTitle)) {
          representative = representative.slice(title.length).trimStart()
        }
      }

      let createdAt: string | null = null
      const rawCreatedAt = data.createdAt
      if (rawCreatedAt instanceof Timestamp) {
        createdAt = rawCreatedAt.toDate().toISOString()
      } else if (typeof rawCreatedAt === 'string') {
        const parsed = new Date(rawCreatedAt)
        createdAt = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
      }

      return {
        documentId,
        companyName,
        title,
        representative,
        email: sanitizeString(data.email) ?? sanitizeString(data.emailAddress),
        phone: sanitizeString(data.phone),
        addressLine1: sanitizeString(data.addressLine1),
        addressLine2: sanitizeString(data.addressLine2),
        addressLine3: sanitizeString(data.addressLine3),
        addressLine4: sanitizeString(data.addressLine4),
        addressLine5: sanitizeString(data.addressLine5) ?? sanitizeString(data.region),
        region: sanitizeString(data.region),
        createdAt,
        hasOverduePayment: false,
      }
    })

    const sorted = records.sort((a, b) => a.companyName.localeCompare(b.companyName))
    const enriched = sorted.map((record) => {
      const key =
        normalizeCompanyKey(record.companyName) ?? normalizeCompanyKey(record.documentId)
      return {
        ...record,
        hasOverduePayment: key ? overdueCompanies.has(key) : false,
      }
    })

    console.info('[client-directory] Successfully fetched clients', {
      count: enriched.length,
      overdueCompanies: overdueCompanies.size,
    })

    return enriched
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
  representative?: string | null
  email?: string | null
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
  const representative =
    sanitizeWriteValue(input.representative) ?? sanitizeWriteValue(options?.fallbackName)

  return {
    companyName: sanitizeWriteValue(input.companyName) ?? '',
    title: sanitizeWriteValue(input.title),
    representative,
    email: sanitizeWriteValue(input.email),
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
