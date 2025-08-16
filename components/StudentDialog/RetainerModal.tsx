import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from '@mui/material'
import { addRetainer, calculateEndDate, RetainerDoc } from '../../lib/retainer'
import { useBillingClient } from '../../lib/billing/useBilling'
import { writeSummaryFromCache, markSessionsInRetainer } from '../../lib/liveRefresh'

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
  account,
  balanceDue,
  retainer,
  nextStart,
  open,
  onClose,
}: {
  abbr: string
  account: string
  balanceDue: number
  retainer?: RetainerDoc & { id: string }
  nextStart?: Date
  open: boolean
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
  const qc = useBillingClient()

  const startDate = start ? new Date(start) : null
  const endDate = startDate ? calculateEndDate(startDate) : null

  const handleSave = async () => {
    if (!startDate || !rate) return
      const numRate = Number(rate)
      setError('')
      setSaving(true)
      try {
        await addRetainer(abbr, startDate, numRate)
      const startMs = startDate.getTime()
      const endMs = endDate ? endDate.getTime() : startMs
      markSessionsInRetainer(qc, abbr, account, startMs, endMs, true)
      await writeSummaryFromCache(qc, abbr, account)
      onClose(true)
    } catch (e: any) {
      setError(String(e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontFamily: 'Cantata One' }}>
        {retainer ? 'Edit Retainer' : 'Add Retainer'}
      </DialogTitle>
      <DialogContent>
        {/* TODO: replace TextField type="date" with MUI DatePicker + shouldDisableDate to gray out overlapping ranges. */}
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
          InputLabelProps={{
            shrink: true,
            sx: { fontFamily: 'Newsreader', fontWeight: 200 },
          }}
          inputProps={{ style: { fontFamily: 'Newsreader', fontWeight: 500 } }}
          helperText={`Balance Due: ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD', currencyDisplay: 'code' }).format(balanceDue)} (retainers can be added even if balance is insufficient)`}
          FormHelperTextProps={{ sx: { fontFamily: 'Newsreader', fontWeight: 500 } }}
        />
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
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
      </DialogActions>
    </Dialog>
  )
}

