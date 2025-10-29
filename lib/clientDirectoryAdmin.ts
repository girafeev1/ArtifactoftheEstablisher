// lib/clientDirectoryAdmin.ts
import { getAdminFirestore } from './firebaseAdmin'

export interface ClientDirectoryWriteInput {
  companyName?: string | null
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

const sanitize = (value: unknown): string | null => (typeof value === 'string' ? (value.trim() || null) : null)

const buildDoc = (input: ClientDirectoryWriteInput, fallbackName?: string) => ({
  companyName: sanitize(input.companyName) ?? sanitize(fallbackName) ?? '',
  title: sanitize(input.title),
  representative: sanitize(input.representative) ?? sanitize(fallbackName),
  email: sanitize(input.email),
  phone: sanitize(input.phone),
  addressLine1: sanitize(input.addressLine1),
  addressLine2: sanitize(input.addressLine2),
  addressLine3: sanitize(input.addressLine3),
  addressLine4: sanitize(input.addressLine4),
  addressLine5: sanitize(input.addressLine5) ?? sanitize(input.region),
  region: sanitize(input.region),
})

export async function addClientToDirectoryAdmin({
  client,
  createdBy,
}: {
  client: ClientDirectoryWriteInput
  createdBy: string
}) {
  const db = getAdminFirestore('epl-directory')
  const name = sanitize(client.companyName)
  if (!name) throw new Error('Company name is required')
  const docRef = db.collection('clients').doc(name)
  const snap = await docRef.get()
  if (snap.exists) throw new Error('Client already exists')
  const payload = buildDoc(client)
  await docRef.set({ ...payload, createdAt: new Date(), createdBy })
  await docRef.collection('updateLogs').add({ field: 'created', editedBy: createdBy, timestamp: new Date() })
  return { id: name }
}

export async function updateClientInDirectoryAdmin({
  id,
  updates,
  editedBy,
}: {
  id: string
  updates: ClientDirectoryWriteInput
  editedBy: string
}) {
  const db = getAdminFirestore('epl-directory')
  const docRef = db.collection('clients').doc(id)
  const snap = await docRef.get()
  if (!snap.exists) throw new Error('Client record not found')
  const current = snap.data() || {}
  const next = buildDoc({ ...updates, companyName: updates.companyName ?? id }, id)
  const changed: Record<string, any> = {}
  Object.entries(next).forEach(([k, v]) => {
    if ((current as any)[k] !== v) changed[k] = v
  })
  if (Object.keys(changed).length === 0) return { updatedFields: [] as string[] }
  await docRef.update(changed)
  const logRef = docRef.collection('updateLogs')
  await Promise.all(
    Object.keys(changed).map((field) =>
      logRef.add({ field, oldValue: (current as any)[field] ?? null, newValue: changed[field], editedBy, timestamp: new Date() }),
    ),
  )
  return { updatedFields: Object.keys(changed) }
}

