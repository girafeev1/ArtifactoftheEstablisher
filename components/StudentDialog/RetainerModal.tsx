import React, { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { addRetainer, calculateEndDate, RetainerDoc } from '../../lib/retainer'

const formatDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
    : '-'

export default function RetainerModal({
  abbr,
  balanceDue,
  retainer,
  nextStart,
  onClose,
}: {
  abbr: string
  balanceDue: number
  retainer?: RetainerDoc & { id: string }
  nextStart?: Date
  onClose: (saved: boolean) => void
}) {
  const [start, setStart] = useState<string>(() => {
    if (retainer) return retainer.retainerStarts.toDate().toISOString().slice(0, 10)
    if (nextStart) {
      const d = new Date(nextStart)
      d.setDate(d.getDate() + 1)
      return d.toISOString().slice(0, 10)
    }
    return ''
  })
  const [rate, setRate] = useState<string>(() =>
    retainer ? String(retainer.retainerRate) : '',
  )
  const [error, setError] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const startDate = start ? new Date(start) : null
  const endDate = startDate ? calculateEndDate(startDate) : null

  const handleSave = async () => {
    if (!startDate || !rate) return
    const numRate = Number(rate)
    if (numRate > balanceDue) {
      setError(
        'Insufficient balance to add retainer. Please record a payment first.',
      )
      return
    }
    setError('')
    setSaving(true)
    try {
      await addRetainer(abbr, startDate, numRate)
      onClose(true)
    } catch (e: any) {
      setError(String(e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          p: 4,
          width: 360,
          maxWidth: '90%',
          textAlign: 'left',
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Cantata One', mb: 2 }}
        >
          {retainer ? 'Edit Retainer' : 'Add Retainer'}
        </Typography>
        <TextField
          type="date"
          label="Start Date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          InputLabelProps={{ shrink: true, sx: { fontFamily: 'Newsreader', fontWeight: 200 } }}
          inputProps={{ style: { fontFamily: 'Newsreader', fontWeight: 500 } }}
        />
        <TextField
          label="End Date"
          value={formatDate(endDate)}
          fullWidth
          sx={{ mb: 2 }}
          InputProps={{ readOnly: true, sx: { fontFamily: 'Newsreader', fontWeight: 500 } }}
          InputLabelProps={{ shrink: true, sx: { fontFamily: 'Newsreader', fontWeight: 200 } }}
        />
        <TextField
          label="Rate"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          type="number"
          fullWidth
          sx={{ mb: 1 }}
          InputLabelProps={{ shrink: true, sx: { fontFamily: 'Newsreader', fontWeight: 200 } }}
          inputProps={{ style: { fontFamily: 'Newsreader', fontWeight: 500 } }}
        />
        <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500, mb: 2 }}>
          Balance Due: {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD' }).format(balanceDue)}
        </Typography>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => onClose(false)} disabled={saving}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !start || !rate}
          >
            Save
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

