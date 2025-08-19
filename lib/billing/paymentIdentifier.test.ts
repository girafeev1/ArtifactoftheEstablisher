import { paymentIdentifier } from './paymentIdentifier'

describe('paymentIdentifier', () => {
  test('computes identifier based on entity', () => {
    expect(paymentIdentifier('Personal', 'b', 'a')).toBeUndefined()
    expect(paymentIdentifier('ME-ERL')).toBeUndefined()
    expect(paymentIdentifier('ME-ERL', 'b', 'a')).toBe('b/a')
  })
})
