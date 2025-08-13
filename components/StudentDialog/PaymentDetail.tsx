import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
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
import { fmtDate, fmtTime } from '../../lib/sessions'
import { formatMMMDDYYYY } from '../../lib/date'
import { titleFor } from './title'
import { PATHS, logPath } from '../../lib/paths'
import { buildContext, computeBilling } from '../../lib/billing/compute'
import {
  useBillingClient,
  invalidateBilling,
  writeBillingSummary,
} from '../../lib/billing/useBilling'

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
  const [sortField, setSortField] = useState<'ordinal' | 'date' | 'time' | 'rate'>(
    'ordinal',
  )
  const [sortAsc, setSortAsc] = useState(true)
  const qc = useBillingClient()

  const sortRows = (rows: any[]) => {
    const val = (r: any) => {
      switch (sortField) {
        case 'ordinal':
          return r.ordinal || 0
        case 'date':
        case 'time':
          return r.startMs || 0
        case 'rate':
          return Number(r.rate) || 0
        default:
          return 0
      }
    }
    return [...rows].sort((a, b) =>
      sortAsc ? val(a) - val(b) : val(b) - val(a),
    )
  }

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
            const histPath = PATHS.sessionHistory(sd.id)
            logPath('sessionHistory', histPath)
            const [rateSnap, paySnap, voucherSnap, histSnap] = await Promise.all([
              getDocs(collection(db, ratePath)),
              getDocs(collection(db, payPath)),
              getDocs(collection(db, voucherPath)),
              getDocs(collection(db, histPath)),
            ])

            const parseDate = (v: any) => {
              const d = v?.toDate ? v.toDate() : new Date(v)
              return isNaN(d.getTime()) ? null : d
            }
            const hist = histSnap.docs
              .map((d) => d.data() as any)
              .sort((a, b) => {
                const ta =
                  a.changeTimestamp?.toDate?.() ??
                  a.timestamp?.toDate?.() ??
                  new Date(0)
                const tb =
                  b.changeTimestamp?.toDate?.() ??
                  b.timestamp?.toDate?.() ??
                  new Date(0)
                return tb.getTime() - ta.getTime()
              })[0]
            let start =
              hist?.newStartTimestamp ??
              hist?.origStartTimestamp ??
              data?.origStartTimestamp ??
              data?.sessionDate ??
              data?.startTimestamp
            let end =
              hist?.newEndTimestamp ??
              hist?.origEndTimestamp ??
              data?.origEndTimestamp ??
              data?.endTimestamp
            const startDate = parseDate(start)
            const endDate = parseDate(end)
            const date = startDate ? fmtDate(startDate) : '-'
            const startStr = startDate ? fmtTime(startDate) : '-'
            const endStr = endDate ? fmtTime(endDate) : ''
            const time = startStr + (endStr ? `-${endStr}` : '')
            const startMs = startDate?.getTime() ?? 0

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
            const isCancelled =
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
              startMs,
              hasVoucher,
              cancelled: isCancelled,
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
            startMs: startDate.getTime(),
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
        const allRows: any[] = [...filteredSessions, ...retainerRows].sort(
          (a, b) => a.startMs - b.startMs,
        )
        allRows.forEach((r, i) => {
          r.ordinal = i + 1
        })
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

      await invalidateBilling(abbr, account, qc)
      const res = computeBilling(await buildContext(abbr, account))
      await writeBillingSummary(abbr, res)
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
        <Table size="small" sx={{ mt: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
                <TableSortLabel
                  active={sortField === 'ordinal'}
                  direction={sortField === 'ordinal' && sortAsc ? 'asc' : 'desc'}
                  onClick={() => {
                    if (sortField === 'ordinal') setSortAsc((s) => !s)
                    else {
                      setSortField('ordinal')
                      setSortAsc(true)
                    }
                  }}
                >
                  Session #
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
                <TableSortLabel
                  active={sortField === 'date'}
                  direction={sortField === 'date' && sortAsc ? 'asc' : 'desc'}
                  onClick={() => {
                    if (sortField === 'date') setSortAsc((s) => !s)
                    else {
                      setSortField('date')
                      setSortAsc(true)
                    }
                  }}
                >
                  Date
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
                <TableSortLabel
                  active={sortField === 'time'}
                  direction={sortField === 'time' && sortAsc ? 'asc' : 'desc'}
                  onClick={() => {
                    if (sortField === 'time') setSortAsc((s) => !s)
                    else {
                      setSortField('time')
                      setSortAsc(true)
                    }
                  }}
                >
                  Time
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
                <TableSortLabel
                  active={sortField === 'rate'}
                  direction={sortField === 'rate' && sortAsc ? 'asc' : 'desc'}
                  onClick={() => {
                    if (sortField === 'rate') setSortAsc((s) => !s)
                    else {
                      setSortField('rate')
                      setSortAsc(true)
                    }
                  }}
                >
                  Rate
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortRows(assignedSessions).map((s) => (
              <TableRow key={s.id}>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {s.ordinal}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {s.date || '-'}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {s.time || '-'}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {formatCurrency(Number(s.rate) || 0)}
                </TableCell>
              </TableRow>
            ))}
            {sortRows(available).map((s) => (
              <TableRow key={s.id}>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  <Checkbox
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    disabled={assigning || (s.rate || 0) > remaining}
                    sx={{ p: 0, mr: 1 }}
                  />
                  {s.ordinal}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {s.date || '-'}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {s.time || '-'}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {formatCurrency(Number(s.rate) || 0)}
                </TableCell>
              </TableRow>
            ))}
            {assignedSessions.length === 0 && available.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                >
                  No sessions available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {remaining > 0 && (
          <Button
            variant="contained"
            sx={{ mt: 1 }}
            onClick={handleAssign}
            disabled={assigning || totalSelected === 0 || totalSelected > remaining}
          >
            Assign
          </Button>
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

