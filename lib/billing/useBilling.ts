// lib/billing/useBilling.ts
import { doc, setDoc } from 'firebase/firestore'
import { useQuery, QueryClient, useQueryClient } from '@tanstack/react-query'
import { db } from '../firebase'
import { PATHS } from '../paths'
import { buildContext, computeBilling, BillingResult } from './compute'

export const billingKey = (abbr: string, account: string) => ['billing', abbr, account]

export function useBilling(abbr: string, account: string) {
  return useQuery({
    queryKey: billingKey(abbr, account),
    queryFn: async () => {
      const ctx = await buildContext(abbr, account)
      return computeBilling(ctx)
    },
    staleTime: 0,
  })
}

// IMPORTANT: store summary as a field on the Student document
export async function writeBillingSummary(abbr: string, result: BillingResult) {
  await setDoc(
    doc(db, PATHS.student(abbr)),
    { billingSummary: {
        balanceDue: result.balanceDue,
        voucherBalance: result.voucherBalance,
        updatedAt: new Date(),
      }},
    { merge: true }
  )
}

export function invalidateBilling(abbr: string, account: string, qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: billingKey(abbr, account) })
}

export function useBillingClient() {
  return useQueryClient()
}

