import React, { useEffect, useState } from 'react'
import {
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Typography,
  TableSortLabel,
  Button,
} from '@mui/material'
import { collection, orderBy, query, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import PaymentDetail from './PaymentDetail'
import { titleFor } from './title'
import { PATHS, logPath } from '../../lib/paths'
import { WriteIcon } from './icons'
import PaymentModal from './PaymentModal'
import { useBilling } from '../../lib/billing/useBilling'
import { minUnpaidRate } from '../../lib/billing/minUnpaidRate'
import { paymentBlinkClass } from '../../lib/billing/paymentBlink'
import { formatSessions } from '../../lib/billing/formatSessions'
import { useSession } from 'next-auth/react'
import { useColumnWidths } from '../../lib/useColumnWidths'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)

const formatDate = (v: any) => {
  if (!v) return 'N/A'
  try {
    const d = v.toDate ? v.toDate() : new Date(v)
    return isNaN(d.getTime())
      ? 'N/A'
      : d.toLocaleDateString(undefined, {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
  } catch {
    return 'N/A'
  }
}

export default function PaymentHistory({
  abbr,
  account,
  onTitleChange,
  active,
}: {
  abbr: string
  account: string
  onTitleChange?: (title: string | null) => void
  active: boolean
}) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any | null>(null)
  const [sortField, setSortField] = useState<'amount' | 'paymentMade'>('paymentMade')
  const [sortAsc, setSortAsc] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const { data: bill } = useBilling(abbr, account)
  const { data: session } = useSession()
  const userEmail = session?.user?.email || 'anon'
  const columns = [
    { key: 'paymentMade', label: 'Payment Date', width: 140 },
    { key: 'amount', label: 'Amount', width: 130 },
    { key: 'method', label: 'Method', width: 120 },
    { key: 'entity', label: 'Entity', width: 160 },
    { key: 'session', label: 'For Session(s)', width: 180 },
  ] as const
  const { widths, startResize, dblClickResize, keyResize } = useColumnWidths(
    'payments',
    columns,
    userEmail,
  )
  const tableRef = React.useRef<HTMLTableElement>(null)

  const sessionMap = React.useMemo(() => {
    const m: Record<string, number> = {}
    bill?.rows?.forEach((r: any, i: number) => {
      m[r.id] = i + 1
    })
    return m
  }, [bill])

  const minDue = React.useMemo(() => minUnpaidRate(bill?.rows || []), [bill])

  useEffect(() => {
    if (active) onTitleChange?.(titleFor('billing', 'payment-history', account))
    else onTitleChange?.(null)
  }, [account, onTitleChange, active])

  useEffect(() => {
    const paymentsPath = PATHS.payments(abbr)
    logPath('payments', paymentsPath)
    const q = query(collection(db, paymentsPath), orderBy('paymentMade', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        setPayments(list)
        setLoading(false)
      },
      (e) => {
        console.error('load payments failed', e)
        setPayments([])
        setLoading(false)
      },
    )
    return () => unsub()
  }, [abbr])


  const ts = (v: any) => {
    if (!v) return 0
    const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v)
    return isNaN(d.getTime()) ? 0 : d.getTime()
  }
  const sortedPayments = [...payments].sort((a, b) => {
    const av = sortField === 'amount' ? Number(a.amount) || 0 : ts(a.paymentMade)
    const bv = sortField === 'amount' ? Number(b.amount) || 0 : ts(b.paymentMade)
    return sortAsc ? av - bv : bv - av
  })

  if (detail)
    return (
      <Box sx={{ height: '100%' }}>
        <PaymentDetail
          abbr={abbr}
          account={account}
          payment={detail}
          onBack={() => setDetail(null)}
          onTitleChange={onTitleChange}
        />
      </Box>
    )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 4, pb: '64px' }}>
        {loading ? (
          <CircularProgress />
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: 'Cantata One', textDecoration: 'underline' }}
              >
                Payment History
              </Typography>
              <Tooltip title="Add Payment">
                <IconButton
                  color="primary"
                  onClick={() => setModalOpen(true)}
                  aria-label="Add Payment"
                >
                  <WriteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Table
              ref={tableRef}
              size="small"
              sx={{
                cursor: 'pointer',
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
                  data-col="paymentMade"
                  data-col-header
                  title="Payment Date"
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    position: 'relative',
                    width: widths['paymentMade'],
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <TableSortLabel
                    active={sortField === 'paymentMade'}
                    direction={sortField === 'paymentMade' && sortAsc ? 'asc' : 'desc'}
                    onClick={() => {
                      if (sortField === 'paymentMade') setSortAsc((s) => !s)
                      else {
                        setSortField('paymentMade')
                        setSortAsc(false)
                      }
                    }}
                  >
                    Payment Date
                  </TableSortLabel>
                  <Box
                    className="col-resizer"
                    aria-label="Resize column Payment Date"
                    role="separator"
                    tabIndex={0}
                    onMouseDown={(e) => startResize('paymentMade', e)}
                    onDoubleClick={() =>
                      dblClickResize('paymentMade', tableRef.current || undefined)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') keyResize('paymentMade', 'left')
                      if (e.key === 'ArrowRight') keyResize('paymentMade', 'right')
                    }}
                  />
                </TableCell>
                <TableCell
                  data-col="amount"
                  data-col-header
                  title="Amount"
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    position: 'relative',
                    width: widths['amount'],
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <TableSortLabel
                    active={sortField === 'amount'}
                    direction={sortField === 'amount' && sortAsc ? 'asc' : 'desc'}
                    onClick={() => {
                      if (sortField === 'amount') setSortAsc((s) => !s)
                      else {
                        setSortField('amount')
                        setSortAsc(false)
                      }
                    }}
                  >
                    Amount
                  </TableSortLabel>
                  <Box
                    className="col-resizer"
                    aria-label="Resize column Amount"
                    role="separator"
                    tabIndex={0}
                    onMouseDown={(e) => startResize('amount', e)}
                    onDoubleClick={() =>
                      dblClickResize('amount', tableRef.current || undefined)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') keyResize('amount', 'left')
                      if (e.key === 'ArrowRight') keyResize('amount', 'right')
                    }}
                  />
                </TableCell>
                <TableCell
                  data-col="method"
                  data-col-header
                  title="Method"
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    position: 'relative',
                    width: widths['method'],
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Method
                  <Box
                    className="col-resizer"
                    aria-label="Resize column Method"
                    role="separator"
                    tabIndex={0}
                    onMouseDown={(e) => startResize('method', e)}
                    onDoubleClick={() =>
                      dblClickResize('method', tableRef.current || undefined)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') keyResize('method', 'left')
                      if (e.key === 'ArrowRight') keyResize('method', 'right')
                    }}
                  />
                </TableCell>
                <TableCell
                  data-col="entity"
                  data-col-header
                  title="Entity"
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    position: 'relative',
                    width: widths['entity'],
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Entity
                  <Box
                    className="col-resizer"
                    aria-label="Resize column Entity"
                    role="separator"
                    tabIndex={0}
                    onMouseDown={(e) => startResize('entity', e)}
                    onDoubleClick={() =>
                      dblClickResize('entity', tableRef.current || undefined)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') keyResize('entity', 'left')
                      if (e.key === 'ArrowRight') keyResize('entity', 'right')
                    }}
                  />
                </TableCell>
                <TableCell
                  data-col="session"
                  data-col-header
                  title="For Session(s)"
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    position: 'relative',
                    width: widths['session'],
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  For Session(s)
                  <Box
                    className="col-resizer"
                    aria-label="Resize column For Session(s)"
                    role="separator"
                    tabIndex={0}
                    onMouseDown={(e) => startResize('session', e)}
                    onDoubleClick={() =>
                      dblClickResize('session', tableRef.current || undefined)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') keyResize('session', 'left')
                      if (e.key === 'ArrowRight') keyResize('session', 'right')
                    }}
                  />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPayments.map((p) => {
                const amount = Number(p.amount) || 0
                const applied = Number(p.appliedAmount ?? 0)
                const remaining = Number(
                  p.remainingAmount ?? (amount - applied),
                )
                return (
                  <TableRow
                    key={p.id}
                    hover
                    onClick={() => setDetail(p)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDetail(p)
                      }
                    }}
                    sx={{ cursor: 'pointer', py: 1 }}
                  >
                    <TableCell
                      data-col="paymentMade"
                      title={formatDate(p.paymentMade)}
                      sx={{
                        fontFamily: 'Newsreader',
                        fontWeight: 500,
                        width: widths['paymentMade'],
                        minWidth: widths['paymentMade'],
                      }}
                    >
                      {formatDate(p.paymentMade)}
                    </TableCell>
                    <TableCell
                      data-col="amount"
                      title={formatCurrency(amount)}
                      className={paymentBlinkClass(remaining, minDue)}
                      sx={{
                        fontFamily: 'Newsreader',
                        fontWeight: 500,
                        width: widths['amount'],
                        minWidth: widths['amount'],
                      }}
                    >
                      {formatCurrency(amount)}
                    </TableCell>
                    <TableCell
                      data-col="method"
                      title={p.method || '—'}
                      sx={{
                        fontFamily: 'Newsreader',
                        fontWeight: 500,
                        width: widths['method'],
                        minWidth: widths['method'],
                      }}
                    >
                      {p.method || '—'}
                    </TableCell>
                    <TableCell
                      data-col="entity"
                      title={p.entity ? (p.entity === 'ME-ERL' ? 'Music Establish (ERL)' : p.entity) : '—'}
                      sx={{
                        fontFamily: 'Newsreader',
                        fontWeight: 500,
                        width: widths['entity'],
                        minWidth: widths['entity'],
                      }}
                    >
                      {p.entity
                        ? p.entity === 'ME-ERL'
                          ? 'Music Establish (ERL)'
                          : p.entity
                        : '—'}
                    </TableCell>
                    <TableCell
                      data-col="session"
                      title={(() => {
                        const ords = (p.assignedSessions || [])
                          .map((id: string) => sessionMap[id])
                          .filter(Boolean)
                        return formatSessions(ords)
                      })()}
                      sx={{
                        fontFamily: 'Newsreader',
                        fontWeight: 500,
                        width: widths['session'],
                        minWidth: widths['session'],
                      }}
                    >
                      {(() => {
                        const ords = (p.assignedSessions || [])
                          .map((id: string) => sessionMap[id])
                          .filter(Boolean)
                        return formatSessions(ords)
                      })()}
                    </TableCell>
                  </TableRow>
                )
              })}
              {sortedPayments.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                  >
                    No payments recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          </>
        )}
      </Box>
      <PaymentModal
        abbr={abbr}
        account={account}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </Box>
  )
}

