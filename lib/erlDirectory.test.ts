import { jest } from '@jest/globals'

jest.mock('firebase/firestore', () => ({
  initializeFirestore: jest.fn(),
  getFirestore: jest.fn(),
  collection: jest.fn((db, path) => path),
  getDocs: jest.fn(),
}))

describe('fetchBanks', () => {
  afterEach(() => {
    jest.resetModules()
  })

  test('reads preferred bank structure', async () => {
    const { getDocs } = require('firebase/firestore') as any
    getDocs.mockResolvedValueOnce({
      docs: [
        { id: '001', data: () => ({ code: '001', name: 'Bank A' }), ref: 'banks/001' },
      ],
    })
    getDocs.mockResolvedValueOnce({
      docs: [
        { id: 'acc1', data: () => ({ accountType: 'Checking' }) },
      ],
    })
    const { fetchBanks } = require('./erlDirectory')
    const banks = await fetchBanks()
    expect(banks).toEqual([
      {
        code: '001',
        name: 'Bank A',
        accounts: [{ id: 'acc1', accountType: 'Checking' }],
      },
    ])
  })

  test('falls back to legacy structure', async () => {
    const { getDocs } = require('firebase/firestore') as any
    getDocs.mockRejectedValueOnce(new Error('fail banks'))
    getDocs.mockResolvedValueOnce({
      docs: [
        { id: '002', ref: 'bankAccount/002', data: () => ({}) },
      ],
    })
    getDocs.mockResolvedValueOnce({
      docs: [
        { id: 'acc2', data: () => ({ accountType: 'Savings' }) },
      ],
    })
    const { fetchBanks } = require('./erlDirectory')
    const banks = await fetchBanks()
    expect(banks).toEqual([
      {
        code: '002',
        name: '002',
        accounts: [{ id: 'acc2', accountType: 'Savings' }],
      },
    ])
  })
})

