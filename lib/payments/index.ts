import { Timestamp } from 'firebase/firestore'
import { RetainerDoc } from './retainer'

export interface SessionInfo {
  id: string
  start: Date
  paymentAssigned?: boolean
}

/**
 * Return sessions eligible for manual payment assignment.
 * Excludes sessions already assigned a payment and those falling within any retainer period.
 */
export const filterEligibleSessions = (
  sessions: SessionInfo[],
  retainers: RetainerDoc[],
): SessionInfo[] => {
  const covered = retainers.map((r) => ({
    start: r.retainerStarts.toDate(),
    end: r.retainerEnds.toDate(),
  }))

  return sessions.filter((s) => {
    if (s.paymentAssigned) return false
    return !covered.some(
      (p) => s.start >= p.start && s.start <= p.end,
    )
  })
}
