// components/StudentDialog/SessionsTab.tsx

import React from 'react'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    n,
  )
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material'

export default function SessionsTab({
  sessions,
  lastSession,
  totalSessions,
}: {
  sessions: any[]
  lastSession?: string
  totalSessions?: number
}) {
  return (
    <>
      {(lastSession || totalSessions != null) && (
        <Box mb={2}>
          {lastSession && (
            <>
              <Typography variant="subtitle2">Last Session:</Typography>
              <Typography variant="h6">{lastSession}</Typography>
            </>
          )}
          {totalSessions != null && (
            <>
              <Typography variant="subtitle2">Total Sessions:</Typography>
              <Typography variant="h6">{totalSessions}</Typography>
            </>
          )}
        </Box>
      )}
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
            <TableCell key={h} sx={{ typography: 'subtitle2', fontWeight: 'normal' }}>
              {h}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {sessions.map((s, i) => (
          <TableRow key={i}>
            <TableCell sx={{ typography: 'h6' }}>{s.date}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{s.time}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{s.duration}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{s.sessionType}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{s.billingType}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{formatCurrency(Number(s.baseRate))}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{formatCurrency(Number(s.rateCharged))}</TableCell>
            <TableCell sx={{ typography: 'h6' }}>{s.paymentStatus}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </>
  )
}
