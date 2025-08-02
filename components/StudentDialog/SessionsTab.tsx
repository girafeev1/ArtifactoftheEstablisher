// components/StudentDialog/SessionsTab.tsx

import React, { useEffect, useState } from 'react'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD' }).format(
    n,
  )
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
} from '@mui/material'

import { collection, getDocs, query, where, orderBy, doc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import SessionDetail from './SessionDetail'
import FloatingWindow from './FloatingWindow'

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
}: {
  abbr: string
  account: string
  onSummary?: (s: { jointDate: string; lastSession: string; totalSessions: number }) => void
}) {
  console.log('Rendering SessionsTab for', abbr)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any | null>(null)
  const [popped, setPopped] = useState<any | null>(null)

  const allColumns = [
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'duration', label: 'Duration' },
    { key: 'sessionType', label: 'Session Type' },
    { key: 'billingType', label: 'Billing Type' },
    { key: 'baseRate', label: 'Base Rate' },
    { key: 'rateCharged', label: 'Rate Charged' },
    { key: 'paymentStatus', label: 'Payment Status' },
  ]
  const [visibleCols, setVisibleCols] = useState(allColumns.map((c) => c.key))
  const [period, setPeriod] = useState<'30' | '90' | 'all'>('all')
  const [summary, setSummary] = useState({
    jointDate: '',
    lastSession: '',
    totalSessions: 0,
  })

  useEffect(() => {
    console.log('SessionsTab effect: load sessions for', abbr)
    // SessionsTab owns session summary calculation; OverviewTab consumes the result
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
            id: sd.id,
            data: sd.data(),
            history: histSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
            rateDocs: rateSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
          }
        })

        const [baseRateSnap, paymentSnap, sessionRows] = await Promise.all([
          getDocs(collection(db, 'Students', abbr, 'BaseRateHistory')),
          getDocs(
            query(
              collection(db, 'Students', abbr, 'Payments'),
              orderBy('paymentMade')
            )
          ),
          Promise.all(rowPromises),
        ])

        const baseRates = baseRateSnap.docs
          .map((d) => ({
            rate: (d.data() as any).rate,
            ts: (d.data() as any).timestamp?.toDate?.() ?? new Date(0),
          }))
          .sort((a, b) => a.ts.getTime() - b.ts.getTime())
        console.log('Base rate history:', baseRates)

        const payments = paymentSnap.docs
          .map((d) => ({
            amount: Number((d.data() as any).amount) || 0,
            ts: (d.data() as any).paymentMade?.toDate?.() ?? new Date(0),
          }))
          .sort((a, b) => a.ts.getTime() - b.ts.getTime())
        console.log('Payment history:', payments)

        const parseDate = (v: any): Date | null => {
          if (!v) return null
          try {
            const d = v.toDate ? v.toDate() : new Date(v)
            return isNaN(d.getTime()) ? null : d
          } catch {
            return null
          }
        }

        const rows = sessionRows
          .map(({ id, data, history, rateDocs }) => {
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
                sessionType: data.sessionType ?? '404/Not Found',
                billingType: data.billingType ?? '404/Not Found',
                date: 'No history',
                time: '-',
                duration: '-',
                baseRate: '-',
                rateCharged: data.rateCharged ?? '-',
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
            const rateCharged = latestRate != null ? Number(latestRate) : base
            return {
              id,
              sessionType: data.sessionType ?? '404/Not Found',
              billingType: data.billingType ?? '404/Not Found',
              date,
              time,
              duration,
              baseRate: base,
              rateCharged,
              paymentStatus: 'Unpaid' as 'Paid' | 'Unpaid',
              startMs: startDate?.getTime() ?? 0,
            }
          })
          .sort((a, b) => a.startMs - b.startMs)

        let credit = payments.reduce((s, p) => s + p.amount, 0)
        rows.forEach((r) => {
          const cost = Number(r.rateCharged) || 0
          if (credit >= cost && cost > 0) {
            r.paymentStatus = 'Paid'
            credit -= cost
          } else {
            r.paymentStatus = 'Unpaid'
          }
          console.log(`Session ${r.id}: paymentStatus`, r.paymentStatus, 'remaining credit', credit)
        })

        const validDates = rows.filter(r => r.startMs > 0).map(r => r.startMs).sort((a,b)=>a-b)
        const today = new Date()
        const lastPast = validDates.filter(ms => ms <= today.getTime()).pop()
        const newSummary = {
          jointDate: validDates.length ? toHKDate(new Date(validDates[0])) : '',
          lastSession: lastPast ? toHKDate(new Date(lastPast)) : '',
          totalSessions: validDates.length,
        }
        console.log('Computed summary:', newSummary)

        const studRef = doc(db, 'Students', abbr)
        await setDoc(studRef, newSummary, { merge: true })

        if (!cancelled) {
          setSummary(newSummary)
          setSessions(rows)
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
    <>
      <Box mb={2}>
        <Box mb={1}>
          <Typography variant="subtitle2">Joint Date:</Typography>
          <Typography variant="h6">{summary.jointDate || '–'}</Typography>
        </Box>
        <Box mb={1}>
          <Typography variant="subtitle2">Last Session:</Typography>
          <Typography variant="h6">{summary.lastSession || '–'}</Typography>
        </Box>
        <Box mb={1}>
          <Typography variant="subtitle2">Total Sessions:</Typography>
          <Typography variant="h6">{summary.totalSessions ?? '–'}</Typography>
        </Box>
      </Box>
      <Box mb={2}>
        <Typography variant="subtitle2">Columns</Typography>
        <FormGroup row>
          {allColumns.map((c) => (
            <FormControlLabel
              key={c.key}
              control={
                <Checkbox
                  checked={visibleCols.includes(c.key)}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setVisibleCols((cols) =>
                      checked ? [...cols, c.key] : cols.filter((k) => k !== c.key),
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
        >
          <MenuItem value="30">Last 30 days</MenuItem>
          <MenuItem value="90">Last 90 days</MenuItem>
          <MenuItem value="all">All</MenuItem>
        </Select>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            {allColumns
              .filter((c) => visibleCols.includes(c.key))
              .map((c) => (
                <TableCell key={c.key} sx={{ typography: 'body2', fontWeight: 'normal' }}>
                  {c.label}
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
            .map((s, i) => (
              <TableRow
                key={i}
                hover
                onClick={() => setDetail(s)}
                sx={{ cursor: 'pointer' }}
              >
                {visibleCols.includes('date') && (
                  <TableCell sx={{ typography: 'body2' }}>{s.date}</TableCell>
                )}
                {visibleCols.includes('time') && (
                  <TableCell sx={{ typography: 'body2' }}>{s.time}</TableCell>
                )}
                {visibleCols.includes('duration') && (
                  <TableCell sx={{ typography: 'body2' }}>{s.duration}</TableCell>
                )}
                {visibleCols.includes('sessionType') && (
                  <TableCell sx={{ typography: 'body2' }}>{s.sessionType}</TableCell>
                )}
                {visibleCols.includes('billingType') && (
                  <TableCell sx={{ typography: 'body2' }}>{s.billingType}</TableCell>
                )}
                {visibleCols.includes('baseRate') && (
                  <TableCell sx={{ typography: 'body2' }}>
                    {s.baseRate !== '-' ? formatCurrency(Number(s.baseRate)) : '-'}
                  </TableCell>
                )}
                {visibleCols.includes('rateCharged') && (
                  <TableCell sx={{ typography: 'body2' }}>
                    {s.rateCharged !== '-' ? formatCurrency(Number(s.rateCharged)) : '-'}
                  </TableCell>
                )}
                {visibleCols.includes('paymentStatus') && (
                  <TableCell sx={{ typography: 'body2' }}>{s.paymentStatus}</TableCell>
                )}
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {detail && (
        <SessionDetail
          session={detail}
          onBack={() => setDetail(null)}
          onDetach={() => {
            setPopped(detail)
            setDetail(null)
          }}
        />
      )}
      {popped && (
        <FloatingWindow
          title="Session Detail"
          onClose={() => setPopped(null)}
        >
          <SessionDetail session={popped} onBack={() => setPopped(null)} detached />
        </FloatingWindow>
      )}
    </>
  )
}
