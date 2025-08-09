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
} from '@mui/material'
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import PaymentDetail from './PaymentDetail'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD' }).format(n)

const formatDateTime = (v: any) => {
  if (!v) return 'N/A'
  try {
    const d = v.toDate ? v.toDate() : new Date(v)
    return isNaN(d.getTime())
      ? 'N/A'
      : d.toLocaleString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
  } catch {
    return 'N/A'
  }
}

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
}: {
  abbr: string
  account: string
  onTitleChange?: (title: string | null) => void
}) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any | null>(null)
  const [sortField, setSortField] = useState<'amount' | 'paymentMade'>('paymentMade')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'Students', abbr, 'Payments'),
            orderBy('paymentMade', 'desc'),
          ),
        )
        if (cancelled) return
        const list = await Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data() as any
            let sessionDate: any = null
            const first = data.assignedSessions?.[0]
            if (first) {
              try {
                const sess = await getDoc(doc(db, 'Sessions', first))
                const sdata = sess.data() as any
                sessionDate = sdata?.origStartTimestamp
              } catch (e) {
                console.error('fetch session for payment failed', e)
              }
            }
            return { id: d.id, ...data, sessionDate }
          }),
        )
        setPayments(list)
      } catch (e) {
        console.error('load payments failed', e)
        if (cancelled) return
        setPayments([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [abbr])


  const sortedPayments = [...payments].sort((a, b) => {
    const ts = (v: any) => {
      if (!v) return 0
      const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v)
      return isNaN(d.getTime()) ? 0 : d.getTime()
    }
    const av = sortField === 'amount' ? Number(a.amount) || 0 : ts(a.paymentMade)
    const bv = sortField === 'amount' ? Number(b.amount) || 0 : ts(b.paymentMade)
    return sortAsc ? av - bv : bv - av
  })

  if (detail)
    return (
      <PaymentDetail
        abbr={abbr}
        account={account}
        payment={detail}
        onBack={() => setDetail(null)}
        onTitleChange={onTitleChange}
      />
    )

  return (
    <Box sx={{ p: 4, overflow: 'auto' }}>
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <Typography
            variant="subtitle1"
            sx={{ fontFamily: 'Cantata One', textDecoration: 'underline', mb: 1 }}
          >
            Payment History
          </Typography>
          <Table size="small" sx={{ cursor: 'pointer' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
                  For session
                </TableCell>
                <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
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
                </TableCell>
                <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>
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
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPayments.map((p) => (
                <TableRow key={p.id} hover onClick={() => setDetail(p)}>
                  <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                    {formatDateTime(p.sessionDate)}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                    {formatCurrency(Number(p.amount) || 0)}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                    {formatDate(p.paymentMade)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  )
}

