export interface BillingRow {
  amountDue?: number
  flags: {
    cancelled?: boolean
    voucherUsed?: boolean
    inRetainer?: boolean
  }
  assignedPaymentId?: string | null
}

export function minUnpaidRate(rows: BillingRow[]): number | null {
  const amounts = rows
    .filter(
      (r) =>
        !r.flags?.cancelled &&
        !r.flags?.voucherUsed &&
        !r.flags?.inRetainer &&
        !r.assignedPaymentId,
    )
    .map((r) => Number(r.amountDue) || 0)
    .filter((n) => n > 0)
  return amounts.length ? Math.min(...amounts) : null
}
