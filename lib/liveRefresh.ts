import { QueryClient } from '@tanstack/react-query'
import { billingKey } from './billing/useBilling'
import type { BillingResult } from './billing/compute'
import { writeBillingSummary } from './billing/useBilling'
import { monthLabelFor } from './billing/monthLabel'

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

export function upsertUnpaidRetainerRow(
  qc: QueryClient,
  abbr: string,
  account: string,
  retainerId: string,
  startMs: number,
  endMs: number,
  rate: number,
  unpaid: boolean,
) {
  const monthLabel = monthLabelFor(startMs)
  qc.setQueryData(billingKey(abbr, account), (prev?: BillingResult) => {
    if (!prev) return prev
    let balanceDue = prev.balanceDue || 0
    let unpaidRetainers = prev.unpaidRetainers
    const exists = unpaidRetainers.find((r) => r.id === retainerId)
    if (unpaid && !exists) {
      unpaidRetainers = [...unpaidRetainers, { id: retainerId, monthLabel, rate }]
      balanceDue += rate
    }
    if (!unpaid && exists) {
      unpaidRetainers = unpaidRetainers.filter((r) => r.id !== retainerId)
      balanceDue = Math.max(0, balanceDue - (exists?.rate || 0))
    }
    return { ...prev, unpaidRetainers, balanceDue }
  })
}

export function markSessionsInRetainer(
  qc: QueryClient,
  abbr: string,
  account: string,
  startMs: number,
  endMs: number,
  inRetainer: boolean,
) {
  qc.setQueryData(billingKey(abbr, account), (prev?: BillingResult) => {
    if (!prev) return prev
    let balanceDue = prev.balanceDue || 0
    const rows = prev.rows.map((r) => {
      if (r.startMs >= startMs && r.startMs <= endMs) {
        if (!r.flags.cancelled && !r.flags.voucherUsed && !r.assignedPaymentId) {
          balanceDue += inRetainer ? -(r.amountDue || 0) : r.flags.inRetainer ? r.amountDue || 0 : 0
        }
        return { ...r, flags: { ...r.flags, inRetainer } }
      }
      return r
    })
    return { ...prev, rows, balanceDue: Math.max(0, balanceDue) }
  })
}

export function payRetainerPatch(
  qc: QueryClient,
  abbr: string,
  account: string,
  retainerId: string,
) {
  qc.setQueryData(billingKey(abbr, account), (prev?: BillingResult) => {
    if (!prev) return prev
    const unpaid = prev.unpaidRetainers
    const found = unpaid.find((r) => r.id === retainerId)
    if (!found) return prev
    const unpaidRetainers = unpaid.filter((r) => r.id !== retainerId)
    const balanceDue = Math.max(0, (prev.balanceDue || 0) - (found.rate || 0))
    return { ...prev, unpaidRetainers, balanceDue }
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

