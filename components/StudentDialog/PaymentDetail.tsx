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
  CircularProgress,
} from '@mui/material'
import { doc, setDoc, updateDoc, onSnapshot, collection } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { formatMMMDDYYYY } from '../../lib/date'
import { titleFor } from './title'
import { PATHS, logPath } from '../../lib/paths'
import { useBillingClient, useBilling } from '../../lib/billing/useBilling'
import {
  patchBillingAssignedSessions,
  writeSummaryFromCache,
  payRetainerPatch,
  upsertUnpaidRetainerRow,
} from '../../lib/liveRefresh'

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
  const { data: bill } = useBilling(abbr, account)
  const [retainers, setRetainers] = useState<any[]>([])

  const assignedSet = new Set(payment.assignedSessions || [])
  const sessionRows = bill
    ? bill.rows
        .filter(
          (r) =>
            !r.flags.cancelled &&
            !r.flags.voucherUsed &&
            !r.flags.inRetainer,
        )
        .map((r) => ({
          id: r.id,
          startMs: r.startMs,
          date: r.date,
          time: r.time,
          rate: r.amountDue,
          rateDisplay: r.displayRate,
        }))
        .sort((a, b) => a.startMs - b.startMs)
    : []
  sessionRows.forEach((r: any, i: number) => {
    r.ordinal = i + 1
  })
  const assignedSessions = sessionRows.filter((r) => assignedSet.has(r.id))
  const availableSessions = sessionRows.filter((r) => !assignedSet.has(r.id))
  const retRows = retainers.map((r: any) => ({
    id: `retainer:${r.retainerId}`,
    retainerId: r.retainerId,
    startMs: r.startMs,
    date: (() => {
      const d = new Date(r.startMs)
      if (d.getDate() >= 21) d.setMonth(d.getMonth() + 1)
      return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    })(),
    time: '',
    rate: r.rate,
    rateDisplay: formatCurrency(r.rate),
    paymentId: r.paymentId,
  }))
  const assignedRetainers = retRows.filter((r: any) => r.paymentId === payment.id)
  const availableRetainers = retRows.filter((r: any) => !r.paymentId)
  const assigned = [...assignedSessions, ...assignedRetainers]
  const available = [...availableSessions, ...availableRetainers]

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
    const unsub = onSnapshot(
      doc(db, PATHS.payments(abbr), payment.id),
      (snap) => {
        const data = snap.data()
        if (data) {
          setRemaining(data.remainingAmount ?? Number(data.amount) ?? 0)
          payment.assignedSessions = data.assignedSessions
          payment.assignedRetainers = data.assignedRetainers
        }
      },
    )
    return () => unsub()
  }, [abbr, payment.id])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, PATHS.retainers(abbr)),
      (snap) => {
        const list: any[] = []
        snap.forEach((d) => {
          const r = d.data() as any
          const start = r.retainerStarts?.toDate
            ? r.retainerStarts.toDate()
            : new Date(r.retainerStarts)
          const end = r.retainerEnds?.toDate
            ? r.retainerEnds.toDate()
            : new Date(r.retainerEnds)
          const rate = Number(r.retainerRate) || 0
          const paymentId = r.paymentId || null
          const startMs = start.getTime()
          list.push({
            id: `retainer:${d.id}`,
            retainerId: d.id,
            startMs,
            rate,
            paymentId,
          })
          upsertUnpaidRetainerRow(
            qc,
            abbr,
            account,
            d.id,
            startMs,
            end.getTime(),
            rate,
            !paymentId,
          )
        })
        setRetainers(list)
      },
    )
    return () => unsub()
  }, [abbr, account, qc])


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
      const sessionIds = selected.filter((id) => !id.startsWith('retainer:'))
      const retainerIds = selected
        .filter((id) => id.startsWith('retainer:'))
        .map((id) => id.replace('retainer:', ''))

      for (const id of sessionIds) {
        const session = available.find((s) => s.id === id)
        const rate = session?.rate || 0
        const sessionPayPath = PATHS.sessionPayment(id)
        logPath('assignPayment', `${sessionPayPath}/${payment.id}`)
        await setDoc(doc(db, sessionPayPath, payment.id), {
          amount: rate,
          paymentId: payment.id,
          paymentMade: payment.paymentMade,
        })
      }

      for (const rid of retainerIds) {
        const retPath = PATHS.retainers(abbr)
        logPath('retainerPay', `${retPath}/${rid}`)
        await updateDoc(doc(db, retPath, rid), { paymentId: payment.id })
      }

      const newAssignedSessions = [
        ...(payment.assignedSessions || []),
        ...sessionIds,
      ]
      const newAssignedRetainers = [
        ...(payment.assignedRetainers || []),
        ...retainerIds,
      ]
      const newRemaining = remaining - totalSelected
      const payDocPath = PATHS.payments(abbr)
      logPath('updatePayment', `${payDocPath}/${payment.id}`)
      await updateDoc(doc(db, payDocPath, payment.id), {
        assignedSessions: newAssignedSessions,
        assignedRetainers: newAssignedRetainers,
        remainingAmount: newRemaining,
      })
      payment.assignedSessions = newAssignedSessions
      payment.assignedRetainers = newAssignedRetainers
      setRemaining(newRemaining)
      setSelected([])

      if (sessionIds.length) {
        patchBillingAssignedSessions(qc, abbr, account, sessionIds)
      }
      retainerIds.forEach((rid) =>
        payRetainerPatch(qc, abbr, account, rid),
      )
      await writeSummaryFromCache(qc, abbr, account)
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
            {!bill ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <CircularProgress size={16} />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sortRows(assigned).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                      {s.ordinal ?? '-'}
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
                      {s.ordinal ?? '-'}
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
                {assigned.length === 0 && available.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      No sessions available.
                    </TableCell>
                  </TableRow>
                )}
              </>
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

