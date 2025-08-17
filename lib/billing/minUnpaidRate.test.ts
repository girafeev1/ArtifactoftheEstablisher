import assert from 'node:assert'
import { minUnpaidRate } from './minUnpaidRate'

const rows = [
  { amountDue: 100, flags: {} },
  { amountDue: 50, flags: { voucherUsed: true } },
  { amountDue: 75, flags: {} },
  { amountDue: 20, flags: {}, assignedPaymentId: 'p1' },
]

assert.strictEqual(minUnpaidRate(rows), 75)
