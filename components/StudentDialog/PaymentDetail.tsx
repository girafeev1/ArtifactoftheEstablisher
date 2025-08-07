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
  const [available, setAvailable] = useState<any[]>([])
  const [assignedSessions, setAssignedSessions] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [remaining, setRemaining] = useState<number>(
    payment.remainingAmount ?? Number(payment.amount) ?? 0,
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [histSnap, baseSnap, sessSnap, retSnap] = await Promise.all([
          getDocs(collection(db, 'Students', abbr, 'BaseRateHistory')),
          getDocs(collection(db, 'Students', abbr, 'BaseRate')),
          getDocs(query(collection(db, 'Sessions'), where('sessionName', '==', account))),
          getDocs(collection(db, 'Students', abbr, 'Retainers')),
        ])

        const baseRateDocs = [...histSnap.docs, ...baseSnap.docs]
        const baseRates = baseRateDocs
          .map((d) => {
            const data = d.data() as any
            return {
              rate: data.rate ?? data.baseRate,
              ts: data.timestamp?.toDate?.() ?? new Date(0),
            }
          })
          .sort((a, b) => a.ts.getTime() - b.ts.getTime())

        const retainers = retSnap.docs.map((d) => {
          const data = d.data() as any
          const s = data.retainerStarts?.toDate?.() ?? new Date(0)
          const e = data.retainerEnds?.toDate?.() ?? new Date(0)
          return { start: s, end: e }
        })

        const rows = await Promise.all(
          sessSnap.docs.map(async (sd) => {
            const data = sd.data() as any
            const [histSnap, rateSnap, paySnap] = await Promise.all([
              getDocs(collection(db, 'Sessions', sd.id, 'appointmentHistory')),
              getDocs(collection(db, 'Sessions', sd.id, 'rateCharged')),
              getDocs(collection(db, 'Sessions', sd.id, 'payment')),
            ])

            const hist = histSnap.docs
              .map((d) => d.data() as any)
              .sort((a, b) => {
                const ta = a.timestamp?.toDate?.() ?? new Date(0)
                const tb = b.timestamp?.toDate?.() ?? new Date(0)
                return tb.getTime() - ta.getTime()
              })[0]

            let start = data.origStartTimestamp
            if (hist) {
              if (hist.newStartTimestamp != null) start = hist.newStartTimestamp
            }
            const startDate = start?.toDate ? start.toDate() : new Date(start)
            const date =
              !startDate || isNaN(startDate.getTime())
                ? '-'
                : startDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                  })

            const base = (() => {
              if (!startDate || !baseRates.length) return 0
              const entry = baseRates
                .filter((b) => b.ts.getTime() <= startDate.getTime())
                .pop()
              return entry ? Number(entry.rate) || 0 : 0
            })()

            const rateHist = rateSnap.docs
              .map((d) => d.data() as any)
              .sort((a, b) => {
                const ta = a.timestamp?.toDate?.() ?? new Date(0)
                const tb = b.timestamp?.toDate?.() ?? new Date(0)
                return tb.getTime() - ta.getTime()
              })
            const latestRate = rateHist[0]?.rateCharged
            const rate = latestRate != null ? Number(latestRate) : base

            const paymentIds = paySnap.docs.map(
              (p) => (p.data() as any).paymentId as string,
            )
            const assigned = paymentIds.includes(payment.id)
            const assignedToOther = paymentIds.length > 0 && !assigned

            const inRetainer = retainers.some(
              (r) => startDate && startDate >= r.start && startDate <= r.end,
            )

            return {
              id: sd.id,
              sessionType: data.sessionType ?? 'N/A',
              date,
              rate,
              assigned,
              assignedToOther,
              inRetainer,
            }
          }),
        )

        if (cancelled) return
        setAssignedSessions(rows.filter((r) => r.assigned && !r.inRetainer))
        setAvailable(
          rows.filter(
            (r) => !r.assigned && !r.assignedToOther && !r.inRetainer,
          ),
        )
      } catch (e) {
        console.error('load sessions failed', e)
        if (!cancelled) {
          setAssignedSessions([])
          setAvailable([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr, account, payment.id])

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const totalSelected = selected.reduce((sum, id) => {
    const rate = available.find((s) => s.id === id)?.rate || 0
    return sum + rate
  }, 0)

  const handleAssign = async () => {
    if (totalSelected > remaining) return
    setAssigning(true)
    try {
      const newlyAssigned: any[] = []
      for (const id of selected) {
        const session = available.find((s) => s.id === id)
        const rate = session?.rate || 0
        await setDoc(doc(db, 'Sessions', id, 'payment', payment.id), {
          amount: rate,
          paymentId: payment.id,
          paymentMade: payment.paymentMade,
        })
        if (session) newlyAssigned.push(session)
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
      setAssignedSessions((a) => [...a, ...newlyAssigned])
      setAvailable((s) => s.filter((sess) => !selected.includes(sess.id)))
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
          Pay for:
        </Typography>
        {assignedSessions.map((s) => (
          <Typography
            key={s.id}
            variant="h6"
            sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          >
            {`${s.id} | ${s.date} (${s.sessionType})`}
          </Typography>
        ))}
        {remaining > 0 && (
          <>
            <FormGroup>
              {available.map((s) => (
                <FormControlLabel
                  key={s.id}
                  control={
                    <Checkbox
                      checked={selected.includes(s.id)}
                      onChange={() => toggle(s.id)}
                      disabled={assigning || (s.rate || 0) > remaining}
                    />
                  }
                  label={`${s.id} | ${s.date} (${s.sessionType})`}
                />
              ))}
            </FormGroup>
            <Button
              variant="contained"
              sx={{ mt: 1 }}
              onClick={handleAssign}
              disabled={assigning || totalSelected === 0 || totalSelected > remaining}
            >
              Assign
            </Button>
          </>
        )}
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

