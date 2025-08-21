import {
  buildBankLabel,
  listBanks,
  listAccounts,
} from './erlDirectory'
import { collection, collectionGroup, getDocs } from 'firebase/firestore'

jest.mock('./firebase', () => ({ app: {} }))

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  initializeFirestore: jest.fn(() => ({})),
  collection: jest.fn((_: any, ...parts: string[]) => parts.join('/')),
  collectionGroup: jest.fn((_: any, id: string) => `group:${id}`),
  getDocs: jest.fn(),
}))

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

describe('listBanks', () => {
  beforeEach(() => {
    ;(getDocs as jest.Mock).mockReset()
    ;(collection as jest.Mock).mockClear()
  })

  test('returns banks collection when present', async () => {
    ;(getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [
        { id: 'b1', data: () => ({ code: '001', name: 'Bank1' }) },
      ],
    })
    const res = await listBanks()
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'banks')
    expect(res).toEqual([
      {
        bankCode: '001',
        bankName: 'Bank1',
        docId: 'b1',
        collectionId: 'banks',
      },
    ])
  })

  test('falls back to bankAccount collection using code field', async () => {
    ;(getDocs as jest.Mock)
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          { id: 'Dah Sing Bank', data: () => ({ code: '(040)' }) },
        ],
      })
    const res = await listBanks()
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'bankAccount')
    expect(res).toEqual([
      {
        bankCode: '(040)',
        bankName: 'Dah Sing Bank',
        docId: 'Dah Sing Bank',
        collectionId: 'bankAccount',
      },
    ])
  })
})

describe('listAccounts', () => {
  beforeEach(() => {
    ;(getDocs as jest.Mock).mockReset()
    ;(collection as jest.Mock).mockClear()
    ;(collectionGroup as jest.Mock).mockClear()
  })

  test('returns accounts under banks/{code} when present', async () => {
    ;(getDocs as jest.Mock).mockResolvedValueOnce({
      empty: false,
      docs: [{ id: 'a1', data: () => ({ accountType: 'chk' }) }],
    })
    const res = await listAccounts('001')
    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      'banks',
      '001',
      'accounts',
    )
    expect(res).toEqual([{ accountDocId: 'a1', accountType: 'chk' }])
  })

  test('falls back to collection group on code', async () => {
    ;(getDocs as jest.Mock)
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'acc1',
            data: () => ({ accountType: 'sv' }),
            ref: { path: '/bankAccount/DSB/(040)/acc1' },
          },
        ],
      })
    const res = await listAccounts('(040)')
    expect(collectionGroup).toHaveBeenCalledWith(expect.anything(), '(040)')
    expect(res).toEqual([{ accountDocId: 'acc1', accountType: 'sv' }])
  })
})
