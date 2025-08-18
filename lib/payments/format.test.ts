import { buildIdentifier } from './format'

describe('buildIdentifier', () => {
  test('returns undefined when parts are missing', () => {
    expect(buildIdentifier()).toBeUndefined()
    expect(buildIdentifier('ABC')).toBeUndefined()
    expect(buildIdentifier(undefined, '123')).toBeUndefined()
  })

  test('builds identifier when both parts present', () => {
    expect(buildIdentifier('ABC', '123')).toBe('ABC/123')
    expect(buildIdentifier('HK', 'acc_1')).toMatch(/^[0-9A-Za-z]+\/[0-9A-Za-z_-]+$/)
  })

  test('strips invalid characters', () => {
    expect(buildIdentifier('AB-12', 'id#1')).toBe('AB12/id1')
    expect(buildIdentifier('@@', '##')).toBeUndefined()
  })
})
