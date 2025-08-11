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
import { computeSessionStart, fmtDate, fmtTime } from '../../lib/sessions'
import { formatMMMDDYYYY } from '../../lib/date'
import { titleFor } from './title'
import { PATHS, logPath } from '../../lib/paths'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)


export default function PaymentDetail({
  abbr,
  account,
  payment,
  onBack,
  onTitleChange,
}: {
  abbr: string
  account: string
  payment: any
  onBack: () => void
  onTitleChange?: (title: string | null) => void
}) {
  const [available, setAvailable] = useState<any[]>([])
  const [assignedSessions, setAssignedSessions] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [remaining, setRemaining] = useState<number>(
    payment.remainingAmount ?? Number(payment.amount) ?? 0,
  )
  const [ordinals, setOrdinals] = useState<Record<string, number>>({})

  useEffect(() => {
    const d = payment.paymentMade?.toDate
      ? payment.paymentMade.toDate()
      : new Date(payment.paymentMade)
    const label = isNaN(d.getTime()) ? '-' : formatMMMDDYYYY(d)
    onTitleChange?.(titleFor('billing', 'payment-history', account, label))
    return () => onTitleChange?.(null)
  }, [account, payment.paymentMade, onTitleChange])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const baseRateHistPath = PATHS.baseRateHistory(abbr)
        const baseRatePath = PATHS.baseRate(abbr)
        const sessionsPath = PATHS.sessions
        const retainersPath = PATHS.retainers(abbr)
        logPath('baseRateHistory', baseRateHistPath)
        logPath('baseRate', baseRatePath)
        logPath('sessions', sessionsPath)
        logPath('retainers', retainersPath)
        const [histSnap, baseSnap, sessSnap, retSnap] = await Promise.all([
          getDocs(collection(db, baseRateHistPath)),
          getDocs(collection(db, baseRatePath)),
          getDocs(query(collection(db, sessionsPath), where('sessionName', '==', account))),
          getDocs(collection(db, retainersPath)),
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

        const retainerDocs = retSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        const retainers = retainerDocs.map((r) => {
          const s = r.retainerStarts?.toDate?.() ?? new Date(0)
          const e = r.retainerEnds?.toDate?.() ?? new Date(0)
          return { start: s, end: e, id: r.id, rate: Number(r.retainerRate) || 0, paymentId: r.paymentId }
        })

        const rows = await Promise.all(
          sessSnap.docs.map(async (sd) => {
            const data = sd.data() as any
            const ratePath = PATHS.sessionRate(sd.id)
            const payPath = PATHS.sessionPayment(sd.id)
            logPath('sessionRate', ratePath)
            logPath('sessionPayment', payPath)
            const voucherPath = PATHS.sessionVoucher(sd.id)
            logPath('sessionVoucher', voucherPath)
            const [rateSnap, paySnap, voucherSnap] = await Promise.all([
              getDocs(collection(db, ratePath)),
              getDocs(collection(db, payPath)),
              getDocs(collection(db, voucherPath)),
            ])

            const startDate = await computeSessionStart(sd.id, data)
            const date = startDate ? fmtDate(startDate) : '-'
            const time = startDate ? fmtTime(startDate) : '-'

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
            const hasVoucher = (() => {
              const entries = voucherSnap.docs
                .map((v) => {
                  const data = v.data() as any
                  const ts =
                    (data.timestamp?.toDate?.()?.getTime() ??
                      new Date(data.timestamp).getTime()) ||
                    0
                  return { ...data, ts }
                })
                .sort((a, b) => a.ts - b.ts)
              const latest = entries[entries.length - 1]
              return !!latest && latest['free?'] === true
            })()
            const cancelled =
              (data.sessionType || '').toLowerCase() === 'cancelled'

            return {
              id: sd.id,
              type: 'session',
              date,
              time,
              rate,
              assigned,
              assignedToOther,
              inRetainer,
              startDate,
              hasVoucher,
              cancelled,
            }
          }),
        )
        const retainerRows = retainers.map((r) => {
          const startDate = r.start
          const date = fmtDate(startDate)
          return {
            id: `retainer:${r.id}`,
            type: 'retainer',
            date,
            time: 'Retainer',
            rate: r.rate,
            assigned: r.paymentId === payment.id,
            assignedToOther: r.paymentId && r.paymentId !== payment.id,
            startDate,
            inRetainer: false,
            hasVoucher: false,
            cancelled: false,
            retainerId: r.id,
          }
        })

        if (cancelled) return
        const filteredSessions = rows.filter(
          (r) => !r.inRetainer && !r.hasVoucher && !r.cancelled,
        )
        const allRows = [...filteredSessions, ...retainerRows].sort(
          (a, b) => (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0),
        )
        const map: Record<string, number> = {}
        allRows.forEach((r, i) => {
          map[r.id] = i + 1
        })
        setOrdinals(map)
        setAssignedSessions(allRows.filter((r) => r.assigned))
        setAvailable(allRows.filter((r) => !r.assigned && !r.assignedToOther))
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
      const newAssignedRet: string[] = []
      for (const id of selected) {
        if (id.startsWith('retainer:')) {
          const retId = id.replace('retainer:', '')
          const ret = available.find((s) => s.id === id)
          const rate = ret?.rate || 0
          await updateDoc(doc(db, PATHS.retainers(abbr), retId), {
            paymentId: payment.id,
          })
          if (ret) newlyAssigned.push(ret)
          newAssignedRet.push(retId)
        } else {
          const session = available.find((s) => s.id === id)
          const rate = session?.rate || 0
          const sessionPayPath = PATHS.sessionPayment(id)
          logPath('assignPayment', `${sessionPayPath}/${payment.id}`)
          await setDoc(doc(db, sessionPayPath, payment.id), {
            amount: rate,
            paymentId: payment.id,
            paymentMade: payment.paymentMade,
          })
          if (session) newlyAssigned.push(session)
        }
      }
      const newAssigned = [
        ...(payment.assignedSessions || []),
        ...selected.filter((id) => !id.startsWith('retainer:')),
      ]
      const newRemaining = remaining - totalSelected
      const payDocPath = PATHS.payments(abbr)
      logPath('updatePayment', `${payDocPath}/${payment.id}`)
      await updateDoc(doc(db, payDocPath, payment.id), {
        assignedSessions: newAssigned,
        assignedRetainers: [
          ...(payment.assignedRetainers || []),
          ...newAssignedRet,
        ],
        remainingAmount: newRemaining,
      })
      payment.assignedSessions = newAssigned
      payment.assignedRetainers = [
        ...(payment.assignedRetainers || []),
        ...newAssignedRet,
      ]
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
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Payment Amount:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {formatCurrency(Number(payment.amount) || 0)}
        </Typography>

        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Payment Made On:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {(() => {
            const d = payment.paymentMade?.toDate
              ? payment.paymentMade.toDate()
              : new Date(payment.paymentMade)
            return isNaN(d.getTime()) ? '-' : formatMMMDDYYYY(d)
          })()}
        </Typography>

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
          For session:
        </Typography>
        {assignedSessions.map((s, i) => {
          const ord = ordinals[s.id] ?? i + 1
          const date = s.date || '-'
          const time = s.time || '-'
          const rateStr = formatCurrency(Number(s.rate) || 0)
          return (
            <Typography
              key={s.id}
              variant="h6"
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              {`#${ord} | ${date} | ${time} | ${rateStr}`}
            </Typography>
          )
        })}
        {remaining > 0 && (
          <>
            <FormGroup>
              {available.map((s, i) => {
                const ord = ordinals[s.id] ?? i + 1
                const date = s.date || '-'
                const time = s.time || '-'
                const rateStr = formatCurrency(Number(s.rate) || 0)
                return (
                  <FormControlLabel
                    key={s.id}
                    control={
                      <Checkbox
                        checked={selected.includes(s.id)}
                        onChange={() => toggle(s.id)}
                        disabled={assigning || (s.rate || 0) > remaining}
                      />
                    }
                    label={`#${ord} | ${date} | ${time} | ${rateStr}`}
                  />
                )
              })}
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
        <Button
          variant="text"
          onClick={() => {
            onBack()
            onTitleChange?.(null)
          }}
          aria-label="back to payments"
        >
          ← Back
        </Button>
      </Box>
    </Box>
  )
}

