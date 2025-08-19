/**
 * @jest-environment jsdom
 */
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import CoachingSessions from './coaching-sessions'

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(async () => ({ docs: [] })),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
  doc: jest.fn(),
}))
jest.mock('../../../lib/firebase', () => ({ db: {} }))
jest.mock('../../../lib/paths', () => ({ PATHS: {}, logPath: jest.fn() }))
jest.mock('../../../components/StudentDialog/OverviewTab', () => () => null)
jest.mock('../../../components/StudentDialog/SessionDetail', () => () => null)
jest.mock('../../../components/StudentDialog/FloatingWindow', () => ({ children }: any) => (
  <div>{children}</div>
))
jest.mock('../../../lib/sessionStats', () => ({ clearSessionSummaries: jest.fn() }))
jest.mock('../../../lib/sessions', () => ({ computeSessionStart: jest.fn() }))
jest.mock('../../../lib/billing/useBilling', () => ({ useBilling: () => ({ data: null, isLoading: false }) }))
jest.mock('../../../components/LoadingDash', () => () => null)
jest.mock('../../../lib/scanLogs', () => ({
  readScanLogs: jest.fn(async () => null),
  writeScanLog: jest.fn(),
}))
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

describe('coaching sessions card view', () => {
  it('renders settings button inside footer row and badge', () => {
    render(<CoachingSessions />)
    const footer = screen.getByTestId('card-footer-row')
    const settings = screen.getByTestId('settings-3dots')
    expect(footer).toContainElement(settings)
    expect(screen.getByTestId('pprompt-badge-card').textContent).toBe(
      'P-027-04r',
    )
  })
})

