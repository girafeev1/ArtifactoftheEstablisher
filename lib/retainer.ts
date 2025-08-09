// lib/retainer.ts

import {
  collection,
  doc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { endOfNextMonthAligned, daysUntil, formatMMMDDYYYY } from './date'

export const calculateEndDate = endOfNextMonthAligned

export interface RetainerDoc {
  retainerStarts: Timestamp
  retainerEnds: Timestamp
  retainerRate: number
  timestamp: Timestamp
  editedBy?: string
}

export type RetainerStatusColor = 'green' | 'red' | 'lightBlue' | 'lightGreen'
export interface RetainerStatus {
  label: string
  color: RetainerStatusColor
}

/**
 * Add a retainer record for the given student. Throws an Error if the new
 * retainer period overlaps an existing one.
 */
export const addRetainer = async (
  abbr: string,
  start: Date,
  rate: number,
  editedBy = 'system',
): Promise<void> => {
  const startDate = new Date(start)
  startDate.setHours(0, 0, 0, 0)

  const endDate = endOfNextMonthAligned(startDate)
  endDate.setHours(23, 59, 59, 0)

  const retainersCol = collection(db, 'Students', abbr, 'Retainers')
  const existing = await getDocs(retainersCol)

  existing.forEach((d) => {
    const data = d.data() as RetainerDoc
    const s = data.retainerStarts.toDate()
    const e = data.retainerEnds.toDate()
    if (startDate <= e && endDate >= s) {
      throw new Error('Retainer period overlaps existing retainer')
    }
  })

  const idx = String(existing.size + 1).padStart(3, '0')
  const today = new Date()
  const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
  const docName = `${abbr}-RT-${idx}-${yyyyMMdd}`

  await setDoc(doc(retainersCol, docName), {
    retainerStarts: Timestamp.fromDate(startDate),
    retainerEnds: Timestamp.fromDate(endDate),
    retainerRate: rate,
    timestamp: Timestamp.fromDate(today),
    editedBy,
  })
}

/**
 * Compute the status label and color for a retainer, optionally considering the next retainer.
 */
export const getRetainerStatus = (
  retainer: RetainerDoc,
  today = new Date(),
  next?: RetainerDoc,
): RetainerStatus => {
  const start = retainer.retainerStarts.toDate()
  const end = retainer.retainerEnds.toDate()
  const daysToStart = daysUntil(start)
  const daysToEnd = daysUntil(end)

  // Upcoming
  if (daysToStart > 0) {
    let label: string
    if (daysToStart >= 6 && daysToStart <= 7)
      label = 'Starting in a week'
    else if (daysToStart >= 2)
      label = `Starting in ${daysToStart} days`
    else if (daysToStart === 1)
      label = 'Starting tomorrow'
    else label = 'Starting today'
    if (daysToStart > 7)
      label = `Upcoming retainer starts on ${formatMMMDDYYYY(start)}`
    return { label, color: 'lightBlue' }
  }

  // Active
  if (daysToEnd >= 0) {
    if (daysToEnd >= 6 && daysToEnd <= 7)
      return { label: 'Expiring in a week', color: 'red' }
    if (daysToEnd >= 2)
      return { label: `Expiring in ${daysToEnd} days`, color: 'red' }
    if (daysToEnd === 1)
      return { label: 'Expiring tomorrow', color: 'red' }
    if (daysToEnd === 0)
      return { label: 'Expiring today', color: 'red' }
    return { label: 'Active', color: 'green' }
  }

  // Expired
  if (next) {
    const nextStart = next.retainerStarts.toDate()
    const diff = daysUntil(nextStart)
    let label: string
    if (diff <= 7) {
      if (diff >= 6) label = 'Upcoming retainer starts in a week'
      else if (diff >= 2) label = `Upcoming retainer starts in ${diff} days`
      else if (diff === 1)
        label = 'Upcoming retainer starts tomorrow'
      else label = 'Upcoming retainer starts today'
    } else {
      label = `Upcoming retainer starts on ${formatMMMDDYYYY(nextStart)}`
    }
    return { label, color: 'lightGreen' }
  }

  return { label: 'Expired', color: 'red' }
}

/**
 * Fetch the most recent retainer for a student based on start date.
 */
export const getLatestRetainer = async (
  abbr: string,
): Promise<RetainerDoc | undefined> => {
  const snap = await getDocs(collection(db, 'Students', abbr, 'Retainers'))
  if (snap.empty) return undefined
  return snap.docs
    .map((d) => d.data() as RetainerDoc)
    .sort(
      (a, b) =>
        b.retainerStarts.toDate().getTime() -
        a.retainerStarts.toDate().getTime(),
    )[0]
}

