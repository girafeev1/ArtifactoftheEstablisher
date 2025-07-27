// components/StudentDialog/SessionsTab.tsx

import React from 'react'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    n,
  )
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material'

export default function SessionsTab({ sessions }: { sessions: any[] }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {[
            'Date',
            'Time',
            'Duration',
            'Session Type',
            'Billing Type',
            'Base Rate',
            'Rate Charged',
            'Payment Status',
          ].map((h) => (
            <TableCell key={h}>{h}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {sessions.map((s, i) => (
          <TableRow key={i}>
            <TableCell>{s.date}</TableCell>
            <TableCell>{s.time}</TableCell>
            <TableCell>{s.duration}</TableCell>
            <TableCell>{s.sessionType}</TableCell>
            <TableCell>{s.billingType}</TableCell>
            <TableCell>{formatCurrency(Number(s.baseRate))}</TableCell>
            <TableCell>{formatCurrency(Number(s.rateCharged))}</TableCell>
            <TableCell>{s.paymentStatus}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
