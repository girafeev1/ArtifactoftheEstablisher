import { doc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { PATHS } from './paths'
import { buildContext, computeBilling } from './billing/compute'

export interface StudentSummary {
  jointDateISO: string | null
  lastSessionISO: string | null
  totalSessionsExCancelled: number
  cancelledCount: number
}

export async function computeStudentSummary(abbr: string, account: string): Promise<StudentSummary> {
  const ctx = await buildContext(abbr, account)
  const res = computeBilling(ctx)
  const rows = res.rows
  const sorted = rows.slice().sort((a, b) => a.startMs - b.startMs)
  const joint = sorted[0]?.startMs
  const nonCancelled = rows.filter((r) => !r.flags.cancelled)
  const last = nonCancelled.length ? Math.max(...nonCancelled.map((r) => r.startMs)) : undefined
  return {
    jointDateISO: joint ? new Date(joint).toISOString() : null,
    lastSessionISO: last ? new Date(last).toISOString() : null,
    totalSessionsExCancelled: nonCancelled.length,
    cancelledCount: rows.length - nonCancelled.length,
  }
}

export async function writeStudentSummary(abbr: string, summary: StudentSummary) {
  await setDoc(
    doc(db, PATHS.student(abbr)),
    {
      cached: {
        jointDate: summary.jointDateISO,
        lastSession: summary.lastSessionISO,
        totalSessionsExCancelled: summary.totalSessionsExCancelled,
        cancelledCount: summary.cancelledCount,
        updatedAt: new Date().toISOString(),
      },
    },
    { merge: true },
  )
}

