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

import { collection, getDocs, query, where, orderBy, limit, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'

function EditableRate({
  abbr,
  sessionId,
  value,
  onChange,
}: {
  abbr: string
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
      const colRef = collection(db, 'Students', abbr, 'RateChargedHistory')
      const snap = await getDocs(colRef)
      const idx = String(snap.size + 1).padStart(3, '0')
      const today = new Date()
      const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
      const docId = `${abbr}-RateCharged-${idx}-${yyyyMMdd}`
      await setDoc(doc(colRef, docId), {
        rateCharged: v,
        timestamp: serverTimestamp(),
        sessionId,
      })
      await updateDoc(doc(db, 'Sessions', sessionId), { rateCharged: v })
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
        if (!isNaN(num)) save(num)
        setEditing(false)
      }}
      style={{ width: 80 }}
    />
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

        const histPromises = sessSnap.docs.map((sd) =>
          getDocs(
            query(
              collection(db, 'Sessions', sd.id, 'appointmentHistory'),
              orderBy('timestamp', 'desc'),
              limit(1),
            ),
          ).then((h) => ({ id: sd.id, data: sd.data(), hist: h.docs[0]?.data() }))
        )

        const [baseRateSnap, paymentSnap, sessionRows] = await Promise.all([
          getDocs(collection(db, 'Students', abbr, 'BaseRateHistory')),
          getDocs(query(collection(db, 'Students', abbr, 'Payments'), orderBy('timestamp'))),
          Promise.all(histPromises),
        ])

        const baseRates = baseRateSnap.docs
          .map((d) => ({
            rate: (d.data() as any).rate,
            ts: (d.data() as any).timestamp?.toDate?.() ?? new Date(0),
          }))
          .sort((a, b) => a.ts.getTime() - b.ts.getTime())

        const payments = paymentSnap.docs
          .map((d) => ({
            amount: Number((d.data() as any).amount) || 0,
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

        const rows = sessionRows
          .map(({ id, data, hist }) => {
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
            const date = startDate
              ? startDate.toISOString().slice(0, 10)
              : '-'
            const time = startDate
              ? startDate.toISOString().slice(11, 16)
              : '-'
            let duration = '-'
            if (startDate && endDate) {
              const hrs = (endDate.getTime() - startDate.getTime()) / 3600_000
              if (!isNaN(hrs)) duration = String(Math.round(hrs * 100) / 100)
            }

            const base = (() => {
              if (!startDate || !baseRates.length) return '-'
              const entry = baseRates
                .filter((b) => b.ts.getTime() <= startDate.getTime())
                .pop()
              return entry ? entry.rate : '-'
            })()

            const rateCharged = data.rateCharged ?? base

            return {
              id,
              sessionType: data.sessionType ?? '404/Not Found',
              billingType: data.billingType ?? '404/Not Found',
              date,
              time,
              duration,
              baseRate: base,
              rateCharged,
              paymentStatus: 'Unpaid',
              startMs: startDate?.getTime() ?? 0,
            }
          })
          .sort((a, b) => a.startMs - b.startMs)

        let credit = 0
        let payIdx = 0
        rows.forEach((r) => {
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
          } else {
            r.paymentStatus = 'Unpaid'
          }
        })

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
            <TableCell key={h} sx={{ typography: 'subtitle2', fontWeight: 'normal' }}>
              {h}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {sessions.map((s, i) => (
          <TableRow key={i}>
            <TableCell sx={{ typography: 'h6' }}>{s.date}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{s.time}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{s.duration}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{s.sessionType}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{s.billingType}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>
              {s.baseRate !== '-' ? formatCurrency(Number(s.baseRate)) : '-'}
            </TableCell>
            <TableCell sx={{ typography: 'h6' }}>
              <EditableRate
                abbr={abbr}
                sessionId={s.id}
                value={s.rateCharged}
                onChange={(v) => {
                  setSessions((rows) =>
                    rows.map((r, idx) => (idx === i ? { ...r, rateCharged: v } : r)),
                  )
                }}
              />
            </TableCell>
            <TableCell sx={{ typography: 'h6' }}>{s.paymentStatus}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </>
  )
}
