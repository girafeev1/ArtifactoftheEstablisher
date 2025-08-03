// components/StudentDialog/BillingTab.tsx

import React, { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import InlineEdit from '../../common/InlineEdit'

console.log('=== StudentDialog loaded version 1.1 ===')

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD' }).format(n)

const LABELS: Record<string, string> = {
  billingCompany: 'Billing Company Info',
  defaultBillingType: 'Default Billing Type',
  baseRate: 'Base Rate',
  retainerStatus: 'Retainer Status',
  lastPaymentDate: 'Last Payment',
  balanceDue: 'Balance Due',
  voucherBalance: 'Voucher Balance',
}

// BillingTab owns all billing-related fetching and calculations. It streams
// summary values (Balance Due, Voucher Balance) up to OverviewTab via
// `onBilling`.

export default function BillingTab({
  abbr,
  account,
  serviceMode,
  onBilling,
  style,
}: {
  abbr: string
  account: string
  serviceMode: boolean
  onBilling?: (b: Partial<{ balanceDue: number; voucherBalance: number }>) => void
  style?: React.CSSProperties
}) {
  console.log('Rendering BillingTab for', abbr)
  const [fields, setFields] = useState<any>({})
  const [loading, setLoading] = useState<any>({
    billingCompany: true,
    defaultBillingType: true,
    baseRate: true,
    retainerStatus: true,
    lastPaymentDate: true,
    balanceDue: true,
    voucherBalance: true,
  })

  const loadLatest = async (sub: string, field: string, orderField = 'timestamp') => {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'Students', abbr, sub),
          orderBy(orderField, 'desc'),
          limit(1),
        ),
      )
      return snap.empty ? undefined : (snap.docs[0].data() as any)[field]
    } catch (e) {
      console.error(`load ${sub} failed`, e)
      return '__ERROR__'
    }
  }

  useEffect(() => {
    console.log('BillingTab effect: load simple fields for', abbr)
    let cancelled = false
    ;(async () => {
      const simple = [
        'billingCompany',
        'defaultBillingType',
        'baseRate',
        'retainerStatus',
        'lastPaymentDate',
        'voucherBalance',
      ]
      for (const f of simple) {
        try {
          let val: any
          if (f === 'baseRate') {
            val = await loadLatest('BaseRateHistory', 'rate')
            if (val === undefined || val === '__ERROR__') {
              val = await loadLatest('BaseRate', 'baseRate')
            }
          } else if (f === 'lastPaymentDate') {
            val = await loadLatest('Payments', 'paymentMade', 'paymentMade')
          } else if (f === 'defaultBillingType') {
            val = await loadLatest('billingType', f)
          } else {
            val = await loadLatest(f, f)
          }
          if (cancelled) return
          setFields((b: any) => ({ ...b, [f]: val }))
          setLoading((l: any) => {
            const next = { ...l, [f]: false }
            console.log('Loading flags now:', next)
            return next
          })
          if (f === 'voucherBalance')
            onBilling?.({ voucherBalance: typeof val === 'number' ? val : undefined })
        } catch (e) {
          console.error(`${f} load failed`, e)
          if (cancelled) return
          setFields((b: any) => ({ ...b, [f]: '__ERROR__' }))
          setLoading((l: any) => {
            const next = { ...l, [f]: false }
            console.log('Loading flags now:', next)
            return next
          })
          if (f === 'voucherBalance') onBilling?.({ voucherBalance: undefined })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, onBilling])

  useEffect(() => {
    console.log('BillingTab effect: calculate balance due for', abbr)
    // Balance Due calculation
    let cancelled = false
    ;(async () => {
      try {
        const sessSnap = await getDocs(
          query(collection(db, 'Sessions'), where('sessionName', '==', account)),
        )

        const rowPromises = sessSnap.docs.map(async (sd) => {
          const [histSnap, rateSnap] = await Promise.all([
            getDocs(collection(db, 'Sessions', sd.id, 'appointmentHistory')),
            getDocs(collection(db, 'Sessions', sd.id, 'rateCharged')),
          ])
          return {
            history: histSnap.docs.map((d) => ({ ...(d.data() as any) })),
            rateDocs: rateSnap.docs.map((d) => ({ ...(d.data() as any) })),
          }
        })

          const [histSnap, altSnap, paymentSnap, sessionRows] = await Promise.all([
            getDocs(collection(db, 'Students', abbr, 'BaseRateHistory')),
            getDocs(collection(db, 'Students', abbr, 'BaseRate')),
            getDocs(query(collection(db, 'Students', abbr, 'Payments'), orderBy('paymentMade'))),
            Promise.all(rowPromises),
          ])

          const baseRateDocs = [...histSnap.docs, ...altSnap.docs]
          const baseRates = baseRateDocs
            .map((d) => {
              const data = d.data() as any
              return {
                rate: data.rate ?? data.baseRate,
                ts: data.timestamp?.toDate?.() ?? new Date(0),
              }
            })
            .sort((a, b) => a.ts.getTime() - b.ts.getTime())

        const parseDate = (v: any): Date | null => {
          if (!v) return null
          try {
            const d = v.toDate ? v.toDate() : new Date(v)
            return isNaN(d.getTime()) ? null : d
          } catch {
            return null
          }
        }

        let totalOwed = 0
        sessionRows.forEach(({ history, rateDocs }) => {
          const hist = history
            .slice()
            .sort((a: any, b: any) => {
              const ta = parseDate(a.changeTimestamp) || parseDate(a.timestamp) || new Date(0)
              const tb = parseDate(b.changeTimestamp) || parseDate(b.timestamp) || new Date(0)
              return tb.getTime() - ta.getTime()
            })[0]
          if (!hist) {
            console.warn('Session missing appointment history; skipping')
            return
          }
          const start =
            hist.newStartTimestamp != null ? hist.newStartTimestamp : hist.origStartTimestamp
          const startDate = parseDate(start)
          if (!startDate) {
            console.warn('Invalid start date; skipping session', start)
            return
          }
          const base = (() => {
            if (!baseRates.length) return '-'
            const entry = baseRates.filter((b) => b.ts.getTime() <= startDate.getTime()).pop()
            return entry ? entry.rate : '-'
          })()
          const rateHist = rateDocs
            .slice()
            .sort((a: any, b: any) => {
              const ta = parseDate(a.timestamp) || new Date(0)
              const tb = parseDate(b.timestamp) || new Date(0)
              return tb.getTime() - ta.getTime()
            })
          const latestRate = rateHist[0]?.rateCharged
          const rateCharged = latestRate != null ? Number(latestRate) : base
          if (rateCharged != null && !isNaN(Number(rateCharged))) totalOwed += Number(rateCharged)
        })

        const totalPaid = paymentSnap.docs.reduce((sum, d) => {
          const amt = Number((d.data() as any).amount) || 0
          return sum + amt
        }, 0)

        const balanceDue = totalOwed - totalPaid
        if (!cancelled) {
          setFields((b: any) => ({ ...b, balanceDue }))
          setLoading((l: any) => {
            const next = { ...l, balanceDue: false }
            console.log('Loading flags now:', next)
            return next
          })
          onBilling?.({ balanceDue })
        }
      } catch (e) {
        console.error('balance due calculation failed', e)
        if (!cancelled) {
          setFields((b: any) => ({ ...b, balanceDue: 0 }))
          setLoading((l: any) => {
            const next = { ...l, balanceDue: false }
            console.log('Loading flags now:', next)
            return next
          })
          onBilling?.({ balanceDue: 0 })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, account, onBilling])

  const renderField = (k: string) => {
    const v = fields[k]
    const path =
      k === 'defaultBillingType'
        ? `Students/${abbr}/billingType`
        : `Students/${abbr}/${k}`
    return (
      <Box key={k} mb={2}>
        <Typography variant="subtitle2">{LABELS[k]}</Typography>
        {loading[k] ? (
          <Typography variant="h6">Loading…</Typography>
        ) : k === 'baseRate' ? (
          <Typography variant="h6">
            {v != null && !isNaN(Number(v)) ? `${formatCurrency(Number(v))} / session` : '-'}
          </Typography>
        ) : ['balanceDue', 'voucherBalance'].includes(k) ? (
          <Typography variant="h6">
            {v != null && !isNaN(Number(v)) ? formatCurrency(Number(v)) : '-'}
          </Typography>
        ) : k === 'lastPaymentDate' ? (
          <Typography variant="h6">
            {v ? (v.toDate ? v.toDate().toLocaleDateString() : new Date(v).toLocaleDateString()) : '-'}
          </Typography>
        ) : (
          <InlineEdit
            value={v}
            fieldPath={path}
            fieldKey={k}
            editable={!['balanceDue', 'voucherBalance', 'lastPaymentDate'].includes(k)}
            serviceMode={serviceMode}
            type={k.includes('Date') ? 'date' : 'text'}
            onSaved={(val) => {
              setFields((b: any) => ({ ...b, [k]: val }))
              if (k === 'voucherBalance') onBilling?.({ voucherBalance: Number(val) })
            }}
          />
        )}
      </Box>
    )
  }

  return (
    <Box style={style} sx={{ textAlign: 'left', maxWidth: '100%', maxHeight: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
        Billing Information
      </Typography>
      {['balanceDue', 'baseRate', 'retainerStatus', 'lastPaymentDate', 'voucherBalance'].map(
        (k) => renderField(k),
      )}
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
        Payment Information
      </Typography>
      {['defaultBillingType', 'billingCompany'].map((k) => renderField(k))}
    </Box>
  )
}

