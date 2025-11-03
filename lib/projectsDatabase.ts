// lib/projectsDatabase.ts

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'

import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from './firebase'
import { listInvoiceCollectionIds } from './projectInvoices'

const YEAR_ID_PATTERN = /^\d{4}$/
const FALLBACK_YEAR_IDS = ['2025', '2024', '2023', '2022', '2021']

// New nested layout (preferred):
// projects/{year}/projects/{projectId}
const PROJECTS_ROOT = 'projects'
const PROJECTS_SUBCOLLECTION = 'projects'

const POSITIVE_PAYMENT_EXACT = new Set([
  'paid',
  'cleared',
  'received',
  'settled',
  'complete',
  'completed',
  'true',
  'yes',
  '1',
  'paid in full',
  'no payment due',
  'not due',
])

const NEGATIVE_PAYMENT_EXACT = new Set([
  'due',
  'payment due',
  'past due',
  'unpaid',
  'pending',
  'outstanding',
  'overdue',
  'awaiting payment',
  'awaiting',
  'incomplete',
  'draft',
  'partial',
  'false',
  'no',
  '0',
])

const POSITIVE_PAYMENT_KEYWORDS = ['paid', 'cleared', 'received', 'settled', 'complete']
const NEGATIVE_PAYMENT_KEYWORDS = ['due', 'unpaid', 'outstanding', 'pending', 'overdue', 'awaiting', 'incomplete', 'partial']

interface ListCollectionIdsResponse {
  collectionIds?: string[]
  error?: { message?: string }
}

export interface ProjectRecord {
  id: string
  year: string
  amount: number | null
  clientCompany: string | null
  invoice: string | null
  onDateDisplay: string | null
  onDateIso: string | null
  paid: boolean | null
  paidTo: string | null
  paymentStatus: string | null
  presenterWorkType: string | null
  projectDateDisplay: string | null
  projectDateIso: string | null
  projectNature: string | null
  projectNumber: string
  projectTitle: string | null
  subsidiary: string | null
}

export interface ProjectsDatabaseResult {
  projects: ProjectRecord[]
  years: string[]
}

export interface ProjectUpdateInput {
  year: string
  projectId: string
  updates: Partial<ProjectRecord>
  editedBy: string
}

export interface ProjectUpdateResult {
  updatedFields: string[]
}

export interface ProjectCreateInput {
  year: string
  data: Record<string, unknown>
  createdBy: string
}

export interface ProjectCreateResult {
  project: ProjectRecord
}

export interface ProjectDeleteInput {
  year: string
  projectId: string
}

export interface ProjectDeleteResult {
  deleted: boolean
}

const toTimestamp = (value: unknown): Timestamp | null => {
  if (value instanceof Timestamp) {
    return value
  }
  if (
    value &&
    typeof value === 'object' &&
    'seconds' in value &&
    'nanoseconds' in value &&
    typeof (value as any).seconds === 'number' &&
    typeof (value as any).nanoseconds === 'number'
  ) {
    return new Timestamp((value as any).seconds, (value as any).nanoseconds)
  }
  return null
}

const toDate = (value: unknown): Date | null => {
  const ts = toTimestamp(value)
  if (ts) {
    const date = ts.toDate()
    return isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string' || value instanceof String) {
    const parsed = new Date(value as string)
    return isNaN(parsed.getTime()) ? null : parsed
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }
  return null
}

const formatDisplayDate = (value: unknown): string | null => {
  const date = toDate(value)
  if (!date) return null
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

const toIsoDate = (value: unknown): string | null => {
  const date = toDate(value)
  if (!date) return null
  return date.toISOString()
}

const toStringValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value.trim() || null
  }
  if (value instanceof String) {
    const trimmed = value.toString().trim()
    return trimmed || null
  }
  return null
}

const toNumberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const inferBooleanFromString = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  if (POSITIVE_PAYMENT_EXACT.has(normalized)) {
    return true
  }
  if (NEGATIVE_PAYMENT_EXACT.has(normalized)) {
    return false
  }
  if (POSITIVE_PAYMENT_KEYWORDS.some((token) => normalized.includes(token))) {
    return true
  }
  if (NEGATIVE_PAYMENT_KEYWORDS.some((token) => normalized.includes(token))) {
    return false
  }
  return null
}

