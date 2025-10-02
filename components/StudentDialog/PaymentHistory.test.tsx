/**
 * @jest-environment jsdom
 */
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import PaymentHistory from './PaymentHistory'

jest.mock('./PaymentModal', () => {
  function PaymentModalMock() {
    return <div />
  }
  PaymentModalMock.displayName = 'PaymentModalMock'
  return PaymentModalMock
})

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  onSnapshot: (q: any, next: any) => {
    next({ docs: [] })
    return jest.fn()
  },
  initializeFirestore: jest.fn(),
  getFirestore: jest.fn(),
}))

jest.mock('../../lib/firebase', () => ({ db: {} }))
jest.mock('../../lib/billing/useBilling', () => ({ useBilling: () => ({}) }))
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'tester@example.com' } } }),
}))
jest.mock('../../lib/paths', () => ({ PATHS: { payments: () => 'p' }, logPath: jest.fn() }))
jest.mock('../../lib/useColumnWidths', () => ({
  useColumnWidths: () => ({
    widths: {
      paymentMade: 140,
      amount: 130,
      method: 120,
      entity: 160,
      identifier: 160,
      refNumber: 160,
      session: 180,
    },
    startResize: jest.fn(),
    dblClickResize: jest.fn(),
    keyResize: jest.fn(),
  }),
}))

test('shows default columns', async () => {
  window.localStorage.clear()
  render(
    <PaymentHistory
      abbr="A"
      account="B"
      active
      onTitleChange={() => {}}
    />,
  )
  await waitFor(() =>
    expect(screen.getByText('No payments recorded.')).toBeInTheDocument(),
  )
  expect(screen.getByText('Date')).toBeInTheDocument()
  expect(screen.getByText('Amount')).toBeInTheDocument()
  expect(screen.getByText('For Session(s)')).toBeInTheDocument()
  expect(screen.queryByText('Method')).not.toBeInTheDocument()
  expect(screen.queryByText('Entity')).not.toBeInTheDocument()
  expect(screen.queryByText('Bank Account')).not.toBeInTheDocument()
  expect(screen.queryByText('Reference #')).not.toBeInTheDocument()
})
