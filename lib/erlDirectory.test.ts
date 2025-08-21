import { normalizeCode, buildBankLabel } from './erlDirectory'

test('normalizeCode and buildBankLabel', () => {
  expect(normalizeCode(40)).toEqual({ code: '040', raw: '(040)' })
  expect(normalizeCode('040')).toEqual({ code: '040', raw: '(040)' })
  expect(buildBankLabel({ bankCode: '040', bankName: 'Bank', rawCodeSegment: '(040)' })).toBe('Bank (040)')
})
