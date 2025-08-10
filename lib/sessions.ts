import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import { PATHS, logPath } from './paths'

export const computeSessionStart = async (
  sessionId: string,
  snapshotData?: any,
): Promise<Date | null> => {
  // Load a minimal history to resolve reschedules
  const histPath = PATHS.sessionHistory(sessionId)
  logPath('sessionHistory', histPath)
  const [histSnap] = await Promise.all([
    getDocs(collection(db, histPath)),
  ])
  const hist = histSnap.docs
    .map((d) => d.data() as any)
    .sort((a, b) => {
      const ta = a.timestamp?.toDate?.() ?? new Date(0)
      const tb = b.timestamp?.toDate?.() ?? new Date(0)
      return tb.getTime() - ta.getTime()
    })[0]

  let start: any = snapshotData?.origStartTimestamp
  if (hist?.newStartTimestamp != null) start = hist.newStartTimestamp

  const d = start?.toDate ? start.toDate() : new Date(start)
  return d && !isNaN(d.getTime()) ? d : null
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })

export const fmtTime = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

