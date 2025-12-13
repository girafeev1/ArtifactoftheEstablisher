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
      const ta =
        a.changeTimestamp?.toDate?.() ?? a.timestamp?.toDate?.() ?? new Date(0)
      const tb =
        b.changeTimestamp?.toDate?.() ?? b.timestamp?.toDate?.() ?? new Date(0)
      return tb.getTime() - ta.getTime()
    })[0]

  let start: any =
    hist?.newStartTimestamp ??
    hist?.origStartTimestamp ??
    snapshotData?.origStartTimestamp ??
    snapshotData?.sessionDate ??
    snapshotData?.startTimestamp

  const d = start?.toDate ? start.toDate() : new Date(start)
  return d && !isNaN(d.getTime()) ? d : null
}

