import React from 'react'
import { Box, Typography, Button, IconButton } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CloseIcon from '@mui/icons-material/Close'

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
  onClose?: () => void
  detached?: boolean
}

// SessionDetail shows information for a single session. Editing is intended to
// happen here (rather than inline in the sessions table) but is limited to
// read-only fields for now.
export default function SessionDetail({ session, onBack, onDetach, onClose, detached }: SessionDetailProps) {
  return (
    <Box sx={{ p: 2, width: '100%', height: '100%', position: 'relative' }}>
      <Box sx={{ height: '100%', overflow: 'auto', pb: '56px' }}>
        <Typography variant="h6" gutterBottom>
          Session Detail
        </Typography>
        <Typography>Date: {formatDate(session.date)}</Typography>
        <Typography>Time: {session.time}</Typography>
        <Typography>Duration: {session.duration}</Typography>
        <Typography>
          Base Rate{' '}
          {session.baseRate !== '-' ? formatCurrency(Number(session.baseRate)) : '-'}
        </Typography>
        <Typography>
          Rate Charged{' '}
          {session.rateCharged !== '-' ? formatCurrency(Number(session.rateCharged)) : '-'}
        </Typography>
        <Typography>Payment Status: {session.paymentStatus}</Typography>
      </Box>
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: 1,
          borderColor: 'divider',
          p: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Button variant="text" onClick={onBack} aria-label="back to sessions">
          ← Back
        </Button>
        <Box>
          {!detached && onDetach && (
            <IconButton onClick={onDetach} aria-label="detach session" sx={{ mr: 1 }}>
              <OpenInNewIcon />
            </IconButton>
          )}
          {onClose && (
            <IconButton onClick={onClose} aria-label="close dialog">
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>
    </Box>
  )
}
