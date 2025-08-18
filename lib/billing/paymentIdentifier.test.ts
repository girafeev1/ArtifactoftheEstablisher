import assert from 'node:assert'
import { paymentIdentifier } from './paymentIdentifier'

assert.strictEqual(paymentIdentifier('Personal', 'b', 'a'), undefined)
assert.strictEqual(paymentIdentifier('ME-ERL'), undefined)
assert.strictEqual(paymentIdentifier('ME-ERL', 'b', 'a'), 'b/a')
