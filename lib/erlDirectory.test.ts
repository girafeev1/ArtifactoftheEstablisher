import {
  buildAccountsPath,
  buildBankLabel,
  buildAccountLabel,
  listBanks,
} from './erlDirectory'
import { getDocs } from 'firebase/firestore'

jest.mock('firebase/firestore', () => ({
  initializeFirestore: jest.fn(),
  getFirestore: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
}))

test('buildAccountsPath formats code with parentheses', () => {
  expect(buildAccountsPath(40)).toEqual(['bankAccount', '(040)', 'accounts'])
})

test('buildAccountsPath normalizes string codes', () => {
  expect(buildAccountsPath('040')).toEqual(['bankAccount', '(040)', 'accounts'])
  expect(buildAccountsPath('(040)')).toEqual(['bankAccount', '(040)', 'accounts'])
})

test('buildBankLabel formats bank name and code', () => {
  expect(
    buildBankLabel({ bankName: 'Dah Sing Bank', bankCode: '040', rawCodeSegment: '(040)' }),
  ).toBe('Dah Sing Bank (040)')
})

test('listBanks expands multiple codes', async () => {
  const getDocsMock = getDocs as jest.Mock
  getDocsMock.mockResolvedValueOnce({
    docs: [
      { id: 'b1', data: () => ({ name: 'Bank1', code: [40, 152] }) },
    ],
  })
  const banks = await listBanks()
  expect(banks).toEqual([
    { bankCode: '040', bankName: 'Bank1', rawCodeSegment: '(040)' },
    { bankCode: '152', bankName: 'Bank1', rawCodeSegment: '(152)' },
  ])
})

test('buildAccountLabel masks and falls back', () => {
  expect(
    buildAccountLabel({
      accountDocId: 'a1',
      accountType: 'Corporate',
      accountNumber: '12345678',
    }),
  ).toBe('Corporate · ••••5678')
  expect(
    buildAccountLabel({
      accountDocId: 'a2',
      accountType: 'Savings',
      accountNo: '87654321',
    }),
  ).toBe('Savings · ••••4321')
})