export const resolvePaymentStatusFlag = (value: string | null | undefined): boolean | null => {
  if (!value) {
    return null
  }
  return inferBooleanFromString(value)
}

const toBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
    return null
  }
  if (typeof value === 'string' || value instanceof String) {
    const inferred = inferBooleanFromString(value.toString())
    if (inferred !== null) {
      return inferred
    }
  }
  return null
}

const normalizePaymentStatus = (value: unknown): string | null => {
  const raw = toStringValue(value)
  if (!raw) {
    return null
  }
  return raw.replace(/\s+/g, ' ').trim()
}

const buildProjectRecord = (
  year: string,
  id: string,
  data: Record<string, unknown>
): ProjectRecord => {
  const projectNumber = toStringValue(data.projectNumber) ?? id

  const amount = toNumberValue(data.amount)
  const projectDateIso = toIsoDate(data.projectDate)
  const projectDateDisplay = formatDisplayDate(data.projectDate)
  const onDateIso = toIsoDate(data.onDate)
  const onDateDisplay = formatDisplayDate(data.onDate)
  const paymentStatus = normalizePaymentStatus(
    (data.paymentStatus ??
      data.status ??
      data.invoiceStatus ??
      (data as Record<string, unknown>).paymentStatusLabel) ??
      null,
  )

  return {
    id,
    year,
    amount,
    clientCompany: toStringValue(data.clientCompany),
    invoice: toStringValue(data.invoice),
    onDateDisplay,
    onDateIso,
    paid: toBooleanValue(data.paid),
    paidTo: toStringValue(data.paidTo),
    paymentStatus,
    presenterWorkType: toStringValue(data.presenterWorkType),
    projectDateDisplay,
    projectDateIso,
    projectNature: toStringValue(data.projectNature),
    projectNumber,
    projectTitle: toStringValue(data.projectTitle),
    subsidiary: toStringValue(data.subsidiary),
  }
}

export const isProjectOverdue = (project: ProjectRecord): boolean => {
  if (project.paid === true) {
    return false
  }
  if (project.paid === false) {
    return true
  }
  const statusFlag = resolvePaymentStatusFlag(project.paymentStatus)
  if (statusFlag !== null) {
    return statusFlag === false
  }
  return false
}

export const __projectsDatabaseInternals = {
  toBooleanValue,
  resolvePaymentStatusFlag,
  isProjectOverdue,
}

const uniqueSortedYears = (values: Iterable<string>) =>
  Array.from(new Set(values)).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true })
  )

const listYearCollections = async (): Promise<string[]> => {
  // Try preferred nested layout first: projects/{year}/projects/{projectId}
  try {
    const yearsSnap = await getDocs(collection(projectsDb, PROJECTS_ROOT))
    const nestedYears =
      yearsSnap.docs
        .map((d) => d.id)
        .filter((id) => YEAR_ID_PATTERN.test(id))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })) ?? []
    if (nestedYears.length > 0) {
      return nestedYears
    }
  } catch (e) {
    // continue to fallback
    console.warn('[projectsDatabase] nested year discovery failed, falling back', e)
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  if (!apiKey || !projectId) {
    console.warn('[projectsDatabase] Missing Firebase configuration, falling back to defaults')
    return [...FALLBACK_YEAR_IDS]
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents:listCollectionIds?key=${apiKey}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent: `projects/${projectId}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents`,
        pageSize: 200,
      }),
    })

    if (!response.ok) {
      console.warn('[projectsDatabase] Failed to list collection IDs:', response.status, response.statusText)
      return [...FALLBACK_YEAR_IDS]
    }

    const json = (await response.json()) as ListCollectionIdsResponse
    if (json.error) {
      console.warn('[projectsDatabase] Firestore responded with error:', json.error.message)
      return [...FALLBACK_YEAR_IDS]
    }

    const ids = json.collectionIds?.filter((id) => YEAR_ID_PATTERN.test(id)) ?? []
    if (ids.length === 0) {
      console.warn('[projectsDatabase] No year collections found, falling back to defaults')
      return [...FALLBACK_YEAR_IDS]
    }
    return uniqueSortedYears(ids)
  } catch (err) {
    console.warn('[projectsDatabase] listYearCollections failed:', err)
    return [...FALLBACK_YEAR_IDS]
  }
}

