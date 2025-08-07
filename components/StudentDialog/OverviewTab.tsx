// components/StudentDialog/OverviewTab.tsx

import React, { useEffect, useState, useCallback } from 'react'
import { Tabs, Tab, Box, CircularProgress, Typography } from '@mui/material'
import FloatingWindow from './FloatingWindow'

// OverviewTab acts purely as a presenter. PersonalTab, SessionsTab and
// BillingTab each fetch and compute their own data then "stream" summary
// values upward via callbacks. This "stream-from-owner" architecture keeps a
// single source of truth in the owning tab, avoids duplicated logic and ensures
// OverviewTab never queries Firestore directly.
import PersonalTab from './PersonalTab'
import BillingTab from './BillingTab'
import RetainersTab from './RetainersTab'
import SessionsTab from './SessionsTab'
import PaymentHistory from './PaymentHistory'

console.log('=== StudentDialog loaded version 1.1 ===')

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD' }).format(n)

class StudentDialogErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('StudentDialog render error', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <Box p={2}>
          <Typography color="error">Student dialog failed to load.</Typography>
        </Box>
      )
    }
    return this.props.children
  }
}

export interface OverviewTabProps {
  abbr: string
  account: string
  open: boolean
  onClose: () => void
  serviceMode: boolean
  onPopDetail?: (s: any) => void
}

