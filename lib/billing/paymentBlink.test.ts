import assert from 'node:assert'
import { paymentBlinkClass } from './paymentBlink'

assert.strictEqual(paymentBlinkClass(50, 40), 'blink-amount--warn')
assert.strictEqual(paymentBlinkClass(30, 40), 'blink-amount--error')
assert.strictEqual(paymentBlinkClass(0, 40), undefined)
