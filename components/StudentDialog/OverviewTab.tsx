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
  query,
  orderBy,
  limit,
  where,
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
  const [overview, setOverview] = useState<any>({})
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [sessions, setSessions] = useState<any[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    let mounted = true

    const loadLatest = async (col: string) => {
      console.log(`📥 fetching ${abbr}/${col}`)
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
      console.log(`✅ ${abbr} ${col}=${val}`)
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
      'balanceDue',
      'voucherBalance',
    ].forEach((f) => {
      loadLatest(f).then((v) => {
        if (!mounted) return
        setBilling((b: any) => ({ ...b, [f]: v }))
        setBillingLoading((l) => ({ ...l, [f]: false }))
      })
    })

    // overview counts + sessions
    ;(async () => {
      // wait until names resolved
      const fullName = `${personal.firstName || ''} ${
        personal.lastName || ''
      }`.trim()
      console.log(`📥 sessions for ${fullName}`)
      const snap = await getDocs(
        query(collection(db, 'Sessions'), where('sessionName', '==', fullName))
      )
      console.log(`   found ${snap.size} sessions`)
      const dates = await Promise.all(
        snap.docs.map(async (sd) => {
          const h = await getDocs(
            query(
              collection(db, 'Sessions', sd.id, 'appointmentHistory'),
              orderBy('dateStamp', 'desc'),
              orderBy('timeStamp', 'desc'),
              limit(1)
            )
          )
          console.log(`   history entries for ${sd.id}: ${h.size}`)
          if (!h.empty) {
            const d = h.docs[0].data() as any
            return (d.newDate?.toDate() || d.origDate.toDate()) as Date
          }
          return (sd.data() as any).sessionDate.toDate() as Date
        })
      )
      if (!mounted) return

      const sorted = dates.sort((a, b) => a.getTime() - b.getTime())
      const now = new Date()
      setOverview({
        total: sorted.length,
        upcoming: sorted.filter((d) => d > now).length,
        joint: sorted[0]?.toLocaleDateString() || '',
      })
      setOverviewLoading(false)

      // sessions table
      const rows = await Promise.all(
        snap.docs.map(async (sd) => {
          const d = sd.data() as any
          const h = await getDocs(
            query(
              collection(db, 'Sessions', sd.id, 'appointmentHistory'),
              orderBy('dateStamp', 'desc'),
              orderBy('timeStamp', 'desc'),
              limit(1)
            )
          )
          const rec = !h.empty ? (h.docs[0].data() as any) : null
          const dt = rec
            ? (rec.newDate?.toDate() || rec.origDate.toDate()) as Date
            : d.sessionDate.toDate()
          const tm = rec ? rec.newTime || rec.origTime : d.sessionTime
          return {
            date: dt.toLocaleDateString(),
            time: tm,
            duration: d.duration,
            sessionType: d.sessionType,
            billingType: d.billingType,
            baseRate: d.baseRate,
            rateCharged: d.rateCharged,
            paymentStatus: d.paymentStatus,
          }
        })
      )
      if (!mounted) return
      setSessions(rows)
      setSessionsLoading(false)

      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [open, abbr, personal.firstName, personal.lastName])

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
              {tab === 0 && (
                <>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Legal Name{' '}
                    {(personalLoading.firstName ||
                      personalLoading.lastName) && (
                      <CircularProgress size={14} />
                    )}
                  </Typography>
                  <Typography variant="body2">
                    {(personalLoading.firstName ||
                      personalLoading.lastName)
                      ? 'Loading…'
                      : `${personal.firstName} ${personal.lastName}`}
                  </Typography>

                  <Typography variant="subtitle2" fontWeight="bold">
                    Sex{' '}
                    {personalLoading.sex && <CircularProgress size={14} />}
                  </Typography>
                  {personalLoading.sex ? (
                    <Typography variant="body2">Loading…</Typography>
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

                  <Typography variant="subtitle2" fontWeight="bold">
                    Joint Date{' '}
                    {overviewLoading && <CircularProgress size={14} />}
                  </Typography>
                  {overviewLoading ? (
                    <Typography variant="body2">Loading…</Typography>
                  ) : (
                    <Typography variant="body2">{overview.joint}</Typography>
                  )}

                  <Typography variant="subtitle2" fontWeight="bold">
                    Total Sessions{' '}
                    {overviewLoading && <CircularProgress size={14} />}
                  </Typography>
                  {overviewLoading ? (
                    <Typography variant="body2">Loading…</Typography>
                  ) : (
                    <Typography variant="body2">
                      {overview.total}
                      {overview.upcoming > 0
                        ? ` → ${overview.upcoming}`
                        : ''}
                    </Typography>
                  )}

                  <Typography variant="subtitle2" fontWeight="bold">
                    Balance Due{' '}
                    {billingLoading.balanceDue && <CircularProgress size={14} />}
                  </Typography>
                  {billingLoading.balanceDue ? (
                    <Typography variant="body2">Loading…</Typography>
                  ) : (
                    <Typography variant="body2">
                      ${ (parseFloat(billing.balanceDue as any) || 0).toFixed(2) }
                    </Typography>
                  )}

                  <Typography variant="subtitle2" fontWeight="bold">
                    Session Voucher{' '}
                    {billingLoading.voucherBalance && (
                      <CircularProgress size={14} />
                    )}
                  </Typography>
                  {billingLoading.voucherBalance ? (
                    <Typography variant="body2">Loading…</Typography>
                  ) : (
                    <Typography variant="body2">
                      {billing.voucherBalance ?? '0'}
                    </Typography>
                  )}
                </>
              )}
              {tab === 1 && (
                <PersonalTab
                  abbr={abbr}
                  personal={personal}
                  serviceMode={serviceMode}
                />
              )}
              {tab === 2 && (
                <BillingTab abbr={abbr} billing={billing} serviceMode={serviceMode} />
              )}
              {tab === 3 && (
                sessionsLoading ? (
                  <CircularProgress />
                ) : (
                  <SessionsTab sessions={sessions} />
                )
              )}
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
              {['Overview', 'Personal', 'Billing', 'Sessions'].map((l) => (
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
