import React, { useEffect, useState } from 'react'
import {
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
} from '@mui/material'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import PaymentDetail from './PaymentDetail'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD' }).format(n)

const formatDate = (v: any) => {
  if (!v) return 'N/A'
  try {
    const d = v.toDate ? v.toDate() : new Date(v)
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString()
  } catch {
    return 'N/A'
  }
}

export default function PaymentHistory({
  abbr,
  account,
}: {
  abbr: string
  account: string
}) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'Students', abbr, 'Payments'),
            orderBy('paymentMade', 'desc')
          )
        )
        if (cancelled) return
        setPayments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
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

  if (detail)
    return (
      <PaymentDetail
        abbr={abbr}
        account={account}
        payment={detail}
        onBack={() => setDetail(null)}
      />
    )

  return (
    <Box sx={{ p: 2, overflow: 'auto' }}>
      {loading ? (
        <CircularProgress />
      ) : (
        <Table size="small" sx={{ cursor: 'pointer' }}>
          <TableHead>
            <TableRow>
              <TableCell>Amount</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id} hover onClick={() => setDetail(p)}>
                <TableCell>{formatCurrency(Number(p.amount) || 0)}</TableCell>
                <TableCell>{formatDate(p.paymentMade)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}

