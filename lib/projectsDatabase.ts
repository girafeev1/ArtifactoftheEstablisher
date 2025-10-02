// lib/projectsDatabase.ts

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'

import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from './firebase'

const YEAR_ID_PATTERN = /^\d{4}$/
const FALLBACK_YEAR_IDS = ['2025', '2024', '2023', '2022', '2021']

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

const toBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value
  }
  return null
}

const uniqueSortedYears = (values: Iterable<string>) =>
  Array.from(new Set(values)).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true })
  )

const listYearCollections = async (): Promise<string[]> => {
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
      const snapshot = await getDocs(collection(projectsDb, year))
      snapshot.forEach((doc) => {
        const data = doc.data() as Record<string, unknown>
        const projectNumber = toStringValue(data.projectNumber) ?? doc.id

        const amount = toNumberValue(data.amount)
        const projectDateIso = toIsoDate(data.projectDate)
        const projectDateDisplay = formatDisplayDate(data.projectDate)
        const onDateIso = toIsoDate(data.onDate)
        const onDateDisplay = formatDisplayDate(data.onDate)

        projects.push({
          id: doc.id,
          year,
          amount,
          clientCompany: toStringValue(data.clientCompany),
          invoice: toStringValue(data.invoice),
          onDateDisplay,
          onDateIso,
          paid: toBooleanValue(data.paid),
          paidTo: toStringValue(data.paidTo),
          presenterWorkType: toStringValue(data.presenterWorkType),
          projectDateDisplay,
          projectDateIso,
          projectNature: toStringValue(data.projectNature),
          projectNumber,
          projectTitle: toStringValue(data.projectTitle),
          subsidiary: toStringValue(data.subsidiary),
        })

        yearsWithData.add(year)
      })
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

const sanitizeUpdates = (updates: Partial<ProjectRecord>) => {
  const payload: Record<string, unknown> = {}
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && !READ_ONLY_FIELDS.has(key)) {
      payload[key] = value
    }
  })
  return payload
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

  const projectRef = doc(projectsDb, trimmedYear, projectId)
  const snapshot = await getDoc(projectRef)
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
  const logWrites = changedEntries.map(([field]) =>
    addDoc(logsCollection, {
      field,
      editedBy,
      timestamp: serverTimestamp(),
    })
  )

  await Promise.all(logWrites)

  return {
    updatedFields: changedEntries.map(([field]) => field),
  }
}