export const fetchProjectsFromDatabase = async (): Promise<ProjectsDatabaseResult> => {
  const yearIds = await listYearCollections()
  const projects: ProjectRecord[] = []
  const yearsWithData = new Set<string>()

  await Promise.all(
    yearIds.map(async (year) => {
      // Prefer nested layout
      let snapshot
      try {
        snapshot = await getDocs(collection(projectsDb, PROJECTS_ROOT, year, PROJECTS_SUBCOLLECTION))
      } catch {
        snapshot = null as any
      }
      if (snapshot && !snapshot.empty) {
        snapshot.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>
          projects.push(buildProjectRecord(year, doc.id, data))
          yearsWithData.add(year)
        })
      } else {
        // Fallback: legacy root-level year collections
        const legacy = await getDocs(collection(projectsDb, year))
        legacy.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>
          projects.push(buildProjectRecord(year, doc.id, data))
          yearsWithData.add(year)
        })
      }
    })
  )

  projects.sort((a, b) => {
    if (a.year !== b.year) {
      return b.year.localeCompare(a.year, undefined, { numeric: true })
    }
    return a.projectNumber.localeCompare(b.projectNumber, undefined, { numeric: true })
  })

  return {
    projects,
    years: uniqueSortedYears(yearsWithData),
  }
}

const UPDATE_LOG_COLLECTION = 'updateLogs'

const READ_ONLY_FIELDS = new Set(['id', 'year'])

const normalizeTimestampInput = (value: unknown) => {
  if (value == null) {
    return null
  }

  if (value instanceof Timestamp) {
    return value
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    'nanoseconds' in value &&
    typeof (value as any).seconds === 'number' &&
    typeof (value as any).nanoseconds === 'number'
  ) {
    return new Timestamp((value as any).seconds, (value as any).nanoseconds)
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return Timestamp.fromDate(parsed)
    }
    return value
  }

  return value
}

const sanitizeUpdates = (updates: Partial<ProjectRecord>) => {
  const payload: Record<string, unknown> = {}
  const disallowed = new Set([
    'invoice',
    'onDate',
    'paid',
    'paidTo',
    'clientCompany',
  ])
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || READ_ONLY_FIELDS.has(key) || disallowed.has(key)) {
      return
    }

    if (key === 'projectDate' || key === 'onDate') {
      payload[key] = normalizeTimestampInput(value)
      return
    }

    if (key === 'projectNumber' && typeof value === 'string') {
      payload[key] = value.replace(/^#/, '').trim()
      return
    }

    payload[key] = value
  })
  return payload
}

