import { buildBankLabel } from './erlDirectory'

describe('buildBankLabel', () => {
  test('uses name and code when available', () => {
    expect(buildBankLabel({ bankName: 'HK Bank', bankCode: '012' })).toBe(
      'HK Bank 012',
    )
  })

  test('falls back to docId and collectionId', () => {
    expect(
      buildBankLabel({ bankCode: '012', docId: 'd1', collectionId: 'banks' }),
    ).toBe('d1 banks')
  })
})
