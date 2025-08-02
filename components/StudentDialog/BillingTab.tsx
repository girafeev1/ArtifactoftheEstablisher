// components/StudentDialog/BillingTab.tsx

import React, { useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD' }).format(
    n,
  )
import InlineEdit from '../../common/InlineEdit'

const LABELS: Record<string, string> = {
  billingCompany: 'Billing Company Info',
  defaultBillingType: 'Default Billing Type',
  baseRate: 'Base Rate',
  retainerStatus: 'Retainer Status',
  lastPaymentDate: 'Last Payment',
  balanceDue: 'Balance Due',
  voucherBalance: 'Voucher Balance',
}

export default function BillingTab({
  abbr,
  account,
  billing,
  serviceMode,
  onBalanceDue,
}: {
  abbr: string
  account: string
  billing: any
  serviceMode: boolean
  onBalanceDue?: (n: number) => void
}) {
  useEffect(() => {
    // BillingTab owns Balance Due calculation; OverviewTab consumes the result
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

        const [baseRateSnap, paymentSnap, sessionRows] = await Promise.all([
          getDocs(collection(db, 'Students', abbr, 'BaseRateHistory')),
          getDocs(
            query(
              collection(db, 'Students', abbr, 'Payments'),
              orderBy('paymentMade'),
            ),
          ),
          Promise.all(rowPromises),
        ])

        const baseRates = baseRateSnap.docs
          .map((d) => ({
            rate: (d.data() as any).rate,
            ts: (d.data() as any).timestamp?.toDate?.() ?? new Date(0),
          }))
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
              const ta =
                parseDate(a.changeTimestamp) || parseDate(a.timestamp) || new Date(0)
              const tb =
                parseDate(b.changeTimestamp) || parseDate(b.timestamp) || new Date(0)
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
            const entry = baseRates
              .filter((b) => b.ts.getTime() <= startDate.getTime())
              .pop()
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
          if (rateCharged != null && !isNaN(Number(rateCharged)))
            totalOwed += Number(rateCharged)
        })

        const totalPaid = paymentSnap.docs.reduce((sum, d) => {
          const amt = Number((d.data() as any).amount) || 0
          return sum + amt
        }, 0)

        const balanceDue = totalOwed - totalPaid
        if (!cancelled) onBalanceDue?.(balanceDue)
      } catch (e) {
        console.error('balance due calculation failed', e)
        if (!cancelled) onBalanceDue?.(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, account, onBalanceDue])
  const renderField = (k: string) => {
    const v = billing[k]
    const path =
      k === 'defaultBillingType'
        ? `Students/${abbr}/billingType`
        : `Students/${abbr}/${k}`
    return (
      <Box key={k} mb={2}>
        <Typography variant="subtitle2">{LABELS[k]}</Typography>
        {k === 'baseRate' ? (
          <Typography variant="h6">
            {v != null && !isNaN(Number(v))
              ? `${formatCurrency(Number(v))} / session`
              : '-'}
          </Typography>
        ) : (
          <InlineEdit
            value={v}
            fieldPath={path}
            fieldKey={k}
            editable={!['balanceDue', 'voucherBalance'].includes(k)}
            serviceMode={serviceMode}
            type={k.includes('Date') ? 'date' : 'text'}
          />
        )}
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
        Billing Information
      </Typography>
      {['balanceDue', 'baseRate', 'retainerStatus', 'lastPaymentDate', 'voucherBalance'].map(renderField)}
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
        Payment Information
      </Typography>
      {['defaultBillingType', 'billingCompany'].map(renderField)}
    </Box>
  )
}
