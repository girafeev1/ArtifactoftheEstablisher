// components/StudentDialog/SessionsTab.tsx

import React, { useEffect, useState } from 'react'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)
import { Typography, Table, Spin, Checkbox, Select, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'

const { Text, Title } = Typography

import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import SessionDetail from './SessionDetail'
import { formatMMMDDYYYY } from '../../lib/date'
import { PATHS, logPath } from '../../lib/paths'
import { useSession } from 'next-auth/react'
import { useColumnWidths } from '../../lib/useColumnWidths'
import { sessionsComparator } from '../../lib/sessionsSort'
import { toHKMidnight } from '../../lib/time'

console.log('=== StudentDialog loaded version 1.1 ===')

// SessionsTab is the single source of truth for session data. It fetches
// appointment history, base rates and payments then streams summary values up
// to OverviewTab via `onSummary`.

const toHKDate = (d: Date) => {
  const hk = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  const y = hk.getUTCFullYear()
  const m = String(hk.getUTCMonth() + 1).padStart(2, '0')
  const day = String(hk.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const toHKTime = (d: Date) => {
  const hk = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  const h = String(hk.getUTCHours()).padStart(2, '0')
  const m = String(hk.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// SessionsTab used to allow inline editing for rate and payment status.
// Inline editing has been removed; edits now occur in the SessionDetail view.

export default function SessionsTab({
  abbr,
  account,
  onSummary,
  onTitle,
  onActions: _onActions,
  style,
  onPopDetail,
}: {
  abbr: string
  account: string
  onSummary?: (s: {
    jointDate: string
    lastSession: string
    totalSessions: number
    proceeded: number
    cancelled: number
  }) => void
  onTitle?: (t: string) => void
  onActions?: (a: React.ReactNode | null) => void
  style?: React.CSSProperties
  onPopDetail?: (s: any) => void
}) {
  console.log('Rendering SessionsTab for', abbr)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any | null>(null)
  const allColumns = [
    { key: 'ordinal', label: '#', width: 60 },
    { key: 'date', label: 'Date', width: 110 },
    { key: 'time', label: 'Time', width: 100 },
    { key: 'duration', label: 'Duration', width: 110 },
    { key: 'sessionType', label: 'Session Type', width: 150 },
    { key: 'billingType', label: 'Billing Type', width: 150 },
    { key: 'voucherBalance', label: 'Voucher Balance', width: 170 },
    { key: 'baseRate', label: 'Base Rate', width: 140 },
    { key: 'rateCharged', label: 'Rate Charged', width: 140 },
    { key: 'paymentStatus', label: 'Payment Status', width: 150 },
    { key: 'payOn', label: 'Pay on', width: 160 },
  ]
  const { data: session } = useSession()
  const userEmail = session?.user?.email || 'anon'
  const { widths, startResize, dblClickResize, keyResize } = useColumnWidths(
    'sessions',
    allColumns,
    userEmail,
  )
  const tableRef = React.useRef<HTMLTableElement>(null)
  const colWidth = (key: string) => widths[key]
  const defaultCols = [
    'date',
    'time',
    'sessionType',
    'billingType',
    'rateCharged',
    'paymentStatus',
    'payOn',
  ]
  const storageKey = `sessions:cols:${userEmail}`
  const getInitialCols = () => {
    if (typeof window === 'undefined') return defaultCols
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed as string[]
      }
    } catch {
      // ignore
    }
    return defaultCols
  }
  const [visibleCols, setVisibleCols] = useState<string[]>(getInitialCols)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(visibleCols))
    }
  }, [storageKey, visibleCols])
  const [period, setPeriod] = useState<'30' | '90' | 'all'>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [summary, setSummary] = useState({
    jointDate: '',
    lastSession: '',
    totalSessions: 0,
    proceeded: 0,
    cancelled: 0,
  })
  const [hover, setHover] = useState(false)
  const [voucherBalance, setVoucherBalance] = useState<number | null>(null)
  const sortStorageKey = `sessions:sort:${userEmail}`
  const getInitialSort = () => {
    if (typeof window === 'undefined') return { by: 'date', dir: 'desc' }
    try {
      const raw = localStorage.getItem(sortStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.by && parsed.dir) return parsed
      }
    } catch {
      // ignore
    }
    return { by: 'date', dir: 'desc' }
  }
  const [{ by: sortBy, dir: sortDir }, setSort] = useState(getInitialSort)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        sortStorageKey,
        JSON.stringify({ by: sortBy, dir: sortDir }),
      )
    }
  }, [sortBy, sortDir, sortStorageKey])
  const handleSort = (key: string) => {
    setSort((prev: { by: string; dir: 'asc' | 'desc' }) =>
      prev.by === key ? { by: key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by: key, dir: 'asc' },
    )
  }

  useEffect(() => {
    console.log('SessionsTab effect: load sessions for', abbr)
    // SessionsTab owns session summary calculation; OverviewTab consumes the result
    let cancelled = false
    ;(async () => {
      try {
        const sessionsPath = PATHS.sessions
        logPath('sessions', sessionsPath)
        const sessSnap = await getDocs(
          query(collection(db, sessionsPath), where('sessionName', '==', account)),
        )

        const rowPromises = sessSnap.docs.map(async (sd) => {
          const histPath = PATHS.sessionHistory(sd.id)
          const ratePath = PATHS.sessionRate(sd.id)
          const payPath = PATHS.sessionPayment(sd.id)
          const voucherPath = PATHS.sessionVoucher(sd.id)
          logPath('sessionHistory', histPath)
          logPath('sessionRate', ratePath)
          logPath('sessionPayment', payPath)
          logPath('sessionVoucher', voucherPath)
          const [histSnap, rateSnap, paySnap, voucherSnap] = await Promise.all([
            getDocs(collection(db, histPath)),
            getDocs(collection(db, ratePath)),
            getDocs(collection(db, payPath)),
            getDocs(collection(db, voucherPath)),
          ])
          return {
            id: sd.id,
            data: sd.data(),
            history: histSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
            rateDocs: rateSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
            payments: paySnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
            vouchers: voucherSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
          }
        })

        const baseRateHistPath = PATHS.baseRateHistory(abbr)
        const baseRatePath = PATHS.baseRate(abbr)
        const retainersPath = PATHS.retainers(abbr)
        const freeMealPath = PATHS.freeMeal(abbr)
        const paymentsPath = PATHS.payments(abbr)
        logPath('baseRateHistory', baseRateHistPath)
        logPath('baseRate', baseRatePath)
        logPath('retainers', retainersPath)
        logPath('freeMeal', freeMealPath)
        logPath('payments', paymentsPath)
        const [
          histSnap,
          altSnap,
          retSnap,
          mealSnap,
          paySnap,
          sessionRows,
        ] = await Promise.all([
          getDocs(collection(db, baseRateHistPath)),
          getDocs(collection(db, baseRatePath)),
          getDocs(collection(db, retainersPath)),
          getDocs(collection(db, freeMealPath)),
          getDocs(collection(db, paymentsPath)),
          Promise.all(rowPromises),
        ])

        const baseRateDocs = [...histSnap.docs, ...altSnap.docs]
        const baseRates = baseRateDocs
          .map((d) => {
            const data = d.data() as any
            const raw = data.effectDate?.toDate?.() ?? data.timestamp?.toDate?.()
            const eff = raw ? toHKMidnight(raw) : new Date(0)
            return {
              rate: data.rate ?? data.baseRate,
              ts: eff,
            }
          })
          .sort((a, b) => a.ts.getTime() - b.ts.getTime())
        console.log('Base rate history:', baseRates)

        const payDocs = paySnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        const paymentMap = new Map(payDocs.map((p) => [p.id, p]))

        const parseDate = (v: any): Date | null => {
          if (!v) return null
          try {
            const d = v.toDate ? v.toDate() : new Date(v)
            return isNaN(d.getTime()) ? null : d
          } catch {
            return null
          }
        }

        const retainers = retSnap.docs.map((d) => {
          const data = d.data() as any
          const start =
            data.retainerStarts?.toDate?.()?.getTime() ??
            new Date(data.retainerStarts).getTime() ??
            0
          const end =
            data.retainerEnds?.toDate?.()?.getTime() ??
            new Date(data.retainerEnds).getTime() ??
            0
          const labelDate = new Date(start)
          if (!isNaN(labelDate.getTime()) && labelDate.getDate() >= 21)
            labelDate.setMonth(labelDate.getMonth() + 1)
          const name = isNaN(labelDate.getTime())
            ? '-'
            : labelDate.toLocaleString('en-US', {
                month: 'short',
                year: 'numeric',
              })
          const rate = Number(data.retainerRate) || 0
          const pay = data.paymentId ? paymentMap.get(data.paymentId) : undefined
          const paymentDate = parseDate(pay?.paymentMade) || null
          return { start, end, name, rate, paymentDate }
        })

        const rows = sessionRows
          .map(({ id, data, history, rateDocs, payments: sessPayments, vouchers }) => {
            console.log(`Session ${id} (${account}) appointment history:`, history)
            const sortedHist = history
              .slice()
              .sort((a: any, b: any) => {
                const ta =
                  parseDate(a.changeTimestamp) || parseDate(a.timestamp) || new Date(0)
                const tb =
                  parseDate(b.changeTimestamp) || parseDate(b.timestamp) || new Date(0)
                return tb.getTime() - ta.getTime()
              })
            if (!sortedHist.length) {
              console.warn(`Session ${id} has no appointment history`)
              return {
                id,
                sessionType: data.sessionType ?? 'N/A',
                billingType: data.billingType ?? 'N/A',
                date: 'No history',
                time: '-',
                duration: '-',
                baseRate: '-',
                rateCharged: data.rateCharged ?? '-',
                paymentStatus: 'Unpaid',
                payOn: '-',
                payOnMs: 0,
                startMs: 0,
              }
            }
            const hist: any = sortedHist[0]
            console.log(`Session ${id}: using history entry`, hist)
            let start = hist?.origStartTimestamp
            let end = hist?.origEndTimestamp
            if (
              hist?.newStartTimestamp != null &&
              hist?.newEndTimestamp != null
            ) {
              start = hist.newStartTimestamp
              end = hist.newEndTimestamp
            } else {
              if (hist?.newStartTimestamp != null) start = hist.newStartTimestamp
              if (hist?.newEndTimestamp != null) end = hist.newEndTimestamp
            }
            const startDate = parseDate(start)
            const endDate = parseDate(end)
            console.log(
              `Session ${id}: parsed start`,
              start,
              startDate,
              typeof start,
            )
            console.log(
              `Session ${id}: parsed end`,
              end,
              endDate,
              typeof end,
            )
            const date = startDate ? toHKDate(startDate) : '-'
            const startStr = startDate ? toHKTime(startDate) : '-'
            const endStr = endDate ? toHKTime(endDate) : ''
            const time = startStr + (endStr ? `-${endStr}` : '-')
            let duration = '-'
            if (startDate && endDate) {
              const hrs = (endDate.getTime() - startDate.getTime()) / 3600_000
              if (!isNaN(hrs)) duration = `${(Math.round(hrs * 100) / 100).toFixed(2)} hrs`
            }

            const base = (() => {
              if (!startDate || !baseRates.length) {
                console.warn(`Session ${id}: no base rates or invalid startDate`)
                return '-'
              }
              const day = toHKMidnight(startDate)
              const entry = baseRates
                .filter((b) => b.ts.getTime() <= day.getTime())
                .pop()
              console.log(`Session ${id}: base rates`, baseRates, 'selected', entry)
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
            let rateCharged = latestRate != null ? Number(latestRate) : base
            const rateSpecified = latestRate != null
            if (
              !rateSpecified &&
              data.sessionType?.toLowerCase() === 'virtual' &&
              typeof rateCharged === 'number'
            ) {
              rateCharged = rateCharged / 2
            }
            let rateSort = typeof rateCharged === 'number' ? rateCharged : Number(rateCharged) || 0

            const payDoc = sessPayments[0]
            const payDate = payDoc
              ? payDoc.paymentMade?.toDate?.() || new Date(payDoc.paymentMade)
              : null
            let payOn =
              payDate && !isNaN(payDate.getTime())
                ? formatMMMDDYYYY(payDate)
                : '-'
            let payOnMs = payDate && !isNaN(payDate.getTime()) ? payDate.getTime() : 0

            const startMs = startDate?.getTime() ?? 0
            const retainer = retainers.find(
              (r) => startMs >= r.start && startMs <= r.end,
            )
            const hasPayment = !!payDoc
            const voucherUsed = (() => {
              if (!vouchers.length) return false
              const sorted = vouchers
                .map((v) => {
                  const ts =
                    (v.timestamp?.toDate?.()?.getTime() ??
                      new Date(v.timestamp).getTime()) ||
                    0
                  return { ...v, ts }
                })
                .sort((a, b) => a.ts - b.ts)
              const latest = sorted[sorted.length - 1]
              return !!latest && latest['free?'] === true
            })()
            const sessionType = data.sessionType ?? 'N/A'

            let billingType = 'Per Session'
            let paymentStatus = hasPayment ? 'Paid' : 'Unpaid'

            if (sessionType?.toLowerCase() === 'cancelled') {
              rateCharged = 0
              billingType = 'N/A'
              paymentStatus = 'N/A'
              payOn = 'N/A'
              payOnMs = 0
            } else if (voucherUsed) {
              rateCharged = 0
              billingType = 'Session Voucher'
              paymentStatus = 'N/A'
              payOn = 'N/A'
              payOnMs = 0
            } else if (retainer) {
              billingType = 'Retainer'
              const pd = retainer.paymentDate
              paymentStatus = pd ? 'Paid' : 'Unpaid'
              payOn = pd ? formatMMMDDYYYY(pd) : '-'
              payOnMs = pd ? pd.getTime() : 0
              rateCharged = `${retainer.name} | ${formatCurrency(retainer.rate)}`
              rateSort = retainer.rate
            }

            return {
              id,
              sessionType,
              billingType,
              ordinal: 0,
              voucherBalance: 0,
              date,
              time,
              duration,
              baseRate: base,
              rateCharged,
              rateSort,
              paymentStatus,
              payOn,
              payOnMs,
              startMs,
              rateSpecified,
              voucherUsed,
            }
          })
          .sort((a, b) => a.startMs - b.startMs)

        const voucherEntries = mealSnap.docs
          .map((d) => {
            const data = d.data() as any
            const eff =
              data.effectiveDate?.toDate?.()?.getTime() ??
              new Date(data.effectiveDate).getTime()
            const ts = !isNaN(eff)
              ? eff
              : data.timestamp?.toDate?.()?.getTime() ||
                new Date(data.timestamp).getTime() ||
                0
            return {
              token: Number(data.Token) || 0,
              ts,
            }
          })
          .sort((a, b) => a.ts - b.ts)
        let tokenIdx = 0
        let running = 0
        rows.forEach((r) => {
          while (
            tokenIdx < voucherEntries.length &&
            voucherEntries[tokenIdx].ts <= r.startMs
          ) {
            running += voucherEntries[tokenIdx].token
            tokenIdx++
          }
          if (r.voucherUsed) running -= 1
          r.voucherBalance = running
        })
        const nowMs = Date.now()
        while (
          tokenIdx < voucherEntries.length &&
          voucherEntries[tokenIdx].ts <= nowMs
        ) {
          running += voucherEntries[tokenIdx].token
          tokenIdx++
        }
        const balance = running

        const firstIdx = rows.findIndex(
          (r) => r.sessionType?.toLowerCase() !== 'cancelled',
        )
        if (firstIdx >= 0) {
          const fs = rows[firstIdx]
          if (!fs.voucherUsed && fs.billingType !== 'Retainer') {
            fs.billingType = 'Trial Session'
            if (!fs.rateSpecified) fs.rateCharged = 500
          }
        }

        rows.forEach((r, i) => {
          delete r.rateSpecified
          r.ordinal = i + 1
        })

        const validDates = rows
          .filter((r) => r.startMs > 0)
          .map((r) => r.startMs)
          .sort((a, b) => a - b)
        const today = new Date()
        const lastPast = validDates.filter((ms) => ms <= today.getTime()).pop()
        const cancelledCount = rows.filter(
          (r) => r.sessionType?.toLowerCase() === 'cancelled',
        ).length
        const proceededCount = rows.filter(
          (r) =>
            r.sessionType?.toLowerCase() !== 'cancelled' &&
            r.startMs > 0 &&
            r.startMs <= today.getTime(),
        ).length
        const newSummary = {
          jointDate: validDates.length ? toHKDate(new Date(validDates[0])) : '',
          lastSession: lastPast ? toHKDate(new Date(lastPast)) : '',
          totalSessions: rows.length,
          proceeded: proceededCount,
          cancelled: cancelledCount,
        }
        console.log('Computed summary:', newSummary)

        const studRef = doc(db, PATHS.student(abbr))
        await setDoc(studRef, newSummary, { merge: true })

        if (!cancelled) {
          setSummary(newSummary)
          setSessions(rows)
          setVoucherBalance(balance)
          onSummary?.({
            jointDate: newSummary.jointDate,
            lastSession: newSummary.lastSession,
            totalSessions: newSummary.totalSessions,
            proceeded: newSummary.proceeded,
            cancelled: newSummary.cancelled,
          })
        }

        console.log('Final session rows:', rows)
      } catch (e) {
        console.error('load sessions failed', e)
        if (!cancelled) {
          setSessions([])
          setSummary({
            jointDate: '',
            lastSession: '',
            totalSessions: 0,
            proceeded: 0,
            cancelled: 0,
          })
          onSummary?.({
            jointDate: '',
            lastSession: '',
            totalSessions: 0,
            proceeded: 0,
            cancelled: 0,
          })
        }
      } finally {
        if (!cancelled)
          setLoading(() => {
            console.log('Loading flags now: false')
            return false
          })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, account, onSummary])

  const labelStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 200 }
  const valueStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 500, margin: 0 }

  if (loading) {
    return <Spin />
  }
  return (
    <div
      style={{ ...style, display: 'flex', flexDirection: 'column', height: '100%', textAlign: 'left' }}
    >
      <div style={{ flexGrow: 1, overflow: 'auto', padding: 8, paddingBottom: 64 }}>
        {!detail && (
          <>
          <Button
            size="small"
            onClick={() => setFiltersOpen((o) => !o)}
            style={{ marginBottom: 8 }}
            aria-label="toggle session filters"
          >
            Filters
          </Button>
          {filtersOpen && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Columns</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {allColumns
                  .filter((c) => c.key !== 'ordinal')
                  .map((c) => (
                    <Checkbox
                      key={c.key}
                      checked={visibleCols.includes(c.key)}
                      onChange={(e: { target: { checked: boolean } }) => {
                        const checked = e.target.checked
                        setVisibleCols((cols) =>
                          checked
                            ? [...cols, c.key]
                            : cols.filter((k) => k !== c.key),
                        )
                      }}
                    >
                      {c.label}
                    </Checkbox>
                  ))}
              </div>
              <Text strong style={{ display: 'block', marginTop: 8, marginBottom: 8 }}>Period</Text>
              <Select
                value={period}
                size="small"
                onChange={(val: '30' | '90' | 'all') => setPeriod(val)}
                style={{ width: 150 }}
                options={[
                  { label: 'Last 30 days', value: '30' },
                  { label: 'Last 90 days', value: '90' },
                  { label: 'All', value: 'all' },
                ]}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
            <div>
              <Text type="secondary" style={labelStyle}>
                Joined Date:
              </Text>
              <Title level={5} style={valueStyle}>
                {summary.jointDate || '–'}
              </Title>
            </div>
            <div>
              <Text type="secondary" style={labelStyle}>
                Last Session:
              </Text>
              <Title level={5} style={valueStyle}>
                {summary.lastSession || '–'}
              </Title>
            </div>
            <div>
              <Text type="secondary" style={labelStyle}>
                Total Sessions:
              </Text>
              <Title
                level={5}
                style={valueStyle}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
              >
                {hover
                  ? `✔︎ ${summary.proceeded ?? 0}`
                  : `${summary.totalSessions ?? '–'} (❌ ${summary.cancelled ?? '–'})`}
              </Title>
            </div>
            <div>
              <Text type="secondary" style={labelStyle}>
                Voucher Balance:
              </Text>
              <Title level={5} style={valueStyle}>
                {voucherBalance ?? '–'}
              </Title>
            </div>
          </div>

          {(() => {
            const cellStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 500 }
            const tableColumns: ColumnsType<any> = [
              {
                title: '#',
                dataIndex: 'ordinal',
                key: 'ordinal',
                width: colWidth('ordinal'),
                fixed: 'left',
                render: (v) => <span style={cellStyle}>{v}</span>,
              },
              ...(visibleCols.includes('date') ? [{
                title: 'Date',
                dataIndex: 'date',
                key: 'date',
                width: colWidth('date'),
                sorter: true,
                sortOrder: sortBy === 'date' ? (sortDir === 'asc' ? 'ascend' as const : 'descend' as const) : undefined,
                render: (v: string) => <span style={cellStyle}>{v}</span>,
              }] : []),
              ...(visibleCols.includes('time') ? [{
                title: 'Time',
                dataIndex: 'time',
                key: 'time',
                width: colWidth('time'),
                sorter: true,
                sortOrder: sortBy === 'time' ? (sortDir === 'asc' ? 'ascend' as const : 'descend' as const) : undefined,
                render: (v: string) => <span style={cellStyle}>{v}</span>,
              }] : []),
              ...(visibleCols.includes('duration') ? [{
                title: 'Duration',
                dataIndex: 'duration',
                key: 'duration',
                width: colWidth('duration'),
                render: (v: string) => <span style={cellStyle}>{v}</span>,
              }] : []),
              ...(visibleCols.includes('sessionType') ? [{
                title: 'Session Type',
                dataIndex: 'sessionType',
                key: 'sessionType',
                width: colWidth('sessionType'),
                sorter: true,
                sortOrder: sortBy === 'sessionType' ? (sortDir === 'asc' ? 'ascend' as const : 'descend' as const) : undefined,
                render: (v: string) => <span style={cellStyle}>{v}</span>,
              }] : []),
              ...(visibleCols.includes('billingType') ? [{
                title: 'Billing Type',
                dataIndex: 'billingType',
                key: 'billingType',
                width: colWidth('billingType'),
                sorter: true,
                sortOrder: sortBy === 'billingType' ? (sortDir === 'asc' ? 'ascend' as const : 'descend' as const) : undefined,
                render: (v: string) => <span style={cellStyle}>{v}</span>,
              }] : []),
              ...(visibleCols.includes('voucherBalance') ? [{
                title: 'Voucher Balance',
                dataIndex: 'voucherBalance',
                key: 'voucherBalance',
                width: colWidth('voucherBalance'),
                render: (v: number | null) => <span style={cellStyle}>{v ?? '-'}</span>,
              }] : []),
              ...(visibleCols.includes('baseRate') ? [{
                title: 'Base Rate',
                dataIndex: 'baseRate',
                key: 'baseRate',
                width: colWidth('baseRate'),
                render: (v: string | number) => <span style={cellStyle}>{v !== '-' ? formatCurrency(Number(v)) : '-'}</span>,
              }] : []),
              ...(visibleCols.includes('rateCharged') ? [{
                title: 'Rate Charged',
                dataIndex: 'rateCharged',
                key: 'rateCharged',
                width: colWidth('rateCharged'),
                sorter: true,
                sortOrder: sortBy === 'rateCharged' ? (sortDir === 'asc' ? 'ascend' as const : 'descend' as const) : undefined,
                render: (v: string | number) => <span style={cellStyle}>{typeof v === 'string' ? v : formatCurrency(Number(v))}</span>,
              }] : []),
              ...(visibleCols.includes('paymentStatus') ? [{
                title: 'Payment Status',
                dataIndex: 'paymentStatus',
                key: 'paymentStatus',
                width: colWidth('paymentStatus'),
                sorter: true,
                sortOrder: sortBy === 'paymentStatus' ? (sortDir === 'asc' ? 'ascend' as const : 'descend' as const) : undefined,
                render: (v: string) => <span style={cellStyle}>{v}</span>,
              }] : []),
              ...(visibleCols.includes('payOn') ? [{
                title: 'Pay on',
                dataIndex: 'payOn',
                key: 'payOn',
                width: colWidth('payOn'),
                sorter: true,
                sortOrder: sortBy === 'payOn' ? (sortDir === 'asc' ? 'ascend' as const : 'descend' as const) : undefined,
                render: (v: string) => <span style={cellStyle}>{v}</span>,
              }] : []),
            ]

            const filteredSessions = sessions.filter((s) => {
              if (period === 'all') return true
              const days = Number(period)
              const since = Date.now() - days * 24 * 60 * 60 * 1000
              return s.startMs >= since
            }).sort(sessionsComparator(sortBy, sortDir))

            return (
              <Table
                size="small"
                columns={tableColumns}
                dataSource={filteredSessions}
                rowKey="id"
                pagination={false}
                scroll={{ x: 'max-content' }}
                onRow={(s: any) => ({
                  onClick: () => {
                    setDetail(s)
                    const idx = sessions.findIndex((r) => r.id === s.id)
                    const num = String(idx + 1).padStart(3, '0')
                    const titleDate = new Date(s.startMs).toLocaleDateString(
                      undefined,
                      { month: 'short', day: '2-digit', year: 'numeric' },
                    )
                    const title = `${account} - #${num} | ${titleDate} ${s.time}`
                    onTitle?.(title)
                  },
                  style: { cursor: 'pointer' },
                })}
                onChange={(_: any, __: any, sorter: any) => {
                  if (sorter.field && sorter.order) {
                    setSort({ by: sorter.field, dir: sorter.order === 'ascend' ? 'asc' : 'desc' })
                  }
                }}
              />
            )
          })()}

          </>
        )}

        {detail && (
          <SessionDetail
            abbr={abbr}
            account={account}
            session={detail}
            onBack={() => {
              setDetail(null)
              onTitle?.(account)
            }}
          />
        )}
      </div>
      <div className="dialog-footer" style={{ padding: 8, display: 'flex', justifyContent: 'space-between' }} />
    </div>
  )
}
