// lib/projectsDatabase.ts

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { app } from './firebase'

const PROJECTS_DATABASE_ID = 'epl-projects'

export const dbProjects = (() => {
  try {
    return getFirestore(app, PROJECTS_DATABASE_ID)
  } catch {
    return initializeFirestore(app, {}, PROJECTS_DATABASE_ID)
  }
})()

const FALLBACK_YEARS = (process.env.NEXT_PUBLIC_PROJECT_YEARS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

export interface FirestoreProjectRecord {
  id: string
  year: string
  projectNumber: string
  projectTitle: string
  clientCompany: string
  projectNature: string
  presenterWorkType: string
  subsidiary: string
  amount: number | null
  invoice: string
  paid: boolean | null
  paidTo: string
  projectDate: Date | null
  onDate: Date | null
  invoiceCompany?: string
}

function parseTimestamp(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) {
    return value.toDate()
  }
  if (value instanceof Date) {
    return value
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    'nanoseconds' in value
  ) {
    const seconds = (value as { seconds: number; nanoseconds: number }).seconds
    const nanoseconds = (value as { seconds: number; nanoseconds: number }).nanoseconds
    return Timestamp.fromMillis(seconds * 1000 + Math.floor(nanoseconds / 1_000_000)).toDate()
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return null
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }
  return null
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^\d.-]+/g, ''))
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

function parseProjectDocument(
  year: string,
  snapshot: QueryDocumentSnapshot,
): FirestoreProjectRecord {
  const data = snapshot.data() as Record<string, unknown>

  return {
    id: snapshot.id,
    year,
    projectNumber: typeof data.projectNumber === 'string' ? data.projectNumber : snapshot.id,
    projectTitle: typeof data.projectTitle === 'string' ? data.projectTitle : '',
    clientCompany: typeof data.clientCompany === 'string' ? data.clientCompany : '',
    projectNature: typeof data.projectNature === 'string' ? data.projectNature : '',
    presenterWorkType:
      typeof data.presenterWorkType === 'string' ? data.presenterWorkType : '',
    subsidiary: typeof data.subsidiary === 'string' ? data.subsidiary : '',
    amount: parseAmount(data.amount),
    invoice: typeof data.invoice === 'string' ? data.invoice : '',
    paid: parseBoolean(data.paid),
    paidTo: typeof data.paidTo === 'string' ? data.paidTo : '',
    projectDate: parseTimestamp(data.projectDate),
    onDate: parseTimestamp(data.onDate),
    invoiceCompany:
      typeof data.invoiceCompany === 'string' ? data.invoiceCompany : undefined,
  }
}

async function loadYearCollection(year: string) {
  const directSnapshot = await getDocs(collection(dbProjects, year))
  if (!directSnapshot.empty) {
    return directSnapshot
  }
  return getDocs(collection(dbProjects, 'data', year))
}

async function loadYearsFromMetadata(): Promise<string[]> {
  try {
    const metaDoc = await getDoc(doc(dbProjects, '__meta__', 'years'))
    if (!metaDoc.exists()) return []
    const data = metaDoc.data() as Record<string, unknown>
    const candidates = Array.isArray(data.list)
      ? data.list
      : Array.isArray(data.years)
        ? data.years
        : Array.isArray(data.values)
          ? data.values
          : []
    return candidates
      .map((value) => String(value).trim())
      .filter(Boolean)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Unable to load project years metadata:', error)
    }
    return []
  }
}

export async function fetchProjectYears(): Promise<string[]> {
  const fromMetadata = await loadYearsFromMetadata()
  const combined = new Set<string>([...fromMetadata, ...FALLBACK_YEARS])

  if (combined.size === 0) {
    combined.add('2025')
  }

  return Array.from(combined).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  )
}

export async function fetchProjectsForYear(
  year: string,
): Promise<FirestoreProjectRecord[]> {
  const snapshot = await loadYearCollection(year)
  return snapshot.docs
    .map((docSnapshot) => parseProjectDocument(year, docSnapshot))
    .sort((a, b) => a.projectNumber.localeCompare(b.projectNumber, undefined, { numeric: true }))
}

