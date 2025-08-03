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
  Button,
  IconButton,
} from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import { collection, getDocs, query, where, orderBy, doc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import SessionDetail from './SessionDetail'

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
  onActions,
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
    { key: 'date', label: 'Date', width: 110 },
    { key: 'time', label: 'Time', width: 100 },
    { key: 'duration', label: 'Duration', width: 110 },
    { key: 'sessionType', label: 'Session Type', width: 150 },
    { key: 'billingType', label: 'Billing Type', width: 150 },
    { key: 'baseRate', label: 'Base Rate', width: 140 },
    { key: 'rateCharged', label: 'Rate Charged', width: 140 },
    { key: 'paymentStatus', label: 'Payment Status', width: 150 },
  ]
  const colWidth = (key: string) => allColumns.find((c) => c.key === key)?.width
  const defaultCols = ['date', 'time', 'sessionType', 'rateCharged', 'paymentStatus']
  const [visibleCols, setVisibleCols] = useState<string[]>(defaultCols)
  const [period, setPeriod] = useState<'30' | '90' | 'all'>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
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

        const [histSnap, altSnap, paymentSnap, sessionRows] = await Promise.all([
          getDocs(collection(db, 'Students', abbr, 'BaseRateHistory')),
          getDocs(collection(db, 'Students', abbr, 'BaseRate')),
          getDocs(
            query(
              collection(db, 'Students', abbr, 'Payments'),
              orderBy('paymentMade')
            )
          ),
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
                sessionType: data.sessionType ?? 'N/A',
                billingType: data.billingType ?? 'N/A',
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
              sessionType: data.sessionType ?? 'N/A',
              billingType: data.billingType ?? 'N/A',
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

  useEffect(() => {
    if (!detail) onActions?.(null)
  }, [detail])
  if (loading) {
    return <CircularProgress />
  }
  return (
    <Box
      sx={{
        textAlign: 'left',
        position: 'relative',
        maxWidth: '100%',
        maxHeight: '100%',
        overflow: 'auto',
      }}
      style={style}
    >
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
                {allColumns.map((c) => (
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
              >
                <MenuItem value="30">Last 30 days</MenuItem>
                <MenuItem value="90">Last 90 days</MenuItem>
                <MenuItem value="all">All</MenuItem>
              </Select>
            </Box>
          )}

          <Table size="small" sx={{ tableLayout: 'fixed', width: 'max-content' }}>
            <TableHead>
              <TableRow>
                {allColumns
                  .filter((c) => visibleCols.includes(c.key))
                  .map((c) => (
                    <TableCell
                      key={c.key}
                      sx={{ typography: 'body2', fontWeight: 'normal', width: c.width, minWidth: c.width }}
                    >
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
                    onClick={() => {
                      setDetail(s)
                      const idx = sessions.findIndex((r) => r.id === s.id)
                      const num = String(idx + 1).padStart(3, '0')
                      onTitle?.(
                        `${account} - Session #${num} | ${s.date} ${s.time}`,
                      )
                      onActions?.(
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation()
                            onPopDetail?.({ ...s, number: num, account })
                            setDetail(null)
                            onTitle?.(account)
                            onActions?.(null)
                          }}
                          aria-label="detach session"
                          sx={{ mr: 1 }}
                        >
                          <OpenInNewIcon />
                        </IconButton>,
                      )
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    {visibleCols.includes('date') && (
                      <TableCell sx={{ typography: 'body2', width: colWidth('date'), minWidth: colWidth('date') }}>
                        {s.date}
                      </TableCell>
                    )}
                    {visibleCols.includes('time') && (
                      <TableCell sx={{ typography: 'body2', width: colWidth('time'), minWidth: colWidth('time') }}>
                        {s.time}
                      </TableCell>
                    )}
                    {visibleCols.includes('duration') && (
                      <TableCell sx={{ typography: 'body2', width: colWidth('duration'), minWidth: colWidth('duration') }}>
                        {s.duration}
                      </TableCell>
                    )}
                    {visibleCols.includes('sessionType') && (
                      <TableCell sx={{ typography: 'body2', width: colWidth('sessionType'), minWidth: colWidth('sessionType') }}>
                        {s.sessionType}
                      </TableCell>
                    )}
                    {visibleCols.includes('billingType') && (
                      <TableCell sx={{ typography: 'body2', width: colWidth('billingType'), minWidth: colWidth('billingType') }}>
                        {s.billingType}
                      </TableCell>
                    )}
                    {visibleCols.includes('baseRate') && (
                      <TableCell sx={{ typography: 'body2', width: colWidth('baseRate') }}>
                        {s.baseRate !== '-' ? formatCurrency(Number(s.baseRate)) : '-'}
                      </TableCell>
                    )}
                    {visibleCols.includes('rateCharged') && (
                      <TableCell sx={{ typography: 'body2', width: colWidth('rateCharged') }}>
                        {s.rateCharged !== '-' ? formatCurrency(Number(s.rateCharged)) : '-'}
                      </TableCell>
                    )}
                    {visibleCols.includes('paymentStatus') && (
                      <TableCell sx={{ typography: 'body2', width: colWidth('paymentStatus') }}>
                        {s.paymentStatus}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          <Box mt={2}>
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
        </>
      )}

      {detail && (
        <SessionDetail
          session={detail}
          onBack={() => {
            setDetail(null)
            onTitle?.(account)
            onActions?.(null)
          }}
        />
      )}
    </Box>
  )
}
