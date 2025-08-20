/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react'
import PaymentModal from './PaymentModal'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('../../lib/erlDirectory', () => ({
  listBanks: jest.fn().mockResolvedValue([
    { bankCode: '001', bankName: 'Bank' },
  ]),
  listAccounts: jest.fn().mockResolvedValue([
    { accountDocId: 'a1', accountType: 'Savings' },
  ]),
  buildBankLabel: jest.fn((b) => `${b.bankName} ${b.bankCode}`),
}))

const noop = () => {}

describe('PaymentModal entity switching', () => {
  test('clears bank fields when switching to Personal', async () => {
    const qc = new QueryClient()
    const { getByTestId, queryByTestId } = render(
      React.createElement(QueryClientProvider, { client: qc },
        React.createElement(PaymentModal, {
          abbr: 'A',
          account: 'B',
          open: true,
          onClose: noop,
        }),
      ),
    )

    const entitySelect = getByTestId('entity-select') as HTMLInputElement
    fireEvent.change(entitySelect, { target: { value: 'Music Establish (ERL)' } })
    await waitFor(() => expect(entitySelect.value).toBe('Music Establish (ERL)'))

    let bankSelect = getByTestId('bank-select') as HTMLInputElement
    fireEvent.change(bankSelect, { target: { value: '001' } })
    await waitFor(() => expect(bankSelect.value).toBe('001'))

    let accountSelect = getByTestId('bank-account-select') as HTMLInputElement
    fireEvent.change(accountSelect, { target: { value: 'a1' } })
    await waitFor(() => expect(accountSelect.value).toBe('a1'))

    fireEvent.change(entitySelect, { target: { value: 'Personal' } })
    await waitFor(() => expect(entitySelect.value).toBe('Personal'))

    expect(
      (getByTestId('entity-select') as HTMLInputElement).value,
    ).toBe('Personal')

    await waitFor(() => {
      expect(queryByTestId('bank-select')).toBeNull()
      expect(queryByTestId('bank-account-select')).toBeNull()
    })
  })
})
