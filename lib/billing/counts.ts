import { BillingResult } from './compute'

export function getCountsFromBilling(bill?: BillingResult | null) {
  if (!bill) return { total: 0, cancelled: 0 }
  const cancelled = bill.rows.filter(function (r) { return r.flags.cancelled }).length
  return { total: bill.rows.length, cancelled }
}
