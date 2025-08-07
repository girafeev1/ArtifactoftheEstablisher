// components/StudentDialog/OverviewTab.tsx

import React, { useEffect, useState, useCallback } from 'react'
import { Tabs, Tab, Box, CircularProgress, Typography, Button } from '@mui/material'
import FloatingWindow from './FloatingWindow'

// OverviewTab acts purely as a presenter. PersonalTab, SessionsTab and
// BillingTab each fetch and compute their own data then "stream" summary
// values upward via callbacks. This "stream-from-owner" architecture keeps a
// single source of truth in the owning tab, avoids duplicated logic and ensures
// OverviewTab never queries Firestore directly.
import PersonalTab from './PersonalTab'
import BillingTab from './BillingTab'
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
  const [tab, setTab] = useState(0)
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
      setTab(0)
      setTitle(account)
      setActions(null)
    }
  }, [open])

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
              <Box sx={{ display: tab === 0 ? 'block' : 'none' }}>
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
                style={{ display: tab === 1 ? 'block' : 'none' }}
              />

              <SessionsTab
                abbr={abbr}
                account={account}
                onSummary={handleSummary}
                onTitle={setTitle}
                onActions={setActions}
                onPopDetail={onPopDetail}
                style={{ display: tab === 2 ? 'block' : 'none' }}
              />

              <BillingTab
                abbr={abbr}
                account={account}
                serviceMode={serviceMode}
                onBilling={handleBilling}
                style={{ display: tab === 3 ? 'block' : 'none' }}
              />
              <Box sx={{ display: tab === 4 ? 'block' : 'none' }}>
                <PaymentHistory abbr={abbr} account={account} />
              </Box>
            </Box>

            <Tabs
              orientation="vertical"
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{
                borderLeft: 1,
                borderColor: 'divider',
                minWidth: 140,
                alignItems: 'flex-end',
                display: loading ? 'none' : 'flex',
              }}
            >
              {['Overview', 'Personal', 'Sessions', 'Billing', 'Payment History'].map((l) => (
                <Tab
                  key={l}
                  label={l}
                  sx={{
                    textAlign: 'right',
                    justifyContent: 'flex-end',
                    alignItems: 'flex-end',
                    width: '100%',
                  }}
                />
              ))}
            </Tabs>
          </Box>
        </Box>
      </FloatingWindow>
    </StudentDialogErrorBoundary>
  )
}