export default function OverviewTab({
  abbr,
  account,
  open,
  onClose,
  serviceMode,
  onPopDetail,
}: OverviewTabProps) {
  console.log('OverviewTab rendered for', abbr)
  const [tab, setTab] = useState<string>('overview')
  const [title, setTitle] = useState(account)
  const [actions, setActions] = useState<React.ReactNode | null>(null)

  // personal summary streamed from PersonalTab
  const [personal, setPersonal] = useState<any>({})
  const [personalLoading, setPersonalLoading] = useState({
    firstName: true,
    lastName: true,
    sex: true,
  })

  // billing summary streamed from BillingTab
  const [billing, setBilling] = useState<any>({})
  const [billingLoading, setBillingLoading] = useState({
    balanceDue: true,
    voucherBalance: true,
  })

  // overview summary streamed from SessionsTab
  const [overview, setOverview] = useState<any>({ joint: '', last: '', total: 0 })
  const [overviewLoading, setOverviewLoading] = useState(true)

  const handlePersonal = useCallback(
    (data: Partial<{ firstName: string; lastName: string; sex: string }>) => {
      setPersonal((p: any) => ({ ...p, ...data }))
      Object.keys(data).forEach((k) =>
        setPersonalLoading((l: any) => ({ ...l, [k]: false }))
      )
    },
    [setPersonal, setPersonalLoading],
  )

  const handleBilling = useCallback(
    (data: Partial<{ balanceDue: number; voucherBalance: number }>) => {
      setBilling((b: any) => ({ ...b, ...data }))
      Object.keys(data).forEach((k) =>
        setBillingLoading((l: any) => ({ ...l, [k]: false }))
      )
    },
    [setBilling, setBillingLoading],
  )

  const handleSummary = useCallback(
    (s: { jointDate: string; lastSession: string; totalSessions: number }) => {
      setOverview({ joint: s.jointDate, last: s.lastSession, total: s.totalSessions })
      setOverviewLoading(false)
    },
    [setOverview, setOverviewLoading],
  )

  const selectTab = (v: string) => {
    setTab(v)
    if (v === 'billing-retainers')
      setTitle(`${account} - Billing - Retainers`)
    else if (v === 'billing-history')
      setTitle(`${account} - Billing - Payment History`)
    else if (v === 'billing') setTitle(`${account} - Billing`)
    else
      setTitle(
        `${account} - ${v.charAt(0).toUpperCase() + v.slice(1)}`,
      )
  }

  const handleTabChange = (_: any, v: string) => selectTab(v)

  // reset loading states whenever dialog is opened
  useEffect(() => {
    console.log('OverviewTab reset effect for', abbr)
    if (open) {
      setPersonal({})
      setBilling({})
      setOverview({ joint: '', last: '', total: 0 })
      setPersonalLoading({ firstName: true, lastName: true, sex: true })
      setBillingLoading({ balanceDue: true, voucherBalance: true })
      setOverviewLoading(true)
      setActions(null)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const q = params.get('tab')
        selectTab(q || 'overview')
      } else {
        selectTab('overview')
      }
    }
  }, [open, abbr, account])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tab)
    const url = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', url)
  }, [tab])

  useEffect(() => {
    console.log('OverviewTab loading states', {
      personalLoading,
      billingLoading,
      overviewLoading,
    })
  })

  const displayField = (v: any) => {
    if (v === '__ERROR__') return 'Error'
    if (v === undefined || v === null || v === '') return 'N/A'
    return String(v)
  }

  const loading =
    Object.values(personalLoading).some((v) => v) ||
    Object.values(billingLoading).some((v) => v) ||
    overviewLoading

  if (!open) return null
  return (
    <StudentDialogErrorBoundary>
      <FloatingWindow onClose={onClose} title={title} actions={actions}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxHeight: '100%', maxWidth: '100%', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', flexGrow: 1, position: 'relative', alignItems: 'flex-start', maxHeight: '100%', maxWidth: '100%' }}>
            {loading && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.paper',
                  zIndex: 1,
                }}
              >
                <CircularProgress />
              </Box>
            )}

            <Box
              sx={{
                flexGrow: 1,
                pr: 3,
                overflow: 'auto',
                textAlign: 'left',
                display: loading ? 'none' : 'block',
                maxHeight: '100%',
                maxWidth: '100%',
              }}
            >
              <Box sx={{ display: tab === 'overview' ? 'block' : 'none' }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
                >
                  Legal Name:{' '}
                  {(personalLoading.firstName || personalLoading.lastName) && (
                    <CircularProgress size={14} />
                  )}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                >
                  {(personalLoading.firstName || personalLoading.lastName)
                    ? 'Loading…'
                    : (() => {
                        const first = displayField(personal.firstName)
                        const last = displayField(personal.lastName)
                        const both = `${first} ${last}`.trim()
                        return both === 'N/A N/A' ? 'N/A' : both
                      })()}
                </Typography>

                <Typography
                  variant="subtitle2"
                  sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
                >
                  Gender:{' '}
                  {personalLoading.sex && <CircularProgress size={14} />}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                >
                  {personalLoading.sex
                    ? 'Loading…'
                    : displayField(personal.sex)}
                </Typography>

                <Typography
                  variant="subtitle2"
                  sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
                >
                  Joint Date:{' '}
                  {overviewLoading && <CircularProgress size={14} />}
                </Typography>
                {overviewLoading ? (
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                  >
                    Loading…
                  </Typography>
                ) : (
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                  >
                    {overview.joint || '–'}
                  </Typography>
                )}

                <Typography
                  variant="subtitle2"
                  sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
                >
                  Total Sessions:{' '}
                  {overviewLoading && <CircularProgress size={14} />}
                </Typography>
                {overviewLoading ? (
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                  >
                    Loading…
                  </Typography>
                ) : (
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                  >
                    {overview.total ?? '–'}
                  </Typography>
                )}

                <Typography
                  variant="subtitle2"
                  sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
                >
                  Balance Due:{' '}
                  {billingLoading.balanceDue && <CircularProgress size={14} />}
                </Typography>
                {billingLoading.balanceDue ? (
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                  >
                    Loading…
                  </Typography>
                ) : (
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                  >
                    {billing.balanceDue != null
                      ? formatCurrency(Number(billing.balanceDue) || 0)
                      : '-'}
                  </Typography>
                )}

                <Typography
                  variant="subtitle2"
                  sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
                >
                  Session Voucher:{' '}
                  {billingLoading.voucherBalance && <CircularProgress size={14} />}
                </Typography>
                {billingLoading.voucherBalance ? (
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                  >
                    Loading…
                  </Typography>
                ) : (
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                  >
                    {billing.voucherBalance != null
                      ? formatCurrency(Number(billing.voucherBalance) || 0)
                      : '-'}
                  </Typography>
                )}
              </Box>

              <PersonalTab
                abbr={abbr}
                serviceMode={serviceMode}
                onPersonal={handlePersonal}
                style={{ display: tab === 'personal' ? 'block' : 'none' }}
              />

              <SessionsTab
                abbr={abbr}
                account={account}
                onSummary={handleSummary}
                onTitle={setTitle}
                onActions={setActions}
                onPopDetail={onPopDetail}
                style={{ display: tab === 'sessions' ? 'block' : 'none' }}
              />

              <BillingTab
                abbr={abbr}
                account={account}
                serviceMode={serviceMode}
                onBilling={handleBilling}
                style={{ display: tab === 'billing' ? 'block' : 'none' }}
              />
              <Box sx={{ display: tab === 'billing-retainers' ? 'block' : 'none' }}>
                <RetainersTab
                  abbr={abbr}
                  balanceDue={Number(billing.balanceDue) || 0}
                  account={account}
                  onTitleChange={(t) => setTitle(t)}
                />
              </Box>
              <Box sx={{ display: tab === 'billing-history' ? 'block' : 'none' }}>
                <PaymentHistory
                  abbr={abbr}
                  account={account}
                  onTitleChange={(t) => setTitle(t)}
                />
              </Box>
            </Box>

            <Tabs
              orientation="vertical"
              value={tab}
              onChange={handleTabChange}
              sx={{
                borderLeft: 1,
                borderColor: 'divider',
                minWidth: 140,
                alignItems: 'flex-end',
                display: loading ? 'none' : 'flex',
              }}
            >
              <Tab
                value="overview"
                label="Overview"
                sx={{ textAlign: 'right', justifyContent: 'flex-end', width: '100%' }}
              />
              <Tab
                value="personal"
                label="Personal"
                sx={{ textAlign: 'right', justifyContent: 'flex-end', width: '100%' }}
              />
              <Tab
                value="sessions"
                label="Sessions"
                sx={{ textAlign: 'right', justifyContent: 'flex-end', width: '100%' }}
              />
              <Tab
                value="billing"
                label="Billing"
                sx={{
                  textAlign: 'right',
                  justifyContent: 'flex-end',
                  width: '100%',
                  bgcolor: tab.startsWith('billing') ? 'action.selected' : undefined,
                }}
                onClick={() => selectTab('billing')}
              />
              <Box
                sx={{
                  display: tab.startsWith('billing') ? 'flex' : 'none',
                  flexDirection: 'column',
                  width: '100%',
                  pr: 0,
                  pl: 0,
                }}
              >
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: 160,
                      borderLeft: 2,
                      borderColor: 'divider',
                      ml: 'auto',
                      pr: 0,
                    }}
                  >
                    <Tab
                      value="billing-retainers"
                      label="Retainers"
                      sx={{
                        pl: 4,
                        fontSize: '0.82rem',
                        color: 'text.secondary',
                        '&.Mui-selected': { color: 'text.primary', fontWeight: 600 },
                        textAlign: 'right',
                        justifyContent: 'flex-end',
                        width: '100%',
                      }}
                      onClick={() => selectTab('billing-retainers')}
                    />
                    <Tab
                      value="billing-history"
                      label="Payment History"
                      sx={{
                        pl: 4,
                        fontSize: '0.82rem',
                        color: 'text.secondary',
                        '&.Mui-selected': { color: 'text.primary', fontWeight: 600 },
                        textAlign: 'right',
                        justifyContent: 'flex-end',
                        width: '100%',
                      }}
                      onClick={() => selectTab('billing-history')}
                    />
                  </Box>
                </Box>
              </Box>
            </Tabs>
          </Box>
        </Box>
      </FloatingWindow>
    </StudentDialogErrorBoundary>
  )
}
