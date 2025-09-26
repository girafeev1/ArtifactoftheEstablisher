/**
 * @jest-environment jsdom
 */
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import CoachingSessions from '../../../../pages/dashboard/businesses/coaching-sessions'
import { PromptIdProvider, latestPromptIdFromFiles } from '../../../../lib/promptId'

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
jest.mock('../../../../lib/firebase', () => ({ db: {} }))
jest.mock('../../../../lib/paths', () => ({ PATHS: {}, logPath: jest.fn() }))
jest.mock('../../../../components/StudentDialog/OverviewTab', () => {
  function OverviewTabMock() {
    return null
  }
  OverviewTabMock.displayName = 'OverviewTabMock'
  return OverviewTabMock
})
jest.mock('../../../../components/StudentDialog/SessionDetail', () => {
  function SessionDetailMock() {
    return null
  }
  SessionDetailMock.displayName = 'SessionDetailMock'
  return SessionDetailMock
})
jest.mock('../../../../components/StudentDialog/FloatingWindow', () => {
  function FloatingWindowMock({ children }: any) {
    return <div>{children}</div>
  }
  FloatingWindowMock.displayName = 'FloatingWindowMock'
  return FloatingWindowMock
})
jest.mock('../../../../lib/sessionStats', () => ({ clearSessionSummaries: jest.fn() }))
jest.mock('../../../../lib/sessions', () => ({ computeSessionStart: jest.fn() }))
jest.mock('../../../../lib/billing/useBilling', () => ({ useBilling: () => ({ data: null, isLoading: false }) }))
jest.mock('../../../../components/LoadingDash', () => {
  function LoadingDashMock() {
    return null
  }
  LoadingDashMock.displayName = 'LoadingDashMock'
  return LoadingDashMock
})
jest.mock('../../../../lib/scanLogs', () => ({
  readScanLogs: jest.fn(async () => null),
  writeScanLog: jest.fn(),
}))
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

describe('coaching sessions card view', () => {
  it('renders settings button inside footer row and badge', () => {
    const pid = latestPromptIdFromFiles()
    render(
      <PromptIdProvider value={pid}>
        <CoachingSessions />
      </PromptIdProvider>,
    )
    const footer = screen.getByTestId('card-footer-row')
    const settings = screen.getByTestId('settings-3dots')
    expect(footer).toContainElement(settings)
    expect(screen.getByTestId('pprompt-badge-card').textContent).toBe(pid)
    expect(screen.queryByTestId('pprompt-badge')).toBeNull()
  })
})
