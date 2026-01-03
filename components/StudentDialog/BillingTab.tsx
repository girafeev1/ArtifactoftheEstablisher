// components/StudentDialog/BillingTab.tsx

import React, { useEffect, useState } from 'react'
import { Typography, Tooltip, Button } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

const { Text, Title } = Typography
import BaseRateHistoryDialog from './BaseRateHistoryDialog'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import InlineEdit from '../InlineEdit'
import { PATHS, logPath } from '../../lib/paths'
import { computeBalanceDue } from '../../lib/billing/balance'

console.log('=== StudentDialog loaded version 1.1 ===')

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)

const formatDate = (v: any) => {
  const d = v?.toDate ? v.toDate() : new Date(v)
  return isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
}

const LABELS: Record<string, string> = {
  billingCompany: 'Billing Company Info',
  defaultBillingType: 'Default Billing Type',
  baseRate: 'Base Rate',
  retainer: 'Retainer',
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
    retainer: true,
    lastPaymentDate: true,
    balanceDue: true,
    voucherBalance: true,
  })
  const [histOpen, setHistOpen] = useState(false)

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
          } else if (f === 'voucherBalance') {
            const mealPath = PATHS.freeMeal(abbr)
            logPath('freeMeal', mealPath)
            const mealSnap = await getDocs(collection(db, mealPath))
            const nowMs = Date.now()
            const tokens = mealSnap.docs.reduce((sum, d) => {
              const data = d.data() as any
              const eff =
                data.effectiveDate?.toDate?.()?.getTime() ??
                new Date(data.effectiveDate).getTime()
              const ts = !isNaN(eff)
                ? eff
                : data.timestamp?.toDate?.()?.getTime() ||
                  new Date(data.timestamp).getTime() ||
                  0
              return ts <= nowMs ? sum + (Number(data.Token) || 0) : sum
            }, 0)
            const sessionsPath = PATHS.sessions
            logPath('sessions', sessionsPath)
            const sessSnap = await getDocs(
              query(collection(db, sessionsPath), where('sessionName', '==', account)),
            )
            let used = 0
            for (const sd of sessSnap.docs) {
              const voucherPath = PATHS.sessionVoucher(sd.id)
              logPath('sessionVoucher', voucherPath)
              const vSnap = await getDocs(collection(db, voucherPath))
              const vUsed = vSnap.docs.some((v) =>
                Object.values(v.data() || {}).some(Boolean),
              )
              if (vUsed) used += 1
            }
            val = tokens - used
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

      try {
        const p = PATHS.retainers(abbr)
        logPath('retainers', p)
        const snap = await getDocs(collection(db, p))
        const today = new Date()
        let label = 'Inactive'
        const active = snap.docs
          .map((d) => d.data() as any)
          .find((r) => {
            const s = r.retainerStarts?.toDate?.() ?? new Date(r.retainerStarts)
            const e = r.retainerEnds?.toDate?.() ?? new Date(r.retainerEnds)
            return today >= s && today <= e
          })
        if (active) {
          const labelDate = active.retainerStarts?.toDate?.()
            ? active.retainerStarts.toDate()
            : new Date(active.retainerStarts)
          if (labelDate.getDate() >= 21)
            labelDate.setMonth(labelDate.getMonth() + 1)
          label = labelDate.toLocaleString('en-US', {
            month: 'short',
            year: 'numeric',
          })
        }
        if (cancelled) return
        setFields((b: any) => ({ ...b, retainer: label }))
        setLoading((l: any) => ({ ...l, retainer: false }))
      } catch (e) {
        console.error('retainer load failed', e)
        if (cancelled) return
        setFields((b: any) => ({ ...b, retainer: '__ERROR__' }))
        setLoading((l: any) => ({ ...l, retainer: false }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, account, onBilling])

  useEffect(() => {
    console.log('BillingTab effect: calculate balance due for', abbr)
    // Balance Due calculation
    let cancelled = false
    ;(async () => {
      try {
        const balanceDue = await computeBalanceDue(abbr, account)
        if (!cancelled) {
          setFields((b: any) => ({ ...b, balanceDue }))
          setLoading((l: any) => ({ ...l, balanceDue: false }))
          onBilling?.({ balanceDue })
        }
      } catch (e) {
        console.error('balance due calculation failed', e)
        if (!cancelled) {
          setFields((b: any) => ({ ...b, balanceDue: 0 }))
          setLoading((l: any) => ({ ...l, balanceDue: false }))
          onBilling?.({ balanceDue: 0 })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, account, onBilling])

  const labelStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 200 }
  const valueStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 500, margin: 0 }

  const renderField = (k: string) => {
    const v = fields[k]
    return (
      <div key={k} style={{ marginBottom: 16 }}>
        <Text type="secondary" style={labelStyle}>
          {LABELS[k]}:
          {k === 'baseRate' && (
            <Tooltip title="Base rate history">
              <Button
                type="text"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => setHistOpen(true)}
                style={{ marginLeft: 4 }}
              />
            </Tooltip>
          )}
        </Text>
        {loading[k] ? (
          <Title level={5} style={valueStyle}>
            Loading…
          </Title>
        ) : k === 'baseRate' ? (
          <Title level={5} style={valueStyle}>
            {v != null && !isNaN(Number(v)) ? `${formatCurrency(Number(v))} / session` : '-'}
          </Title>
        ) : k === 'balanceDue' ? (
          <Title level={5} style={valueStyle}>
            {v != null && !isNaN(Number(v)) ? formatCurrency(Number(v)) : '-'}
          </Title>
        ) : k === 'voucherBalance' ? (
          <Title level={5} style={valueStyle}>
            {v != null && !isNaN(Number(v)) ? Number(v) : '-'}
          </Title>
        ) : k === 'lastPaymentDate' ? (
          <Title level={5} style={valueStyle}>
            {v === '__ERROR__' ? 'Error' : formatDate(v)}
          </Title>
        ) : k === 'retainer' ? (
          <Title level={5} style={valueStyle}>
            {v === '__ERROR__' ? 'Error' : v || 'Inactive'}
          </Title>
        ) : (
          <InlineEdit
            value={v}
            fieldPath={
              k === 'defaultBillingType'
                ? `Students/${abbr}/billingType`
                : k === 'voucherBalance'
                ? `Students/${abbr}/freeMeal`
                : `Students/${abbr}/${k}`
            }
            fieldKey={k === 'voucherBalance' ? 'Token' : k}
            editable={!['balanceDue', 'lastPaymentDate'].includes(k)}
            serviceMode={serviceMode}
            type={k.includes('Date') ? 'date' : 'text'}
            onSaved={(val) => {
              if (k === 'voucherBalance') {
                setFields((b: any) => ({
                  ...b,
                  voucherBalance: (Number(b.voucherBalance) || 0) + Number(val),
                }))
                onBilling?.({
                  voucherBalance: (Number(fields.voucherBalance) || 0) + Number(val),
                })
              } else {
                setFields((b: any) => ({ ...b, [k]: val }))
              }
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        ...style,
        textAlign: 'left',
        maxWidth: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flexGrow: 1, overflow: 'auto', padding: 8 }}>
        <Text style={{ fontFamily: 'Cantata One', textDecoration: 'underline', display: 'block', marginBottom: 8 }}>
          Billing Information
        </Text>
        {[
          'balanceDue',
          'baseRate',
          'retainer',
          'lastPaymentDate',
          'voucherBalance',
        ].map((k) => renderField(k))}
        <Text style={{ fontFamily: 'Cantata One', textDecoration: 'underline', display: 'block', marginTop: 16, marginBottom: 8 }}>
          Payment Information
        </Text>
        {['defaultBillingType', 'billingCompany'].map((k) => renderField(k))}
      </div>
      <BaseRateHistoryDialog
        abbr={abbr}
        account={account}
        open={histOpen}
        onClose={() => setHistOpen(false)}
      />
    </div>
  )
}

