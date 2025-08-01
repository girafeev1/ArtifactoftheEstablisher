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
} from '@mui/material'

import { collection, getDocs, query, where, orderBy, limit, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'

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

function EditableRate({
  sessionId,
  value,
  onChange,
}: {
  sessionId: string
  value: number | string
  onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))

  useEffect(() => {
    setDraft(String(value ?? ''))
  }, [value])

  const save = async (v: number) => {
    try {
      const colRef = collection(db, 'Sessions', sessionId, 'rateCharged')
      const snap = await getDocs(colRef)
      const idx = String(snap.size + 1).padStart(3, '0')
      const today = new Date()
      const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
      const docId = `ratecharged-${idx}-${yyyyMMdd}`
      await setDoc(doc(colRef, docId), {
        rateCharged: v,
        timestamp: serverTimestamp(),
      })
      onChange(v)
    } catch (err) {
      console.error('failed to save rate', err)
    }
  }

  if (!editing) {
    return (
      <Typography
        variant="h6"
        sx={{ cursor: 'pointer' }}
        onClick={() => setEditing(true)}
      >
        {value === '-' || value === undefined
          ? '-'
          : formatCurrency(Number(value) || 0)}
      </Typography>
    )
  }

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const num = parseFloat(draft)
        if (!isNaN(num) && num !== Number(value)) save(num)
        setEditing(false)
      }}
      style={{ width: 80 }}
    />
  )
}

