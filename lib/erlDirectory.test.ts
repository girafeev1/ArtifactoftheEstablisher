import {
  buildBankLabel,
  listBanks,
  listAccounts,
  normalizeCode,
} from './erlDirectory'
import { collection, getDocs } from 'firebase/firestore'

jest.mock('./firebase', () => ({ app: {} }))

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  initializeFirestore: jest.fn(() => ({})),
  collection: jest.fn((_: any, ...parts: string[]) => parts.join('/')),
  getDocs: jest.fn(),
}))

describe('buildBankLabel', () => {
  test('uses name and code when available', () => {
    expect(
      buildBankLabel({ bankName: 'HK Bank', bankCode: '012', rawCodeSegment: '(012)' }),
    ).toBe('HK Bank 012')
  })

  test('falls back to code when name missing', () => {
    expect(buildBankLabel({ bankCode: '012', bankName: '', rawCodeSegment: '(012)' })).toBe(
      '012',
    )
  })
})

describe('normalizeCode', () => {
  test('normalizes various inputs', () => {
    expect(normalizeCode(40)).toEqual({ code: '040', raw: '(040)' })
    expect(normalizeCode('040')).toEqual({ code: '040', raw: '(040)' })
    expect(normalizeCode('(040)')).toEqual({ code: '040', raw: '(040)' })
  })
})

describe('listBanks', () => {
  beforeEach(() => {
    ;(getDocs as jest.Mock).mockReset()
    ;(collection as jest.Mock).mockClear()
  })

  test('returns banks collection when present', async () => {
    ;(getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [{ id: '001', data: () => ({ name: 'Bank1' }) }],
    })
    const res = await listBanks()
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'banks')
    expect(res).toEqual([
      {
        bankCode: '001',
        bankName: 'Bank1',
        rawCodeSegment: '(001)',
      },
    ])
  })

  test('falls back to bankAccount collection using code field', async () => {
    ;(getDocs as jest.Mock)
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          { id: 'Dah Sing Bank', data: () => ({ code: [40, 12, 40] }) },
        ],
      })
    const res = await listBanks()
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'bankAccount')
    expect(res).toEqual([
      { bankCode: '040', bankName: 'Dah Sing Bank', rawCodeSegment: '(040)' },
      { bankCode: '012', bankName: 'Dah Sing Bank', rawCodeSegment: '(012)' },
    ])
  })
})

describe('listAccounts', () => {
  beforeEach(() => {
    ;(getDocs as jest.Mock).mockReset()
    ;(collection as jest.Mock).mockClear()
  })

  test('returns accounts under banks/{code} when present', async () => {
    ;(getDocs as jest.Mock)
      .mockResolvedValueOnce({
        docs: [{ id: 'a1', data: () => ({ accountType: 'chk' }) }],
      })
      .mockResolvedValueOnce({ docs: [] })
    const res = await listAccounts({
      bankCode: '001',
      bankName: 'Bank',
      rawCodeSegment: '(001)',
    })
    expect(collection).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'banks',
      '001',
      'accounts',
    )
    expect(collection).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'bankAccount',
      'Bank',
      '(001)',
    )
    expect(res).toEqual([{ accountDocId: 'a1', accountType: 'chk' }])
  })

  test('merges legacy accounts when new schema empty', async () => {
    ;(getDocs as jest.Mock)
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          { id: 'acc1', data: () => ({ accountType: 'sv' }) },
        ],
      })
    const res = await listAccounts({
      bankCode: '040',
      bankName: 'DSB',
      rawCodeSegment: '(040)',
    })
    expect(collection).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'banks',
      '040',
      'accounts',
    )
    expect(collection).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'bankAccount',
      'DSB',
      '(040)',
    )
    expect(res).toEqual([{ accountDocId: 'acc1', accountType: 'sv' }])
  })
})
