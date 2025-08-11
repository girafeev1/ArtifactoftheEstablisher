import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../../lib/firebase'
import { PATHS, logPath } from '../../lib/paths'

export default function PaymentModal({
  abbr,
  open,
  onClose,
}: {
  abbr: string
  open: boolean
  onClose: () => void
}) {
  const [amount, setAmount] = useState('')
  const [madeOn, setMadeOn] = useState('')

  const save = async () => {
    const paymentsPath = PATHS.payments(abbr)
    logPath('addPayment', paymentsPath)
    const colRef = collection(db, paymentsPath)
    const today = new Date()
    const date = madeOn ? new Date(madeOn) : today
    await addDoc(colRef, {
      amount: Number(amount) || 0,
      paymentMade: Timestamp.fromDate(date),
      remainingAmount: Number(amount) || 0,
      assignedSessions: [],
      assignedRetainers: [],
      timestamp: Timestamp.fromDate(today),
      editedBy: getAuth().currentUser?.email || 'system',
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontFamily: 'Cantata One' }}>Add Payment</DialogTitle>
      <DialogContent>
        <TextField
          label="Payment Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          fullWidth
          autoFocus
          sx={{ mt: 1 }}
        />
        <TextField
          label="Payment Made On"
          type="date"
          value={madeOn}
          onChange={(e) => setMadeOn(e.target.value)}
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
            setAmount('')
            setMadeOn('')
            onClose()
          }}
          disabled={!amount || !madeOn}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
