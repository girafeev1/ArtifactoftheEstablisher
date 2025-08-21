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
  deleteField: () => 'DELETED',
  getDoc: jest.fn(() => Promise.resolve({ data: () => ({ firstName: 'First', lastName: 'Last' }) })),
}))
jest.mock('../../lib/erlDirectory', () => ({
  listBanks: () =>
    Promise.resolve([{ bankCode: '001', bankName: 'Bank1', rawCodeSegment: '(001)' }]),
  listAccounts: jest
    .fn()
    .mockResolvedValue([{ accountDocId: 'A1', accountType: 'Savings' }]),
  buildBankLabel: (b: any) => `${b.bankName || ''} (${b.bankCode})`.trim(),
  lookupAccount: jest.fn(() =>
    Promise.resolve({
      bankName: 'Bank1',
      bankCode: '001',
      accountType: 'Savings',
      accountNumber: '1234',
    }),
  ),
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

  it('allows editing empty metadata and saves identifier only', async () => {
    const payment: any = { ...basePayment }
    render(
      <PaymentDetail
        abbr="A"
        account="acct"
        payment={payment}
        onBack={() => {}}
      />,
    )
    fireEvent.change(screen.getByTestId('detail-method-select'), {
      target: { value: 'FPS' },
    })
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
    await waitFor(() => expect(payment.identifier).toBe('A1'))
    expect(payment.method).toBe('FPS')
    expect(payment.bankCode).toBeUndefined()
    expect(payment.accountDocId).toBeUndefined()
    expect(payment.refNumber).toBe('REF1')
    expect(payment.entity).toBeUndefined()
    expect(screen.queryByTestId('detail-method-select')).toBeNull()
    expect(screen.queryByTestId('detail-entity-select')).toBeNull()
    expect(screen.getByTestId('payment-summary-block')).toBeInTheDocument()
  })

  it('renders summary block when identifier present', async () => {
    const payment: any = { ...basePayment, identifier: 'A1', method: 'FPS', refNumber: 'R1' }
    render(
      <PaymentDetail
        abbr="A"
        account="acct"
        payment={payment}
        onBack={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('payment-summary-block')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('detail-method-select')).toBeNull()
    expect(screen.getByText(/Bank1 \(001\)/)).toBeInTheDocument()
  })
})

