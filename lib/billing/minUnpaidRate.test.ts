import { minUnpaidRate } from './minUnpaidRate'

test('computes smallest unpaid rate', () => {
  const rows = [
    { amountDue: 100, flags: {} },
    { amountDue: 50, flags: { voucherUsed: true } },
    { amountDue: 75, flags: {} },
    { amountDue: 20, flags: {}, assignedPaymentId: 'p1' },
  ] as any
  expect(minUnpaidRate(rows)).toBe(75)
})