export const createProjectInDatabase = async ({
  year,
  data,
  createdBy,
}: ProjectCreateInput): Promise<ProjectCreateResult> => {
  const trimmedYear = year.trim()
  if (!YEAR_ID_PATTERN.test(trimmedYear)) {
    throw new Error('Invalid year identifier provided')
  }

  const rawProjectNumber = (data as Record<string, unknown>).projectNumber
  const projectNumber =
    typeof rawProjectNumber === 'string'
      ? rawProjectNumber.replace(/^#/, '').trim()
      : rawProjectNumber instanceof String
      ? rawProjectNumber.toString().replace(/^#/, '').trim()
      : null

  if (!projectNumber) {
    throw new Error('Project number is required')
  }

  // Write under nested path; ensure we don't collide with existing
  const nestedCollection = collection(projectsDb, PROJECTS_ROOT, trimmedYear, PROJECTS_SUBCOLLECTION)
  const projectRef = doc(nestedCollection, projectNumber)
  const [nestedExisting, legacyExisting] = await Promise.all([
    getDoc(projectRef),
    getDoc(doc(projectsDb, trimmedYear, projectNumber)),
  ])
  if (nestedExisting.exists() || legacyExisting.exists()) {
    throw new Error('A project with this number already exists')
  }

  const sanitized = sanitizeUpdates({
    ...(data as Partial<ProjectRecord>),
    projectNumber,
  }) as Partial<ProjectRecord> & Record<string, unknown>

  const timestamp = serverTimestamp()
  const baseDefaults: Record<string, unknown> = {
    projectTitle: null,
    projectNature: null,
    amount: null,
    // moved to invoice subcollections
    presenterWorkType: null,
    subsidiary: null,
    projectDate: null,
  }

  const docPayload: Record<string, unknown> = {
    ...baseDefaults,
    ...sanitized,
    projectNumber,
    paid: sanitized.paid ?? false,
    projectDate: sanitized.projectDate ?? null,
    onDate: sanitized.onDate ?? null,
    createdBy,
    createdAt: timestamp,
  }

  await setDoc(projectRef, docPayload)

  const logsCollection = collection(projectRef, UPDATE_LOG_COLLECTION)
  await addDoc(logsCollection, {
    field: 'created',
    editedBy: createdBy,
    timestamp: serverTimestamp(),
  })

  const snapshot = await getDoc(projectRef)
  if (!snapshot.exists()) {
    throw new Error('Failed to read created project')
  }

  const createdProject = buildProjectRecord(
    trimmedYear,
    snapshot.id,
    snapshot.data() as Record<string, unknown>
  )

  return {
    project: createdProject,
  }
}

const hasValueChanged = (current: unknown, next: unknown) => {
  if (current === next) {
    return false
  }
  if (current instanceof Timestamp && next instanceof Timestamp) {
    return current.toMillis() !== next.toMillis()
  }
  if (current instanceof Timestamp && typeof next === 'string') {
    const parsed = new Date(next)
    return parsed.getTime() !== current.toMillis()
  }
  if (typeof current === 'number' && typeof next === 'number') {
    return current !== next
  }
  if (typeof current === 'boolean' && typeof next === 'boolean') {
    return current !== next
  }
  if (current == null || next == null) {
    return current !== next
  }
  if (typeof current === 'object' && typeof next === 'object') {
    return JSON.stringify(current) !== JSON.stringify(next)
  }
  return current !== next
}

export const updateProjectInDatabase = async ({
  year,
  projectId,
  updates,
  editedBy,
}: ProjectUpdateInput): Promise<ProjectUpdateResult> => {
  const trimmedYear = year.trim()
  if (!YEAR_ID_PATTERN.test(trimmedYear)) {
    throw new Error('Invalid year identifier provided')
  }

  // Prefer nested doc; fallback to legacy path
  const nestedRef = doc(projectsDb, PROJECTS_ROOT, trimmedYear, PROJECTS_SUBCOLLECTION, projectId)
  let snapshot = await getDoc(nestedRef)
  const projectRef = snapshot.exists() ? nestedRef : doc(projectsDb, trimmedYear, projectId)
  if (!snapshot.exists()) {
    snapshot = await getDoc(projectRef)
  }
  if (!snapshot.exists()) {
    throw new Error('Project record not found')
  }

  const currentData = snapshot.data() as Record<string, unknown>
  const sanitized = sanitizeUpdates(updates)

  const changedEntries = Object.entries(sanitized).filter(([field, value]) =>
    hasValueChanged(currentData[field], value)
  )

  if (changedEntries.length === 0) {
    return { updatedFields: [] }
  }

  const updatePayload = Object.fromEntries(changedEntries)

  await updateDoc(projectRef, updatePayload)

  const logsCollection = collection(projectRef, UPDATE_LOG_COLLECTION)
  const logWrites = changedEntries.map(([field, newValue]) => {
    const oldValue = currentData[field]
    return addDoc(logsCollection, {
      field,
      oldValue,
      newValue,
      editedBy,
      timestamp: serverTimestamp(),
    })
  })

  await Promise.all(logWrites)

  return {
    updatedFields: changedEntries.map(([field]) => field),
  }
}

export const deleteProjectInDatabase = async ({ year, projectId }: ProjectDeleteInput): Promise<ProjectDeleteResult> => {
  const trimmedYear = year.trim()
  if (!YEAR_ID_PATTERN.test(trimmedYear)) {
    throw new Error('Invalid year identifier provided')
  }

  let projectRef = doc(projectsDb, PROJECTS_ROOT, trimmedYear, PROJECTS_SUBCOLLECTION, projectId)
  let snapshot = await getDoc(projectRef)
  if (!snapshot.exists()) {
    projectRef = doc(projectsDb, trimmedYear, projectId)
    snapshot = await getDoc(projectRef)
  }
  if (!snapshot.exists()) {
    return { deleted: false }
  }

  try {
    const collIds = await listInvoiceCollectionIds(trimmedYear, projectId)
    for (const cid of collIds) {
      const subRef = collection(projectRef, cid)
      const docs = await getDocs(subRef)
      for (const d of docs.docs) {
        await deleteDoc(d.ref).catch(() => {})
      }
    }
  } catch {}

  await deleteDoc(projectRef)
  return { deleted: true }
}