function EditableStatus({
  sessionId,
  value,
  onChange,
}: {
  sessionId: string
  value: 'Paid' | 'Unpaid'
  onChange: (v: 'Paid' | 'Unpaid') => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<'Paid' | 'Unpaid'>(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const save = async (v: 'Paid' | 'Unpaid') => {
    try {
      const colRef = collection(db, 'Sessions', sessionId, 'paymentStatus')
      const snap = await getDocs(colRef)
      const idx = String(snap.size + 1).padStart(3, '0')
      const today = new Date()
      const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
      const docId = `paid-${idx}-${yyyyMMdd}`
      await setDoc(doc(colRef, docId), {
        paid: v === 'Paid',
        timestamp: serverTimestamp(),
      })
      onChange(v)
    } catch (err) {
      console.error('failed to save payment status', err)
    }
  }

  if (!editing && value === 'Paid') {
    return <Typography variant="h6">Paid</Typography>
  }

  if (!editing) {
    return (
      <Typography
        variant="h6"
        sx={{ cursor: 'pointer' }}
        onClick={() => setEditing(true)}
      >
        {value}
      </Typography>
    )
  }

  return (
    <select
      value={draft}
      onChange={(e) => setDraft(e.target.value as 'Paid' | 'Unpaid')}
      onBlur={() => {
        if (draft !== value) save(draft)
        setEditing(false)
      }}
    >
      <option value="Paid">{draft === 'Paid' ? '• Paid' : 'Paid'}</option>
      <option value="Unpaid">{draft === 'Unpaid' ? '• Unpaid' : 'Unpaid'}</option>
    </select>
  )
}

export default function SessionsTab({
  abbr,
  account,
  jointDate,
  lastSession,
  totalSessions,
}: {
  abbr: string
  account: string
  jointDate?: string
  lastSession?: string
  totalSessions?: number
}) {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sessSnap = await getDocs(
          query(collection(db, 'Sessions'), where('sessionName', '==', account)),
        )

        const rowPromises = sessSnap.docs.map(async (sd) => {
          const [histSnap, rateSnap, statusSnap] = await Promise.all([
            getDocs(collection(db, 'Sessions', sd.id, 'appointmentHistory')),
            getDocs(collection(db, 'Sessions', sd.id, 'rateCharged')),
            getDocs(collection(db, 'Sessions', sd.id, 'paymentStatus')),
          ])
          return {
            id: sd.id,
            data: sd.data(),
            history: histSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
            rateDocs: rateSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
            statusDocs: statusSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
          }
        })

        const [baseRateSnap, paymentSnap, sessionRows] = await Promise.all([
          getDocs(collection(db, 'Students', abbr, 'BaseRateHistory')),
          getDocs(query(collection(db, 'Students', abbr, 'Payments'), orderBy('timestamp'))),
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
            ts: (d.data() as any).timestamp?.toDate?.() ?? new Date(0),
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
          .map(({ id, data, history, rateDocs, statusDocs }) => {
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
                paymentStatus: 'Unpaid',
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

            const manualStatusDoc = statusDocs
              .slice()
              .sort((a: any, b: any) => {
                const ta = parseDate(a.timestamp) || new Date(0)
                const tb = parseDate(b.timestamp) || new Date(0)
                return tb.getTime() - ta.getTime()
              })[0]

            return {
              id,
              sessionType: data.sessionType ?? '404/Not Found',
              billingType: data.billingType ?? '404/Not Found',
              date,
              time,
              duration,
              baseRate: base,
              rateCharged,
              paymentStatus: manualStatusDoc ? (manualStatusDoc.paid ? 'Paid' : 'Unpaid') : 'Unpaid',
              startMs: startDate?.getTime() ?? 0,
            }
          })
          .sort((a, b) => a.startMs - b.startMs)

        let credit = 0
        let payIdx = 0
        rows.forEach((r) => {
          if (r.paymentStatus !== 'Unpaid' && r.paymentStatus !== 'Paid') {
            r.paymentStatus = 'Unpaid'
          }
          if (r.paymentStatus === 'Unpaid') {
            while (
              payIdx < payments.length &&
              payments[payIdx].ts.getTime() <= r.startMs
            ) {
              credit += payments[payIdx].amount
              payIdx++
            }
            const cost = Number(r.rateCharged) || 0
            if (credit >= cost && cost > 0) {
              r.paymentStatus = 'Paid'
              credit -= cost
            }
          }
          console.log(`Session ${r.id}: paymentStatus`, r.paymentStatus, 'remaining credit', credit)
        })

        console.log('Final session rows:', rows)

        if (!cancelled) setSessions(rows)
      } catch (e) {
        console.error('load sessions failed', e)
        if (!cancelled) setSessions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, account])
  if (loading) {
    return <CircularProgress />
  }
  return (
    <>
      <Box mb={2}>
        <Box mb={1}>
          <Typography variant="subtitle2">Joint Date:</Typography>
          <Typography variant="h6">{jointDate || '–'}</Typography>
        </Box>
        <Box mb={1}>
          <Typography variant="subtitle2">Last Session:</Typography>
          <Typography variant="h6">{lastSession || '–'}</Typography>
        </Box>
        <Box mb={1}>
          <Typography variant="subtitle2">Total Sessions:</Typography>
          <Typography variant="h6">{totalSessions ?? '–'}</Typography>
        </Box>
      </Box>
      <Table size="small">
      <TableHead>
        <TableRow>
          {[
            'Date',
            'Time',
            'Duration',
            'Session Type',
            'Billing Type',
            'Base Rate',
            'Rate Charged',
            'Payment Status',
          ].map((h) => (
            <TableCell key={h} sx={{ typography: 'body2', fontWeight: 'normal' }}>
              {h}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {sessions.map((s, i) => (
          <TableRow key={i}>
            <TableCell sx={{ typography: 'body2' }}>{s.date}</TableCell>
            <TableCell sx={{ typography: 'body2' }}>{s.time}</TableCell>
            <TableCell sx={{ typography: 'body2' }}>{s.duration}</TableCell>
            <TableCell sx={{ typography: 'body2' }}>{s.sessionType}</TableCell>
            <TableCell sx={{ typography: 'body2' }}>{s.billingType}</TableCell>
            <TableCell sx={{ typography: 'body2' }}>
              {s.baseRate !== '-' ? formatCurrency(Number(s.baseRate)) : '-'}
            </TableCell>
            <TableCell sx={{ typography: 'body2' }}>
              <EditableRate
                sessionId={s.id}
                value={s.rateCharged}
                onChange={(v) => {
                  setSessions((rows) =>
                    rows.map((r, idx) => (idx === i ? { ...r, rateCharged: v } : r)),
                  )
                }}
              />
            </TableCell>
            <TableCell sx={{ typography: 'body2' }}>
              <EditableStatus
                sessionId={s.id}
                value={s.paymentStatus}
                onChange={(v) => {
                  setSessions((rows) =>
                    rows.map((r, idx) => (idx === i ? { ...r, paymentStatus: v } : r)),
                  )
                }}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </>
  )
}
