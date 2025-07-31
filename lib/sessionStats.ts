export interface StudentSessionStats {
  jointDate: string
  lastSession: string
  totalSessions: number
}

import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export async function getStudentSessionStats(
  calendarEventIds: string[],
): Promise<StudentSessionStats> {
  const result: StudentSessionStats = {
    jointDate: 'N/A',
    lastSession: 'N/A',
    totalSessions: 0,
  }
  try {
    const allDates: Date[] = []
    await Promise.all(
      calendarEventIds.map(async (id) => {
        const histSnap = await getDocs(
          collection(db, 'Sessions', id, 'appointmentHistory'),
        )
        histSnap.forEach((doc) => {
          const ts = (doc.data() as any).newStartTimestamp
          const date: Date | undefined = ts?.toDate?.() ??
            (ts instanceof Date ? ts : undefined)
          if (date instanceof Date && !isNaN(date.getTime())) {
            allDates.push(date)
          }
        })
      }),
    )
    const now = new Date()
    const pastDates = allDates.filter((d) => d.getTime() <= now.getTime())
    if (pastDates.length > 0) {
      pastDates.sort((a, b) => a.getTime() - b.getTime())
      result.jointDate = pastDates[0].toISOString().slice(0, 10)
      result.lastSession = pastDates[pastDates.length - 1]
        .toISOString()
        .slice(0, 10)
      result.totalSessions = pastDates.length
    }
    return result
  } catch (err) {
    console.error('getStudentSessionStats failed', err)
    return { jointDate: 'Error', lastSession: 'Error', totalSessions: 0 }
  }
}

export async function scanAllSessionsForSummaryStats(): Promise<void> {
  try {
    const histSnap = await getDocs(collectionGroup(db, 'appointmentHistory'))
    const byAccount: Record<string, Date[]> = {}
    const now = new Date()
    histSnap.forEach((doc) => {
      const data = doc.data() as any
      const account = data.account
      const ts = data.newStartTimestamp
      const date: Date | undefined = ts?.toDate?.() ?? (ts instanceof Date ? ts : undefined)
      if (!account || !(date instanceof Date) || isNaN(date.getTime())) return
      if (date.getTime() > now.getTime()) return
      if (!byAccount[account]) byAccount[account] = []
      byAccount[account].push(date)
    })

    await Promise.all(
      Object.entries(byAccount).map(async ([account, dates]) => {
        dates.sort((a, b) => a.getTime() - b.getTime())
        const stats = {
          jointDate: dates[0].toISOString().slice(0, 10),
          lastSession: dates[dates.length - 1].toISOString().slice(0, 10),
          totalSessions: dates.length,
          lastUpdatedTimestamp: serverTimestamp(),
        }
        const studSnap = await getDocs(
          query(collection(db, 'Students'), where('account', '==', account)),
        )
        if (studSnap.empty) {
          console.warn(`No student found for account ${account}`)
          return
        }
        await Promise.all(studSnap.docs.map((d) => updateDoc(d.ref, stats)))
      }),
    )
  } catch (err) {
    console.error('scanAllSessionsForSummaryStats failed', err)
  }
}
