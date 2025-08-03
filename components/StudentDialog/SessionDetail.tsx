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
  onDetach?: () => void
  detached?: boolean
}

// SessionDetail shows information for a single session. Editing is intended to
// happen here (rather than inline in the sessions table) but is limited to
// read-only fields for now.
export default function SessionDetail({ session, onBack, onDetach, detached }: SessionDetailProps) {
  return (
    <Box sx={{ p: 2, width: '100%', height: '100%', position: 'relative' }}>
      <Typography variant="h6" gutterBottom>
        Session Detail
      </Typography>
      <Typography>Date: {formatDate(session.date)}</Typography>
      <Typography>Time: {session.time}</Typography>
      <Typography>Duration: {session.duration}</Typography>
      <Typography>
        Base Rate:{' '}
        {session.baseRate !== '-' ? formatCurrency(Number(session.baseRate)) : '-'}
      </Typography>
      <Typography>
        Rate Charged:{' '}
        {session.rateCharged !== '-' ? formatCurrency(Number(session.rateCharged)) : '-'}
      </Typography>
      <Typography>Payment Status: {session.paymentStatus}</Typography>
      {!detached && (
        <Button
          variant="text"
          onClick={onBack}
          aria-label="back to sessions"
          sx={{ position: 'absolute', bottom: 8, left: 8 }}
        >
          ← Back
        </Button>
      )}
      {!detached && onDetach && (
        <Button
          variant="text"
          onClick={onDetach}
          aria-label="detach session"
          sx={{ position: 'absolute', bottom: 8, right: 8 }}
        >
          Detach
        </Button>
      )}
    </Box>
  )
}
