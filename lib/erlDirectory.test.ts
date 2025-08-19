import { buildBankLabel, BankInfo } from './erlDirectory'

describe('buildBankLabel', () => {
  test('uses bankName and code when available', () => {
    const b: BankInfo = { bankCode: '123', bankName: 'Test Bank' }
    expect(buildBankLabel(b)).toBe('Test Bank 123')
  })

  test('falls back to docId and collectionId', () => {
    const b: BankInfo = { bankCode: '', docId: 'abc', collectionId: 'banks' }
    expect(buildBankLabel(b)).toBe('abc banks')
  })
})
