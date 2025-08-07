import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material'
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD' }).format(n)

const formatDate = (d: Date | null) => {
  if (!d) return 'N/A'
  try {
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })
  } catch {
    return 'N/A'
  }
}

const displayField = (v: any) => {
  if (v === '__ERROR__') return 'Error'
  if (v === undefined || v === null || v === '') return 'N/A'
  try {
    if (v.toDate) {
      const d = v.toDate()
      return isNaN(d.getTime())
        ? 'N/A'
        : d.toLocaleDateString(undefined, {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          })
    }
  } catch {
    return 'N/A'
  }
  return String(v)
}

export default function PaymentDetail({
  abbr,
  account,
  payment,
  onBack,
}: {
  abbr: string
  account: string
  payment: any
  onBack: () => void
}) {
  const [sessions, setSessions] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [remaining, setRemaining] = useState<number>(
    payment.remainingAmount ?? Number(payment.amount) ?? 0,
  )

  const assignedSessions = sessions.filter((s) =>
    s.paymentIds.includes(payment.id),
  )
  const availableSessions = sessions.filter((s) => s.paymentIds.length === 0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [sessSnap, baseHistSnap, baseSnap] = await Promise.all([
          getDocs(query(collection(db, 'Sessions'), where('sessionName', '==', account))),
          getDocs(collection(db, 'Students', abbr, 'BaseRateHistory')),
          getDocs(collection(db, 'Students', abbr, 'BaseRate')),
        ])

        const baseRates = [...baseHistSnap.docs, ...baseSnap.docs]
          .map((d) => ({
            rate: (d.data() as any).rate ?? (d.data() as any).baseRate,
            ts:
              (d.data() as any).timestamp?.toDate?.() ??
              new Date((d.data() as any).timestamp || 0),
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

        const rows = await Promise.all(
          sessSnap.docs.map(async (sd) => {
            const data = sd.data() as any
            const [histSnap, rateSnap, paySnap] = await Promise.all([
              getDocs(collection(db, 'Sessions', sd.id, 'appointmentHistory')),
              getDocs(collection(db, 'Sessions', sd.id, 'rateCharged')),
              getDocs(collection(db, 'Sessions', sd.id, 'payment')),
            ])

            const hist = histSnap.docs
              .map((d) => ({ ...(d.data() as any) }))
              .sort((a, b) => {
                const ta =
                  parseDate(a.changeTimestamp) ||
                  parseDate(a.timestamp) ||
                  new Date(0)
                const tb =
                  parseDate(b.changeTimestamp) ||
                  parseDate(b.timestamp) ||
                  new Date(0)
                return tb.getTime() - ta.getTime()
              })[0]

            const startRaw =
              hist?.newStartTimestamp != null
                ? hist.newStartTimestamp
                : hist?.origStartTimestamp ?? hist?.timestamp
            const startDate = parseDate(startRaw)

            const base = (() => {
              if (!startDate || !baseRates.length) return 0
              const entry = baseRates
                .filter((b) => b.ts.getTime() <= startDate.getTime())
                .pop()
              return entry ? Number(entry.rate) : 0
            })()

            const rateHist = rateSnap.docs
              .map((d) => ({ ...(d.data() as any) }))
              .sort((a, b) => {
                const ta = parseDate(a.timestamp) || new Date(0)
                const tb = parseDate(b.timestamp) || new Date(0)
                return tb.getTime() - ta.getTime()
              })
            const latestRate = rateHist[0]?.rateCharged
            const rate = latestRate != null ? Number(latestRate) : base

            const paymentIds = paySnap.docs.map((d) => d.id)

            return {
              id: sd.id,
              sessionType: data.sessionType ?? 'N/A',
              startDate,
              rate,
              paymentIds,
            }
          }),
        )

        const sorted = rows
          .slice()
          .sort((a, b) => {
            const ta = a.startDate ? a.startDate.getTime() : 0
            const tb = b.startDate ? b.startDate.getTime() : 0
            return ta - tb
          })
          .map((r, i) => ({ ...r, count: i + 1 }))

        if (!cancelled) setSessions(sorted)
      } catch (e) {
        console.error('load sessions failed', e)
        if (!cancelled) setSessions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, account])

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const totalSelected = selected.reduce((sum, id) => {
    const rate = sessions.find((s) => s.id === id)?.rate || 0
    return sum + rate
  }, 0)

  const handleAssign = async () => {
    if (totalSelected > remaining) return
    setAssigning(true)
    try {
      for (const id of selected) {
        const rate = sessions.find((s) => s.id === id)?.rate || 0
        await setDoc(doc(db, 'Sessions', id, 'payment', payment.id), {
          amount: rate,
          paymentId: payment.id,
          paymentMade: payment.paymentMade,
        })
      }
      const newAssigned = [
        ...(payment.assignedSessions || []),
        ...selected,
      ]
      const newRemaining = remaining - totalSelected
      await updateDoc(doc(db, 'Students', abbr, 'Payments', payment.id), {
        assignedSessions: newAssigned,
        remainingAmount: newRemaining,
      })
      payment.assignedSessions = newAssigned
      setRemaining(newRemaining)
      setSessions((prev) =>
        prev.map((s) =>
          selected.includes(s.id)
            ? { ...s, paymentIds: [...s.paymentIds, payment.id] }
            : s,
        ),
      )
      setSelected([])
    } catch (e) {
      console.error('assign payment failed', e)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 4 }}>
        {Object.entries(payment).map(([k, v]) => (
          <React.Fragment key={k}>
            <Typography
              variant="subtitle2"
              sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
            >
              {k}:
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              {displayField(v)}
            </Typography>
          </React.Fragment>
        ))}
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Remaining Amount:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {formatCurrency(remaining)}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Payment for:
        </Typography>
        {assignedSessions.map((s) => (
          <Typography
            key={s.id}
            variant="h6"
            sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          >
            {`${s.count} | ${formatDate(s.startDate)} (${s.sessionType})`}
          </Typography>
        ))}
        {remaining > 0 && (
          <FormGroup>
            {availableSessions.map((s) => (
              <FormControlLabel
                key={s.id}
                control={
                  <Checkbox
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    disabled={
                      assigning ||
                      (s.rate || 0) > remaining
                    }
                  />
                }
                label={`${s.count} | ${formatDate(s.startDate)} (${s.sessionType})`}
                slotProps={{
                  typography: {
                    sx: { fontFamily: 'Newsreader', fontWeight: 500 },
                  },
                }}
              />
            ))}
          </FormGroup>
        )}
        <Button
          variant="contained"
          sx={{ mt: 1 }}
          onClick={handleAssign}
          disabled={assigning || totalSelected === 0 || totalSelected > remaining}
        >
          Assign
        </Button>
      </Box>
      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          p: 1,
          display: 'flex',
          justifyContent: 'flex-start',
          bgcolor: 'background.paper',
        }}
      >
        <Button variant="text" onClick={onBack} aria-label="back to payments">
          ← Back
        </Button>
      </Box>
    </Box>
  )
}

