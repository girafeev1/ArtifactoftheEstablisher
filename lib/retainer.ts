// lib/retainer.ts

import {
  collection,
  doc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export interface RetainerDoc {
  retainerStarts: Timestamp
  retainerEnds: Timestamp
  retainerRate: number
  timestamp: Timestamp
  editedBy?: string
}

/**
 * Calculate the end date for a retainer given a start date. The end date is the
 * same day in the following month. If the start date is the final day of the
 * month the end date will also be the final day of the next month.
 */
export const calculateEndDate = (start: Date): Date => {
  const year = start.getFullYear()
  const month = start.getMonth()
  const day = start.getDate()

  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate()
  const daysInNextMonth = new Date(year, month + 2, 0).getDate()

  const isLastDay = day === daysInCurrentMonth
  const endDay = isLastDay ? daysInNextMonth : Math.min(day, daysInNextMonth)

  return new Date(year, month + 1, endDay)
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

  const endDate = calculateEndDate(startDate)
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

