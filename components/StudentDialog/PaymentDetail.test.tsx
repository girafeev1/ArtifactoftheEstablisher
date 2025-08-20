/**
 * @jest-environment jsdom
 */
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PaymentDetail from './PaymentDetail'

jest.mock('../../lib/billing/useBilling', () => ({
  useBillingClient: () => ({ setQueryData: jest.fn() }),
  useBilling: () => ({ data: { rows: [] } }),
}))
jest.mock('../../lib/billing/minUnpaidRate', () => ({ minUnpaidRate: () => 0 }))
jest.mock('../../lib/liveRefresh', () => ({
  patchBillingAssignedSessions: jest.fn(),
  writeSummaryFromCache: jest.fn(),
  payRetainerPatch: jest.fn(),
  upsertUnpaidRetainerRow: jest.fn(),
}))
jest.mock('../../lib/firebase', () => ({ db: {} }))
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'tester@example.com' } }, status: 'authenticated' }),
}))
jest.mock('firebase/firestore', () => ({
  doc: () => ({}),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
  collection: jest.fn(),
  Timestamp: { now: () => ({ seconds: 0 }) },
}))
jest.mock('../../lib/erlDirectory', () => ({
  listBanks: () => Promise.resolve([{ bankCode: '001', bankName: 'Bank1' }]),
  listAccounts: () =>
    Promise.resolve([{ accountDocId: 'A1', accountType: 'Savings' }]),
  buildBankLabel: (b: any) => `${b.bankName || ''} ${b.bankCode}`.trim(),
}))

describe('PaymentDetail', () => {
  const basePayment = {
    id: 'p1',
    amount: 100,
    paymentMade: new Date(),
    remainingAmount: 100,
  }

  it('renders Back inside sticky footer', () => {
    render(
      <PaymentDetail
        abbr="A"
        account="acct"
        payment={{ ...basePayment }}
        onBack={() => {}}
      />,
    )
    const footer = screen.getByTestId('dialog-footer')
    const back = screen.getByTestId('back-button')
    expect(footer).toContainElement(back)
  })

  it('only remaining amount blinks', () => {
    render(
      <PaymentDetail
        abbr="A"
        account="acct"
        payment={{ ...basePayment }}
        onBack={() => {}}
      />,
    )
    const blinkEls = document.querySelectorAll('.blink-remaining')
    expect(blinkEls).toHaveLength(1)
    expect(blinkEls[0]).toBe(screen.getByTestId('remaining-amount'))
  })

  it('allows editing empty metadata and saves', async () => {
    const payment: any = { ...basePayment }
    render(
      <PaymentDetail
        abbr="A"
        account="acct"
        payment={payment}
        onBack={() => {}}
      />,
    )
    fireEvent.change(screen.getByTestId('detail-entity-select'), {
      target: { value: 'Music Establish (ERL)' },
    })
    await waitFor(() => screen.getByTestId('detail-bank-select'))
    fireEvent.change(screen.getByTestId('detail-bank-select'), {
      target: { value: '001' },
    })
    await waitFor(() => screen.getByTestId('detail-bank-account-select'))
    fireEvent.change(screen.getByTestId('detail-bank-account-select'), {
      target: { value: 'A1' },
    })
    fireEvent.change(screen.getByTestId('detail-ref-input'), {
      target: { value: 'REF1' },
    })
    await waitFor(() =>
      expect(screen.getByTestId('detail-save')).not.toBeDisabled(),
    )
    fireEvent.click(screen.getByTestId('detail-save'))
    await waitFor(() =>
      expect(payment.entity).toBe('Music Establish (ERL)'),
    )
    expect(payment.bankCode).toBe('001')
    expect(payment.accountDocId).toBe('A1')
    expect(payment.identifier).toBe('001/A1')
    expect(payment.refNumber).toBe('REF1')
  })
})

