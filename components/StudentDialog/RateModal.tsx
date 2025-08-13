import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material'
import { collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../../lib/firebase'
import { PATHS, logPath } from '../../lib/paths'
import { buildContext, computeBilling } from '../../lib/billing/compute'
import {
  useBillingClient,
  invalidateBilling,
  writeBillingSummary,
} from '../../lib/billing/useBilling'

interface RateModalProps {
  sessionId: string
  abbr: string
  account: string
  open: boolean
  onClose: () => void
  initialRate: string
  onSaved: (v: number) => void
}

export default function RateModal({
  sessionId,
  abbr,
  account,
  open,
  onClose,
  initialRate,
  onSaved,
}: RateModalProps) {
  const [amount, setAmount] = useState(initialRate)
  const qc = useBillingClient()

  useEffect(() => {
    if (open) setAmount(initialRate)
  }, [initialRate, open])

  const save = async () => {
    const ratePath = PATHS.sessionRate(sessionId)
    logPath('sessionRate', ratePath)
    const colRef = collection(db, ratePath)
    const snap = await getDocs(colRef)
    const idx = String(snap.size + 1).padStart(3, '0')
    const today = new Date()
    const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
    const docName = `${sessionId}-RC-${idx}-${yyyyMMdd}`
    await setDoc(doc(colRef, docName), {
      rateCharged: Number(amount) || 0,
      timestamp: Timestamp.fromDate(today),
      editedBy: getAuth().currentUser?.email || 'system',
    })
    onSaved(Number(amount) || 0)
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
        backdrop: { sx: { zIndex: 1600 } },
        paper: { sx: { zIndex: 1601 } },
      }}
    >
      <DialogTitle sx={{ fontFamily: 'Cantata One' }}>Edit Rate Charged</DialogTitle>
      <DialogContent>
        <TextField
          label="Rate Charged"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          fullWidth
          autoFocus
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={async () => {
            await save()
            onClose()
          }}
          disabled={!amount}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

