// components/StudentDialog/SessionsTab.tsx

import React, { useEffect, useState } from 'react'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  Button,
  TableSortLabel,
} from '@mui/material'

import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import SessionDetail from './SessionDetail'
import { formatMMMDDYYYY } from '../../lib/date'
import { PATHS, logPath } from '../../lib/paths'
import { useSession } from 'next-auth/react'
import { useColumnWidths } from '../../lib/useColumnWidths'

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
  onSummary?: (s: { jointDate: string; lastSession: string; totalSessions: number }) => void
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
  const { widths, startResize } = useColumnWidths('sessions', allColumns, userEmail)
  const colWidth = (key: string) => widths[key]
  const defaultCols = [
    'date',
    'time',
    'sessionType',
    'billingType',
    'voucherBalance',
    'rateCharged',
    'paymentStatus',
    'payOn',
  ]
  const [visibleCols, setVisibleCols] = useState<string[]>(defaultCols)
  const [period, setPeriod] = useState<'30' | '90' | 'all'>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [summary, setSummary] = useState({
    jointDate: '',
    lastSession: '',
    totalSessions: 0,
  })
  const [voucherBalance, setVoucherBalance] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<string>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }
  const sortVal = (s: any, key: string) => {
    switch (key) {
      case 'date':
      case 'time':
        return s.startMs || 0
      case 'duration':
      case 'baseRate':
        return Number(s[key]) || 0
      case 'rateCharged':
        return Number(s.rateSort) || 0
      case 'payOn':
        return s.payOnMs || 0
      case 'paymentStatus':
      case 'sessionType':
      case 'billingType':
      case 'voucherBalance':
        return Number(s[key]) || 0
      default:
        return 0
    }
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
            return {
              rate: data.rate ?? data.baseRate,
              ts: data.timestamp?.toDate?.() ?? new Date(0),
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
              const entry = baseRates
                .filter((b) => b.ts.getTime() <= startDate.getTime())
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
        const newSummary = {
          jointDate: validDates.length ? toHKDate(new Date(validDates[0])) : '',
          lastSession: lastPast ? toHKDate(new Date(lastPast)) : '',
          totalSessions: rows.length,
        }
        console.log('Computed summary:', newSummary)

        const studRef = doc(db, PATHS.student(abbr))
        await setDoc(studRef, newSummary, { merge: true })

        if (!cancelled) {
          setSummary(newSummary)
          setSessions(rows)
          setVoucherBalance(balance)
          onSummary?.(newSummary)
        }

        console.log('Final session rows:', rows)
      } catch (e) {
        console.error('load sessions failed', e)
        if (!cancelled) {
          setSessions([])
          setSummary({ jointDate: '', lastSession: '', totalSessions: 0 })
          onSummary?.({ jointDate: '', lastSession: '', totalSessions: 0 })
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

  if (loading) {
    return <CircularProgress />
  }
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', textAlign: 'left' }}
      style={style}
    >
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1, pb: '64px' }}>
        {!detail && (
          <>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setFiltersOpen((o) => !o)}
            sx={{ mb: 1 }}
            aria-label="toggle session filters"
          >
            Filters
          </Button>
          {filtersOpen && (
            <Box mb={2}>
              <Typography variant="subtitle2">Columns</Typography>
              <FormGroup row>
                {allColumns
                  .filter((c) => c.key !== 'ordinal')
                  .map((c) => (
                    <FormControlLabel
                      key={c.key}
                      control={
                        <Checkbox
                          checked={visibleCols.includes(c.key)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setVisibleCols((cols) =>
                              checked
                                ? [...cols, c.key]
                                : cols.filter((k) => k !== c.key),
                            )
                          }}
                          size="small"
                        />
                      }
                      label={c.label}
                    />
                  ))}
              </FormGroup>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Period
              </Typography>
              <Select
                value={period}
                size="small"
                onChange={(e) => setPeriod(e.target.value as any)}
                MenuProps={{ disablePortal: false }}
              >
                <MenuItem value="30">Last 30 days</MenuItem>
                <MenuItem value="90">Last 90 days</MenuItem>
                <MenuItem value="all">All</MenuItem>
              </Select>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
              >
                Joint Date:
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
              >
                {summary.jointDate || '–'}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
              >
                Last Session:
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
              >
                {summary.lastSession || '–'}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
              >
                Total Sessions:
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
              >
                {summary.totalSessions ?? '–'}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
              >
                Voucher Balance:
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
              >
                {voucherBalance ?? '–'}
              </Typography>
            </Box>
          </Box>

          <Table size="small" sx={{ tableLayout: 'fixed', width: 'max-content' }}>
            <TableHead>
              <TableRow>
                {allColumns
                  .filter((c) => c.key === 'ordinal' || visibleCols.includes(c.key))
                  .map((c) => (
                    <TableCell
                      key={c.key}
                      sx={{
                        typography: 'body2',
                        fontFamily: 'Cantata One',
                        fontWeight: 'bold',
                        width: colWidth(c.key),
                        minWidth: colWidth(c.key),
                        position: c.key === 'ordinal' ? 'sticky' : 'relative',
                        left: c.key === 'ordinal' ? 0 : undefined,
                        zIndex: c.key === 'ordinal' ? 3 : undefined,
                        backgroundColor: c.key === 'ordinal' ? 'background.paper' : undefined,
                      }}
                    >
                      {c.key === 'ordinal' ? (
                        c.label
                      ) : (
                        <TableSortLabel
                          active={sortBy === c.key}
                          direction={sortBy === c.key ? sortDir : 'asc'}
                          onClick={() => handleSort(c.key)}
                        >
                          {c.label}
                        </TableSortLabel>
                      )}
                      <Box
                        className="col-resizer"
                        aria-label={`Resize column ${c.label}`}
                        onMouseDown={(e) => startResize(c.key, e)}
                      />
                    </TableCell>
                  ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions
                .filter((s) => {
                  if (period === 'all') return true
                  const days = Number(period)
                  const since = Date.now() - days * 24 * 60 * 60 * 1000
                  return s.startMs >= since
                })
                .sort((a, b) => {
                  const av = sortVal(a, sortBy)
                  const bv = sortVal(b, sortBy)
                  if (av < bv) return sortDir === 'asc' ? -1 : 1
                  if (av > bv) return sortDir === 'asc' ? 1 : -1
                  return 0
                })
                .map((s, i) => (
                  <TableRow
                    key={i}
                    hover
                    onClick={() => {
                      setDetail(s)
                      const idx = sessions.findIndex((r) => r.id === s.id)
                      const num = String(idx + 1).padStart(3, '0')
                      const titleDate = new Date(s.startMs).toLocaleDateString(
                        undefined,
                        { month: 'short', day: '2-digit', year: 'numeric' },
                      )
                      const title = `${account} - #${num} | ${titleDate} ${s.time}`
                      onTitle?.(title)
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell
                      sx={{
                        typography: 'body2',
                        fontFamily: 'Newsreader',
                        fontWeight: 500,
                        width: colWidth('ordinal'),
                        minWidth: colWidth('ordinal'),
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        backgroundColor: 'background.paper',
                      }}
                    >
                      {s.ordinal}
                    </TableCell>
                    {visibleCols.includes('date') && (
                      <TableCell
                        sx={{
                          typography: 'body2',
                          fontFamily: 'Newsreader',
                          fontWeight: 500,
                          width: colWidth('date'),
                          minWidth: colWidth('date'),
                        }}
                      >
                        {s.date}
                      </TableCell>
                    )}
                    {visibleCols.includes('time') && (
                      <TableCell
                        sx={{
                          typography: 'body2',
                          fontFamily: 'Newsreader',
                          fontWeight: 500,
                          width: colWidth('time'),
                          minWidth: colWidth('time'),
                        }}
                      >
                        {s.time}
                      </TableCell>
                    )}
                    {visibleCols.includes('duration') && (
                      <TableCell
                        sx={{
                          typography: 'body2',
                          fontFamily: 'Newsreader',
                          fontWeight: 500,
                          width: colWidth('duration'),
                          minWidth: colWidth('duration'),
                        }}
                      >
                        {s.duration}
                      </TableCell>
                    )}
                    {visibleCols.includes('sessionType') && (
                      <TableCell
                        sx={{
                          typography: 'body2',
                          fontFamily: 'Newsreader',
                          fontWeight: 500,
                          width: colWidth('sessionType'),
                          minWidth: colWidth('sessionType'),
                        }}
                      >
                        {s.sessionType}
                      </TableCell>
                    )}
                    {visibleCols.includes('billingType') && (
                      <TableCell
                        sx={{
                          typography: 'body2',
                          fontFamily: 'Newsreader',
                          fontWeight: 500,
                          width: colWidth('billingType'),
                          minWidth: colWidth('billingType'),
                        }}
                      >
                        {s.billingType}
                      </TableCell>
                    )}
                    {visibleCols.includes('voucherBalance') && (
                      <TableCell
                        sx={{
                          typography: 'body2',
                          fontFamily: 'Newsreader',
                          fontWeight: 500,
                          width: colWidth('voucherBalance'),
                          minWidth: colWidth('voucherBalance'),
                        }}
                      >
                        {s.voucherBalance ?? '-'}
                      </TableCell>
                    )}
                    {visibleCols.includes('baseRate') && (
                      <TableCell
                        sx={{
                          typography: 'body2',
                          fontFamily: 'Newsreader',
                          fontWeight: 500,
                          width: colWidth('baseRate'),
                          minWidth: colWidth('baseRate'),
                        }}
                      >
                        {s.baseRate !== '-' ? formatCurrency(Number(s.baseRate)) : '-'}
                      </TableCell>
                    )}
                    {visibleCols.includes('rateCharged') && (
                      <TableCell
                        sx={{
                          typography: 'body2',
                          fontFamily: 'Newsreader',
                          fontWeight: 500,
                          width: colWidth('rateCharged'),
                          minWidth: colWidth('rateCharged'),
                        }}
                      >
                        {typeof s.rateCharged === 'string'
                          ? s.rateCharged
                          : s.rateCharged !== '-'
                          ? formatCurrency(Number(s.rateCharged))
                          : '-'}
                      </TableCell>
                    )}
                    {visibleCols.includes('paymentStatus') && (
                      <TableCell
                        sx={{
                          typography: 'body2',
                          fontFamily: 'Newsreader',
                          fontWeight: 500,
                          width: colWidth('paymentStatus'),
                          minWidth: colWidth('paymentStatus'),
                        }}
                      >
                        {s.paymentStatus}
                      </TableCell>
                    )}
                    {visibleCols.includes('payOn') && (
                      <TableCell
                        sx={{
                          typography: 'body2',
                          fontFamily: 'Newsreader',
                          fontWeight: 500,
                          width: colWidth('payOn'),
                          minWidth: colWidth('payOn'),
                        }}
                      >
                        {s.payOn}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>

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
      </Box>
      <Box className="dialog-footer" sx={{ p: 1, display: 'flex', justifyContent: 'space-between' }} />
    </Box>
  )
}
