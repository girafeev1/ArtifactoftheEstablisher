// components/StudentDialog/Sessions.tsx

import React, { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '../../lib/firebase'
import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material'

interface SessionRow {
  id: string
  date?: any
  time?: any
  duration?: number
  sessionType?: string
  billingType?: string
  baseRate?: number
  retainerStatus?: string
  rateCharged?: number
  paymentStatus?: string
}

interface Props {
  abbr: string
  serviceMode: boolean
}

export default function Sessions({ abbr, serviceMode }: Props) {
  const [rows, setRows] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { setLoading(false); return }
      getDocs(
        query(
          collection(db, 'Students', abbr, 'sessions'),
          orderBy('date', 'desc')
        )
      ).then(snap => {
        if (!mounted) return
        setRows(
          snap.docs.map(d => {
            const data = d.data() as any
            const dt: Date = data.date?.toDate() ?? new Date()
            return {
              id:            d.id,
              date:          dt,
              time:          dt,
              duration:      data.duration,
              sessionType:   data.topic,
              billingType:   data.billingType,
              baseRate:      data.baseRate,
              retainerStatus:data.retainerStatus,
              rateCharged:   data.amount,
              paymentStatus: data.paymentStatus,
            }
          })
        )
      }).catch(console.error)
        .finally(() => mounted && setLoading(false))
    })

    return () => { mounted = false; unsub() }
  }, [abbr])

  if (loading) {
    return <Box textAlign="center" py={4}><CircularProgress /></Box>
  }
  if (!rows.length) {
    return <Typography>No session history.</Typography>
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell>Time</TableCell>
          <TableCell>Duration</TableCell>
          <TableCell>Session Type</TableCell>
          <TableCell>Billing Type</TableCell>
          <TableCell>Base Rate</TableCell>
          <TableCell>Retainer</TableCell>
          <TableCell>Rate Charged</TableCell>
          <TableCell>Payment Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
          {rows.map(r => (
          <TableRow key={r.id}>
            <TableCell>{r.date?.toLocaleDateString() ?? '–'}</TableCell>
            <TableCell>{r.time?.toLocaleTimeString()  ?? '–'}</TableCell>
            <TableCell>{r.duration ?? '–'}</TableCell>
            <TableCell>{r.sessionType ?? '–'}</TableCell>
            <TableCell>{r.billingType ?? '–'}</TableCell>
            <TableCell>${r.baseRate?.toFixed(2)   ?? '–'}</TableCell>
            <TableCell>{r.retainerStatus ?? '–'}</TableCell>
            <TableCell>${r.rateCharged?.toFixed(2) ?? '–'}</TableCell>
            <TableCell>{r.paymentStatus ?? '–'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
