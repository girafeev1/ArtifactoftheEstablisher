import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material'
import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
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
  const [sessions, setSessions] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [remaining, setRemaining] = useState<number>(
    payment.remainingAmount ?? Number(payment.amount) ?? 0,
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'Sessions'), where('sessionName', '==', account)),
        )
        const rows = await Promise.all(
          snap.docs.map(async (sd) => {
            const rateSnap = await getDocs(
              collection(db, 'Sessions', sd.id, 'rateCharged'),
            )
            let rate: number | undefined
            if (!rateSnap.empty) {
              const sorted = rateSnap.docs
                .map((d) => ({ ...(d.data() as any) }))
                .sort((a, b) => {
                  const ta = a.timestamp?.toDate?.() ?? new Date(0)
                  const tb = b.timestamp?.toDate?.() ?? new Date(0)
                  return tb.getTime() - ta.getTime()
                })
              rate = Number(sorted[0]?.rateCharged)
            }
            return { id: sd.id, rate }
          }),
        )
        if (!cancelled) setSessions(rows)
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
      setSelected([])
    } catch (e) {
      console.error('assign payment failed', e)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
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
        <FormGroup>
          {sessions.map((s) => (
            <FormControlLabel
              key={s.id}
              control={
                <Checkbox
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  disabled={
                    assigning ||
                    remaining <= 0 ||
                    (payment.assignedSessions || []).includes(s.id) ||
                    (s.rate || 0) > remaining
                  }
                />
              }
              label={`${s.id} - ${
                s.rate != null ? formatCurrency(Number(s.rate)) : '-'
              }`}
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

