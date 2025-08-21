import { reducePaymentPayload } from './submit'

test('reducePaymentPayload strips helper fields and maps identifier', () => {
  const input = {
    amount: 100,
    accountDocId: 'acc1',
    method: 'FPS',
    entity: 'ERL',
    bankCode: '001',
    refNumber: 'r1',
  }
  const out = reducePaymentPayload(input)
  expect(out).toEqual({ amount: 100, refNumber: 'r1', identifier: 'acc1' })
  expect(out.method).toBeUndefined()
  expect(out.entity).toBeUndefined()
  expect(out.bankCode).toBeUndefined()
  expect(out.accountDocId).toBeUndefined()
})
