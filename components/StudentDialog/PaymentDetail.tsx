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
import { useSession } from 'next-auth/react'
import { useColumnWidths } from '../../lib/useColumnWidths'

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
  const amount = Number(payment.amount) || 0
  const applied = Number(payment.appliedAmount ?? 0)
  const initialRemaining = Number(
    payment.remainingAmount ?? (amount - applied),
  )
  const [remaining, setRemaining] = useState<number>(initialRemaining)
  const [assignedSessionIds, setAssignedSessionIds] = useState<string[]>(
    payment.assignedSessions || [],
  )
  const [assignedRetainerIds, setAssignedRetainerIds] = useState<string[]>(
    payment.assignedRetainers || [],
  )
  const [sortField, setSortField] = useState<'ordinal' | 'date' | 'time' | 'rate'>(
    'ordinal',
  )
  const [sortAsc, setSortAsc] = useState(true)
  const qc = useBillingClient()
  const { data: bill } = useBilling(abbr, account)
  const [retainers, setRetainers] = useState<any[]>([])
  const { data: session } = useSession()
  const userEmail = session?.user?.email || 'anon'
  const columns = [
    { key: 'ordinal', width: 80 },
    { key: 'date', width: 110 },
    { key: 'time', width: 100 },
    { key: 'rate', width: 130 },
  ] as const
  const { widths, startResize, dblClickResize, keyResize } = useColumnWidths(
    'paymentDetail',
    columns,
    userEmail,
  )
  const tableRef = React.useRef<HTMLTableElement>(null)

  const assignedSet = new Set(assignedSessionIds)
  const allRows = bill
    ? bill.rows.map((r: any, i: number) => ({ ...r, ordinal: i + 1 }))
    : []
  const sessionRows = allRows
    .filter(
      (r) => !r.flags.cancelled && !r.flags.voucherUsed && !r.flags.inRetainer,
    )
    .map((r) => ({
      id: r.id,
      startMs: r.startMs,
      date: r.date,
      time: r.time,
      rate: r.amountDue,
      rateDisplay: r.displayRate,
      assignedPaymentId: r.assignedPaymentId,
      ordinal: r.ordinal,
    }))
    .sort((a, b) => a.startMs - b.startMs)
  const assignedSessions = sessionRows.filter((r) => assignedSet.has(r.id))
  const availableSessions = sessionRows.filter(
    (r) => !assignedSet.has(r.id) && !r.assignedPaymentId,
  )
  const retRows = retainers.map((r: any, i: number) => ({
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
    ordinal: sessionRows.length + i + 1,
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
          const amt = Number(data.amount) || 0
          const appliedAmt = Number(data.appliedAmount ?? 0)
          setRemaining(
            Number(data.remainingAmount ?? (amt - appliedAmt)),
          )
          setAssignedSessionIds(data.assignedSessions || [])
          setAssignedRetainerIds(data.assignedRetainers || [])
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
  const remainingAfterSelection = Math.max(0, remaining - totalSelected)

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

      const newAssignedSessions = [...assignedSessionIds, ...sessionIds]
      const newAssignedRetainers = [...assignedRetainerIds, ...retainerIds]
      const newRemaining = remaining - totalSelected
      const payDocPath = PATHS.payments(abbr)
      logPath('updatePayment', `${payDocPath}/${payment.id}`)
      await updateDoc(doc(db, payDocPath, payment.id), {
        assignedSessions: newAssignedSessions,
        assignedRetainers: newAssignedRetainers,
        remainingAmount: newRemaining,
      })
      setAssignedSessionIds(newAssignedSessions)
      setAssignedRetainerIds(newAssignedRetainers)
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
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 4, pb: '64px' }}>
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
          {formatCurrency(amount)}
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
          Remaining amount:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          <span
            className={
              remaining > 0 || assignedSessionIds.length === 0
                ? 'blink-amount--warn'
                : undefined
            }
          >
            {formatCurrency(remaining)}
          </span>{' '}
          {totalSelected > 0 && (
            <Box component="span" sx={{ color: 'error.main' }}>
              ({`-${formatCurrency(totalSelected)} = ${formatCurrency(remainingAfterSelection)}`})
            </Box>
          )}
        </Typography>

        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          For session:
        </Typography>
        <Table
          ref={tableRef}
          size="small"
          sx={{
            mt: 1,
            tableLayout: 'fixed',
            width: 'max-content',
            '& td, & th': {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                data-col="ordinal"
                title="Session #"
                sx={{
                  fontFamily: 'Cantata One',
                  fontWeight: 'bold',
                  position: 'relative',
                  width: widths['ordinal'],
                  minWidth: widths['ordinal'],
                }}
              >
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
                <Box
                  className="col-resizer"
                  aria-label="Resize column Session #"
                  role="separator"
                  tabIndex={0}
                  onMouseDown={(e) => startResize('ordinal', e)}
                  onDoubleClick={() =>
                    dblClickResize('ordinal', tableRef.current || undefined)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') keyResize('ordinal', 'left')
                    if (e.key === 'ArrowRight') keyResize('ordinal', 'right')
                  }}
                />
              </TableCell>
              <TableCell
                data-col="date"
                title="Date"
                sx={{
                  fontFamily: 'Cantata One',
                  fontWeight: 'bold',
                  position: 'relative',
                  width: widths['date'],
                  minWidth: widths['date'],
                }}
              >
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
                <Box
                  className="col-resizer"
                  aria-label="Resize column Date"
                  role="separator"
                  tabIndex={0}
                  onMouseDown={(e) => startResize('date', e)}
                  onDoubleClick={() =>
                    dblClickResize('date', tableRef.current || undefined)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') keyResize('date', 'left')
                    if (e.key === 'ArrowRight') keyResize('date', 'right')
                  }}
                />
              </TableCell>
              <TableCell
                data-col="time"
                title="Time"
                sx={{
                  fontFamily: 'Cantata One',
                  fontWeight: 'bold',
                  position: 'relative',
                  width: widths['time'],
                  minWidth: widths['time'],
                }}
              >
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
                <Box
                  className="col-resizer"
                  aria-label="Resize column Time"
                  role="separator"
                  tabIndex={0}
                  onMouseDown={(e) => startResize('time', e)}
                  onDoubleClick={() =>
                    dblClickResize('time', tableRef.current || undefined)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') keyResize('time', 'left')
                    if (e.key === 'ArrowRight') keyResize('time', 'right')
                  }}
                />
              </TableCell>
              <TableCell
                data-col="rate"
                title="Rate"
                sx={{
                  fontFamily: 'Cantata One',
                  fontWeight: 'bold',
                  position: 'relative',
                  width: widths['rate'],
                  minWidth: widths['rate'],
                }}
              >
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
                <Box
                  className="col-resizer"
                  aria-label="Resize column Rate"
                  role="separator"
                  tabIndex={0}
                  onMouseDown={(e) => startResize('rate', e)}
                  onDoubleClick={() =>
                    dblClickResize('rate', tableRef.current || undefined)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') keyResize('rate', 'left')
                    if (e.key === 'ArrowRight') keyResize('rate', 'right')
                  }}
                />
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
                    <TableCell
                      data-col="ordinal"
                      title={String(s.ordinal ?? '-')}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {s.ordinal ?? '-'}
                    </TableCell>
                    <TableCell
                      data-col="date"
                      title={s.date || '-'}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {s.date || '-'}
                    </TableCell>
                    <TableCell
                      data-col="time"
                      title={s.time || '-'}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {s.time || '-'}
                    </TableCell>
                    <TableCell
                      data-col="rate"
                      title={formatCurrency(Number(s.rate) || 0)}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {formatCurrency(Number(s.rate) || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {sortRows(available).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell
                      data-col="ordinal"
                      title={String(s.ordinal ?? '-')}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      <Checkbox
                        checked={selected.includes(s.id)}
                        onChange={() => toggle(s.id)}
                        disabled={
                          assigning ||
                          (!selected.includes(s.id) &&
                            (s.rate || 0) >
                              Math.max(0, remaining - totalSelected))
                        }
                        sx={{ p: 0, mr: 1 }}
                      />
                      {s.ordinal ?? '-'}
                    </TableCell>
                    <TableCell
                      data-col="date"
                      title={s.date || '-'}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {s.date || '-'}
                    </TableCell>
                    <TableCell
                      data-col="time"
                      title={s.time || '-'}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {s.time || '-'}
                    </TableCell>
                    <TableCell
                      data-col="rate"
                      title={formatCurrency(Number(s.rate) || 0)}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
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
      </Box>
      <Box
        className="dialog-footer"
        sx={{ p: 1, display: 'flex', justifyContent: 'space-between' }}
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
        {remaining > 0 && (
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={
              assigning || totalSelected === 0 || totalSelected > remaining
            }
          >
            Assign
          </Button>
        )}
      </Box>
    </Box>
  )
}

