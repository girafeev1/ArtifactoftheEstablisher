import React from 'react'
import { Box, Typography, Button } from '@mui/material'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD' }).format(n)

const formatDate = (s: string) => {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface SessionDetailProps {
  session: any
  onBack: () => void
}

// SessionDetail shows information for a single session. Editing is intended to
// happen here (rather than inline in the sessions table) but is limited to
// read-only fields for now.
export default function SessionDetail({ session, onBack }: SessionDetailProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Typography>Date: {formatDate(session.date)}</Typography>
        <Typography>Time: {session.time}</Typography>
        <Typography>Duration: {session.duration}</Typography>
        <Typography>
          Base Rate {session.baseRate !== '-' ? formatCurrency(Number(session.baseRate)) : '-'}
        </Typography>
        <Typography>
          Rate Charged {session.rateCharged !== '-' ? formatCurrency(Number(session.rateCharged)) : '-'}
        </Typography>
        <Typography>Payment Status: {session.paymentStatus}</Typography>
      </Box>

      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          p: 1,
          display: 'flex',
          justifyContent: 'flex-start',
          bgcolor: 'background.paper',
        }}
      >
        <Button variant="text" onClick={onBack} aria-label="back to sessions">
          ← Back
        </Button>
      </Box>
    </Box>
  )
}
