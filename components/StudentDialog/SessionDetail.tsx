import React from 'react'
import { Box, Typography, Button } from '@mui/material'

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
    <Box sx={{ p: 2, width: '100%', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        {!detached && (
          <Button variant="text" onClick={onBack} aria-label="back to sessions">
            ← Back
          </Button>
        )}
        {!detached && onDetach && (
          <Button variant="text" onClick={onDetach} aria-label="detach session">
            Detach
          </Button>
        )}
      </Box>
      <Typography variant="h6" gutterBottom>
        Session Detail
      </Typography>
      <Typography>Date: {session.date}</Typography>
      <Typography>Time: {session.time}</Typography>
      <Typography>Duration: {session.duration}</Typography>
      <Typography>Base Rate: {session.baseRate}</Typography>
      <Typography>Rate Charged: {session.rateCharged}</Typography>
      <Typography>Payment Status: {session.paymentStatus}</Typography>
    </Box>
  )
}
