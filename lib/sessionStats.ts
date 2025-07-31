import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export async function scanSessionsAndUpdateStudents(): Promise<void> {
  try {
    const sessionsSnap = await getDocs(collection(db, 'Sessions'))
    const byAccount: Record<string, Date[]> = {}
    const now = new Date()

    await Promise.all(
      sessionsSnap.docs.map(async (sessionDoc) => {
        const account = (sessionDoc.data() as any).sessionName
        if (!account) return
        const histSnap = await getDocs(
          collection(db, 'Sessions', sessionDoc.id, 'appointmentHistory'),
        )
        histSnap.forEach((h) => {
          const data = h.data() as any
          const ts = data.newStartTimestamp || data.origStartTimestamp
          const date: Date | undefined = ts?.toDate?.() ?? (ts instanceof Date ? ts : undefined)
          if (!date || isNaN(date.getTime())) return
          if (date.getTime() > now.getTime()) return
          if (!byAccount[account]) byAccount[account] = []
          byAccount[account].push(date)
        })
      }),
    )

    await Promise.all(
      Object.entries(byAccount).map(async ([account, dates]) => {
        if (!dates.length) return
        dates.sort((a, b) => a.getTime() - b.getTime())
        const stats = {
          jointDate: dates[0].toISOString().slice(0, 10),
          lastSession: dates[dates.length - 1].toISOString().slice(0, 10),
          totalSessions: dates.length,
          summaryLastUpdated: serverTimestamp(),
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
    console.error('scanSessionsAndUpdateStudents failed', err)
  }
}
