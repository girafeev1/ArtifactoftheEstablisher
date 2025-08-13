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
import { useBillingClient, billingKey } from '../../lib/billing/useBilling'
import { writeSummaryFromCache } from '../../lib/liveRefresh'

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
    qc.setQueryData(billingKey(abbr, account), (prev?: any) => {
      if (!prev) return prev
      const rows = prev.rows.map((r: any) =>
        r.id === sessionId
          ? {
              ...r,
              amountDue: Number(amount) || 0,
              displayRate: new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: 'HKD',
                currencyDisplay: 'code',
              }).format(Number(amount) || 0),
              flags: { ...r.flags, manualRate: true },
            }
          : r,
      )
      const old = prev.rows.find((r: any) => r.id === sessionId)
      const delta = (Number(amount) || 0) - (old?.amountDue || 0)
      const affectsBalance =
        !!old &&
        !old.flags.cancelled &&
        !old.flags.voucherUsed &&
        !old.flags.inRetainer &&
        !old.assignedPaymentId
      const balanceDue = affectsBalance
        ? Math.max(0, (prev.balanceDue || 0) + delta)
        : prev.balanceDue || 0
      return { ...prev, rows, balanceDue }
    })
    await writeSummaryFromCache(qc, abbr, account)
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

