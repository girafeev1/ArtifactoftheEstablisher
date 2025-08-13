import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { PATHS, logPath } from '../../lib/paths'
import { buildContext, computeBilling } from '../../lib/billing/compute'
import {
  useBillingClient,
  invalidateBilling,
  writeBillingSummary,
} from '../../lib/billing/useBilling'

export default function VoucherModal({
  abbr,
  account,
  open,
  onClose,
}: {
  abbr: string
  account: string
  open: boolean
  onClose: () => void
}) {
  const [token, setToken] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const qc = useBillingClient()

  const save = async () => {
    const path = PATHS.freeMeal(abbr)
    logPath('freeMeal', path)
    const colRef = collection(db, path)
    const snap = await getDocs(colRef)
    const idx = String(snap.size + 1).padStart(3, '0')
    const today = new Date()
    const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
    const docName = `${abbr}-FM-${idx}-${yyyyMMdd}`
    const eff = effectiveDate ? new Date(effectiveDate) : today
    await setDoc(doc(colRef, docName), {
      Token: Number(token) || 0,
      timestamp: today,
      effectiveDate: eff,
      EditedBy: 'system',
    })
    await invalidateBilling(abbr, account, qc)
    const res = computeBilling(await buildContext(abbr, account))
    await writeBillingSummary(abbr, res)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        root: { sx: { zIndex: 1600 } },
        backdrop: { sx: { zIndex: 1600 } },
        paper: { sx: { zIndex: 1601 } },
      }}
    >
      <DialogTitle sx={{ fontFamily: 'Cantata One' }}>
        Add Session Voucher
      </DialogTitle>
      <DialogContent>
        <TextField
          label="Token"
          type="number"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          fullWidth
          autoFocus
          sx={{ mt: 1 }}
        />
        <TextField
          label="Effective Date"
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          fullWidth
          InputLabelProps={{ shrink: true }}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={async () => {
            await save()
            setToken('')
            setEffectiveDate('')
            onClose()
          }}
          disabled={!token || !effectiveDate}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
