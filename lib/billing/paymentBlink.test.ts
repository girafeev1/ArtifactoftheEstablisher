import { paymentBlinkClass } from './paymentBlink'

describe('paymentBlinkClass', () => {
  test('returns appropriate blink classes', () => {
    expect(paymentBlinkClass(50, 40)).toBe('blink-remaining blink-amount--warn')
    expect(paymentBlinkClass(30, 40)).toBe('blink-remaining blink-amount--error')
    expect(paymentBlinkClass(0, 40)).toBeUndefined()
  })
})
