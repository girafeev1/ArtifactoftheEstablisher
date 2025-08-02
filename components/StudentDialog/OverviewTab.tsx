// components/StudentDialog/OverviewTab.tsx

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Typography,
  Button,
} from '@mui/material'

// OverviewTab acts purely as a presenter. PersonalTab, SessionsTab and
// BillingTab each fetch and compute their own data then "stream" summary
// values upward via callbacks. OverviewTab never queries Firestore directly,
// keeping a single source of truth in the owning tab and avoiding duplicated
// logic across the dialog.
import PersonalTab from './PersonalTab'
import BillingTab from './BillingTab'
import SessionsTab from './SessionsTab'

console.log('=== StudentDialog loaded version 1.1 ===')

export interface OverviewTabProps {
  abbr: string
  account: string
  open: boolean
  onClose: () => void
  serviceMode: boolean
}

export default function OverviewTab({
  abbr,
  account,
  open,
  onClose,
  serviceMode,
}: OverviewTabProps) {
  console.log('OverviewTab rendered for', abbr)
  const [tab, setTab] = useState(0)

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

  const handlePersonal = (data: Partial<{ firstName: string; lastName: string; sex: string }>) => {
    setPersonal((p: any) => ({ ...p, ...data }))
    Object.keys(data).forEach((k) =>
      setPersonalLoading((l: any) => ({ ...l, [k]: false }))
    )
  }

  const handleBilling = (data: Partial<{ balanceDue: number; voucherBalance: number }>) => {
    setBilling((b: any) => ({ ...b, ...data }))
    Object.keys(data).forEach((k) =>
      setBillingLoading((l: any) => ({ ...l, [k]: false }))
    )
  }

  const handleSummary = (s: { jointDate: string; lastSession: string; totalSessions: number }) => {
    setOverview({ joint: s.jointDate, last: s.lastSession, total: s.totalSessions })
    setOverviewLoading(false)
  }

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
    if (v === undefined) return '404 Not Found'
    if (v === '') return 'N/A'
    return String(v)
  }

  const loading =
    Object.values(personalLoading).some((v) => v) ||
    Object.values(billingLoading).some((v) => v) ||
    overviewLoading

  class StudentDialogErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
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

  return (
    <StudentDialogErrorBoundary>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ textAlign: 'left' }}>{account}</DialogTitle>
      <DialogContent sx={{ display: 'flex', height: '70vh' }}>
        {loading ? (
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box
              sx={{
                flexGrow: 1,
                pr: 3,
                overflowY: 'auto',
                textAlign: 'left',
              }}
            >
              <Box sx={{ display: tab === 0 ? 'block' : 'none' }}>
                <Typography variant="subtitle2">
                  Legal Name{' '}
                  {(personalLoading.firstName || personalLoading.lastName) && (
                    <CircularProgress size={14} />
                  )}
                </Typography>
                <Typography variant="h6">
                  {(personalLoading.firstName || personalLoading.lastName)
                    ? 'Loading…'
                    : (() => {
                        const first = displayField(personal.firstName)
                        const last = displayField(personal.lastName)
                        const both = `${first} ${last}`.trim()
                        return both === '404 Not Found 404 Not Found'
                          ? '404 Not Found'
                          : both
                      })()}
                </Typography>

                <Typography variant="subtitle2">
                  Gender {personalLoading.sex && <CircularProgress size={14} />}
                </Typography>
                <Typography variant="h6">
                  {personalLoading.sex
                    ? 'Loading…'
                    : displayField(personal.sex)}
                </Typography>

                <Typography variant="subtitle2">
                  Joint Date {overviewLoading && <CircularProgress size={14} />}
                </Typography>
                {overviewLoading ? (
                  <Typography variant="h6">Loading…</Typography>
                ) : (
                  <Typography variant="h6">{overview.joint || '–'}</Typography>
                )}

                <Typography variant="subtitle2">
                  Total Sessions {overviewLoading && <CircularProgress size={14} />}
                </Typography>
                {overviewLoading ? (
                  <Typography variant="h6">Loading…</Typography>
                ) : (
                  <Typography variant="h6">{overview.total ?? '–'}</Typography>
                )}

                <Typography variant="subtitle2">
                  Balance Due {billingLoading.balanceDue && <CircularProgress size={14} />}
                </Typography>
                {billingLoading.balanceDue ? (
                  <Typography variant="h6">Loading…</Typography>
                ) : (
                  <Typography variant="h6">
                    {billing.balanceDue != null
                      ? `$${(Number(billing.balanceDue) || 0).toFixed(2)}`
                      : '-'}
                  </Typography>
                )}

                <Typography variant="subtitle2">
                  Session Voucher{' '}
                  {billingLoading.voucherBalance && <CircularProgress size={14} />}
                </Typography>
                {billingLoading.voucherBalance ? (
                  <Typography variant="h6">Loading…</Typography>
                ) : (
                  <Typography variant="h6">
                    {billing.voucherBalance ?? '-'}
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
                style={{ display: tab === 2 ? 'block' : 'none' }}
              />

              <BillingTab
                abbr={abbr}
                account={account}
                serviceMode={serviceMode}
                onBilling={handleBilling}
                style={{ display: tab === 3 ? 'block' : 'none' }}
              />
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
              }}
            >
              {['Overview', 'Personal', 'Sessions', 'Billing'].map((l) => (
                <Tab key={l} label={l} sx={{ textAlign: 'right' }} />
              ))}
            </Tabs>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      </Dialog>
    </StudentDialogErrorBoundary>
  )
}
