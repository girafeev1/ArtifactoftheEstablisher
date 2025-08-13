import { QueryClient } from '@tanstack/react-query'
import { billingKey } from './billing/useBilling'
import type { BillingResult } from './billing/compute'
import { writeBillingSummary } from './billing/useBilling'

export function patchBillingAssignedSessions(
  qc: QueryClient,
  abbr: string,
  account: string,
  addedSessionIds: string[],
  removedSessionIds: string[] = []
) {
  qc.setQueryData(billingKey(abbr, account), (prev?: BillingResult) => {
    if (!prev) return prev
    const addSet = new Set(addedSessionIds)
    const remSet = new Set(removedSessionIds)
    let balanceDue = prev.balanceDue || 0
    const rows = prev.rows.map((r) => {
      if (addSet.has(r.id) && !r.assignedPaymentId) {
        balanceDue -= r.amountDue || 0
        return { ...r, assignedPaymentId: 'assigned' }
      }
      if (remSet.has(r.id) && r.assignedPaymentId) {
        balanceDue += r.amountDue || 0
        return { ...r, assignedPaymentId: null }
      }
      return r
    })
    return { ...prev, rows, balanceDue: Math.max(0, balanceDue) }
  })
}

export async function writeSummaryFromCache(
  qc: QueryClient,
  abbr: string,
  account: string
) {
  const cached = qc.getQueryData(billingKey(abbr, account)) as
    | BillingResult
    | undefined
  if (cached) {
    await writeBillingSummary(abbr, cached)
  }
}

