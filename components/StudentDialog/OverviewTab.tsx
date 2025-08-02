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
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import InlineEdit from '../../common/InlineEdit'
import PersonalTab from './PersonalTab'
import BillingTab from './BillingTab'
import SessionsTab from './SessionsTab'

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
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)

  // personal
  const [personal, setPersonal] = useState<any>({})
  const [personalLoading, setPersonalLoading] = useState({
    firstName: true,
    lastName: true,
    sex: true,
    birthDate: true,
  })

  // billing
  const [billing, setBilling] = useState<any>({})
  const [billingLoading, setBillingLoading] = useState({
    billingCompany: true,
    defaultBillingType: true,
    baseRate: true,
    retainerStatus: true,
    lastPaymentDate: true,
    balanceDue: true,
    voucherBalance: true,
  })

  // overview + sessions
  const [overview, setOverview] = useState<any>({ joint: '', last: '', total: 0 })
  const [overviewLoading, setOverviewLoading] = useState(true)

  const handleBalanceDue = (n: number) => {
    setBilling((b: any) => ({ ...b, balanceDue: n }))
    setBillingLoading((l) => ({ ...l, balanceDue: false }))
  }

  const handleSummary = (s: {
    jointDate: string
    lastSession: string
    totalSessions: number
  }) => {
    setOverview({ joint: s.jointDate, last: s.lastSession, total: s.totalSessions })
  }

  useEffect(() => {
    if (!open) return
    let mounted = true

    const loadLatest = async (col: string) => {
      let collectionName = col
      let field = col
      if (col === 'baseRate') {
        collectionName = 'BaseRateHistory'
        field = 'rate'
      }
      if (col === 'defaultBillingType') {
        collectionName = 'billingType'
        field = 'billingType'
      }
      const snap = await getDocs(
        query(
          collection(db, 'Students', abbr, collectionName),
          orderBy('timestamp', 'desc'),
          limit(1)
        )
      )
      if (snap.empty) {
        console.warn(`⚠️ no ${col} for ${abbr}`)
        return ''
      }
      const val = (snap.docs[0].data() as any)[field]
      return val
    }

    // load personal fields
    ;['firstName', 'lastName', 'sex', 'birthDate'].forEach((f) => {
      loadLatest(f).then((v) => {
        if (!mounted) return
        setPersonal((p: any) => ({ ...p, [f]: v }))
        setPersonalLoading((l) => ({ ...l, [f]: false }))
      })
    })

    // load billing fields
    ;[
      'billingCompany',
      'defaultBillingType',
      'baseRate',
      'retainerStatus',
      'lastPaymentDate',
      'voucherBalance',
    ].forEach((f) => {
      loadLatest(f).then((v) => {
        if (!mounted) return
        setBilling((b: any) => ({ ...b, [f]: v }))
        setBillingLoading((l) => ({ ...l, [f]: false }))
      })
    })

    // load overview summary from student profile
    ;(async () => {
      const studSnap = await getDoc(doc(db, 'Students', abbr))
      const studData = studSnap.exists() ? (studSnap.data() as any) : {}
      if (!mounted) return
      setOverview({
        joint: studData.jointDate || '',
        last: studData.lastSession || '',
        total: studData.totalSessions ?? 0,
      })
      setOverviewLoading(false)
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [open, abbr, account])

  return (
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
                    : `${personal.firstName} ${personal.lastName}`}
                </Typography>

                <Typography variant="subtitle2">
                  Gender {personalLoading.sex && <CircularProgress size={14} />}
                </Typography>
                {personalLoading.sex ? (
                  <Typography variant="h6">Loading…</Typography>
                ) : (
                  <InlineEdit
                    value={personal.sex}
                    fieldPath={`Students/${abbr}/sex`}
                    fieldKey="sex"
                    editable={serviceMode}
                    type="select"
                    options={['Male', 'Female', 'Other']}
                  />
                )}

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
                    {billing.voucherBalance ?? '0'}
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: tab === 1 ? 'block' : 'none' }}>
                <PersonalTab
                  abbr={abbr}
                  personal={personal}
                  jointDate={overview.joint}
                  totalSessions={overview.total}
                  serviceMode={serviceMode}
                />
              </Box>

              <Box sx={{ display: tab === 2 ? 'block' : 'none' }}>
                <SessionsTab
                  abbr={abbr}
                  account={account}
                  jointDate={overview.joint}
                  lastSession={overview.last}
                  totalSessions={overview.total}
                  onSummary={handleSummary}
                />
              </Box>

              <Box sx={{ display: tab === 3 ? 'block' : 'none' }}>
                <BillingTab
                  abbr={abbr}
                  account={account}
                  billing={billing}
                  serviceMode={serviceMode}
                  onBalanceDue={handleBalanceDue}
                />
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
  )
}
