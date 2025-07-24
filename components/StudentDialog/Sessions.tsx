// components/StudentDialog/Sessions.tsx

import React, { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy, where, limit, getDoc, doc } from 'firebase/firestore'
import { getDb } from '../../lib/firebase'
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
    ;(async () => {
      const db = getDb()
      if (!db) return
      console.log('[Sessions] fetching sessions for', abbr)
      const stu = await getDoc(doc(db, 'Students', abbr))
      const account = stu.exists() ? (stu.data() as any).account : abbr

      const sessQ = query(
        collection(db, 'Sessions'),
        where('sessionName', '==', account)
      )
      const sessSnap = await getDocs(sessQ)
      console.log('[Sessions] found', sessSnap.size, 'sessions')

      const rowsData = await Promise.all(
        sessSnap.docs.map(async d => {
          const histSnap = await getDocs(
            query(
              collection(db, 'Sessions', d.id, 'AppointmentHistory'),
              orderBy('dateStamp', 'desc'),
              limit(1)
            )
          )
          const hist = histSnap.docs[0]?.data() as any
          const start =
            hist?.newStartTimestamp?.toDate?.() ||
            hist?.origStartTimestamp?.toDate?.()
          const end =
            hist?.newEndTimestamp?.toDate?.() ||
            hist?.origEndTimestamp?.toDate?.()
          const duration =
            start && end ? (end.getTime() - start.getTime()) / 3600000 : undefined
          return {
            id: d.id,
            date: start,
            time: start,
            duration,
            sessionType: hist?.sessionType,
            billingType: hist?.billingType,
            baseRate: hist?.baseRate,
            retainerStatus: hist?.retainerStatus,
            rateCharged: hist?.rateCharged,
            paymentStatus: hist?.paymentStatus,
          }
        })
      )

      if (!mounted) return
      setRows(rowsData.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)))
      console.log('[Sessions] rows loaded', rowsData.length)
    })()
      .catch(console.error)
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
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
