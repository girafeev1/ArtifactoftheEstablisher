/**
 * @jest-environment jsdom
 */
import React from 'react'
import '@testing-library/jest-dom'
import { render, fireEvent, waitFor } from '@testing-library/react'
import PaymentModal from './PaymentModal'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('../../lib/erlDirectory', () => ({
  listBanks: jest
    .fn()
    .mockResolvedValue([
      { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
    ]),
  listAccounts: jest.fn().mockResolvedValue([
    { accountDocId: 'a1', accountType: 'Savings' },
  ]),
  buildBankLabel: jest.fn((b) => `${b.bankName} (${b.bankCode})`),
}))

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  Timestamp: { fromDate: jest.fn(() => 'date'), now: jest.fn(() => 'now') },
}))

jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { email: 'tester@example.com' } }),
}))

jest.mock('../../lib/firebase', () => ({ db: {} }))
jest.mock('../../lib/paths', () => ({ PATHS: { payments: () => 'p' }, logPath: jest.fn() }))
jest.mock('../../lib/billing/useBilling', () => ({
  useBillingClient: () => ({ setQueryData: jest.fn() }),
  billingKey: () => 'key',
}))
jest.mock('../../lib/liveRefresh', () => ({ writeSummaryFromCache: jest.fn() }))

const noop = () => {}

describe('PaymentModal ERL cascade', () => {
  test('populates banks/accounts and submits identifier with audit fields', async () => {
    const qc = new QueryClient()
    const { getByTestId } = render(
      <QueryClientProvider client={qc}>
        <PaymentModal abbr="A" account="B" open onClose={noop} />
      </QueryClientProvider>,
    )

    fireEvent.change(getByTestId('entity-select'), {
      target: { value: 'Music Establish (ERL)' },
    })
    await waitFor(() => getByTestId('bank-select'))
    const bankSelect = getByTestId('bank-select') as HTMLInputElement
    fireEvent.change(bankSelect, { target: { value: '001' } })
    await waitFor(() => getByTestId('bank-account-select'))
    const accountSelect = getByTestId('bank-account-select') as HTMLInputElement
    fireEvent.change(accountSelect, { target: { value: 'a1' } })
    expect(require('../../lib/erlDirectory').listBanks).toHaveBeenCalled()
    expect(
      require('../../lib/erlDirectory').listAccounts,
    ).toHaveBeenCalledWith({
      bankCode: '001',
      bankName: 'Bank',
      rawCodeSegment: '(001)',
    })
    fireEvent.change(getByTestId('method-select'), { target: { value: 'FPS' } })
    fireEvent.change(getByTestId('ref-input'), { target: { value: 'R1' } })

    expect(require('firebase/firestore').addDoc).not.toHaveBeenCalled()
    fireEvent.click(getByTestId('submit-payment'))
    await waitFor(() => expect(require('firebase/firestore').addDoc).toHaveBeenCalled())
    const data = (require('firebase/firestore').addDoc as jest.Mock).mock.calls[0][1]
    expect(data.identifier).toBe('a1')
    expect(data.bankCode).toBeUndefined()
    expect(data.accountDocId).toBeUndefined()
    expect(data.method).toBe('FPS')
    expect(data.entity).toBeUndefined()
    expect(data.editedBy).toBe('tester@example.com')
    expect(data.timestamp).toBe('now')
    expect(data.refNumber).toBe('R1')
  })
})
