export interface StudentSessionStats {
  jointDate: string
  lastSession: string
  totalSessions: number
}

import { collection, getDocs } from 'firebase/firestore'
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
