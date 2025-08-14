import React, { useEffect, useState, useMemo } from 'react'
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
  IconButton,
  Tooltip,
} from '@mui/material'
import { useSession } from 'next-auth/react'
import { useBilling } from '../../lib/billing/useBilling'
import { useColumnWidths } from '../../lib/useColumnWidths'
import { collection, orderBy, query, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import PaymentDetail from './PaymentDetail'
import { titleFor } from './title'
import { PATHS, logPath } from '../../lib/paths'
import { WriteIcon } from './icons'
import PaymentModal from './PaymentModal'

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
  const { data: session } = useSession()
  const { data: bill } = useBilling(abbr, account)
  const ordinalMap = useMemo(() => {
    const map: any = {}
    if (bill) bill.rows.forEach((r: any, i: number) => (map[r.id] = i + 1))
    return map
  }, [bill])
  const columns = [
    { key: 'paymentMade', label: 'Payment Made On', width: 160 },
    { key: 'session', label: 'For session', width: 120 },
    { key: 'amount', label: 'Amount Received', width: 160 },
  ]
  const { widths, startResize } = useColumnWidths(
    'payments',
    columns,
    (session && (session.user as any)?.email) || 'anon',
  )

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
    <Box sx={{ p: 4, overflow: 'auto' }}>
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
              <IconButton color="primary" onClick={() => setModalOpen(true)}>
                <WriteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Table size="small" sx={{ cursor: 'pointer', tableLayout: 'fixed', width: 'max-content' }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    width: widths.paymentMade,
                    minWidth: widths.paymentMade,
                    position: 'relative',
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
                    onMouseDown={(e) => startResize('paymentMade', e)}
                    sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize' }}
                  />
                </TableCell>
                <TableCell
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    width: widths.session,
                    minWidth: widths.session,
                    position: 'relative',
                  }}
                >
                  For session
                  <Box
                    onMouseDown={(e) => startResize('session', e)}
                    sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize' }}
                  />
                </TableCell>
                <TableCell
                  sx={{
                    fontFamily: 'Cantata One',
                    fontWeight: 'bold',
                    width: widths.amount,
                    minWidth: widths.amount,
                    position: 'relative',
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
                    onMouseDown={(e) => startResize('amount', e)}
                    sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize' }}
                  />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPayments.map((p) => {
                const sessNum = p.assignedSessions && p.assignedSessions.length > 0 ? ordinalMap[p.assignedSessions[0]] || '–' : '–'
                const remaining = Number(p.remainingAmount) || 0
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
                      sx={{
                        fontFamily: 'Newsreader',
                        fontWeight: 500,
                        width: widths.paymentMade,
                        minWidth: widths.paymentMade,
                      }}
                    >
                      {formatDate(p.paymentMade)}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: 'Newsreader',
                        fontWeight: 500,
                        width: widths.session,
                        minWidth: widths.session,
                      }}
                    >
                      {sessNum || '–'}
                    </TableCell>
                    <TableCell
                      className={remaining > 0 ? 'yellow-blink' : undefined}
                      sx={{
                        fontFamily: 'Newsreader',
                        fontWeight: 500,
                        width: widths.amount,
                        minWidth: widths.amount,
                      }}
                    >
                      {formatCurrency(Number(p.amount) || 0)}
                    </TableCell>
                  </TableRow>
                )
              })}
              {sortedPayments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                    No payments recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PaymentModal
            abbr={abbr}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        </>
      )}
    </Box>
  )
}

