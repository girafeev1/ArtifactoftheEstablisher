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
    { key: 'paymentMade', label: 'Payment Made On', width: 160 },
    { key: 'amount', label: 'Amount Received', width: 160 },
    { key: 'session', label: 'For Session(s)', width: 200 },
  ] as const
  const { widths, startResize, dblClickResize } = useColumnWidths(
    'payments',
    columns,
    userEmail,
  )

  const sessionMap = React.useMemo(() => {
    const m: Record<string, number> = {}
    bill?.rows?.forEach((r: any, i: number) => {
      m[r.id] = i + 1
    })
    return m
  }, [bill])

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
              size="small"
              sx={{ cursor: 'pointer', tableLayout: 'fixed', width: 'max-content' }}
            >
              <TableHead>
                <TableRow>
                <TableCell
                  data-col="paymentMade"
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    position: 'relative',
                    width: widths['paymentMade'],
                    minWidth: widths['paymentMade'],
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
                    Payment Made On
                  </TableSortLabel>
                  <Box
                    className="col-resizer"
                    aria-label="Resize column Payment Made On"
                    onMouseDown={(e) => startResize('paymentMade', e)}
                    onDoubleClick={(e) => dblClickResize('paymentMade', e)}
                  />
                </TableCell>
                <TableCell
                  data-col="amount"
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    position: 'relative',
                    width: widths['amount'],
                    minWidth: widths['amount'],
                  }}
                >
                  <TableSortLabel
                    active={sortField === 'amount'}
                    direction={sortField === 'amount' && sortAsc ? 'asc' : 'desc'}
                    onClick={() => {
                      if (sortField === 'amount') setSortAsc((s) => !s)
                      else {
                        setSortField('amount')
                        setSortAsc(true)
                      }
                    }}
                  >
                    Amount Received
                  </TableSortLabel>
                  <Box
                    className="col-resizer"
                    aria-label="Resize column Amount Received"
                    onMouseDown={(e) => startResize('amount', e)}
                    onDoubleClick={(e) => dblClickResize('amount', e)}
                  />
                </TableCell>
                <TableCell
                  data-col="session"
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    position: 'relative',
                    width: widths['session'],
                    minWidth: widths['session'],
                  }}
                >
                  For Session(s)
                  <Box
                    className="col-resizer"
                    aria-label="Resize column For Session(s)"
                    onMouseDown={(e) => startResize('session', e)}
                    onDoubleClick={(e) => dblClickResize('session', e)}
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
                const unassigned = (p.assignedSessions?.length ?? 0) === 0
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
                      data-col="session"
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
                        return ords.length
                          ? ords.map((o) => `#${o}`).join(', ')
                          : '—'
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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </Box>
  )
}

