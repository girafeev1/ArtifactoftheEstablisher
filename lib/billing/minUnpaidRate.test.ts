import { minUnpaidRate } from './minUnpaidRate'

describe('minUnpaidRate', () => {
  test('ignores paid or voucher sessions', () => {
    const rows = [
      { amountDue: 100, flags: {} },
      { amountDue: 50, flags: { voucherUsed: true } },
      { amountDue: 75, flags: {} },
      { amountDue: 20, flags: {}, assignedPaymentId: 'p1' },
    ]
    expect(minUnpaidRate(rows)).toBe(75)
  })
})
