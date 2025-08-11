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

export default function VoucherModal({
  abbr,
  open,
  onClose,
}: {
  abbr: string
  open: boolean
  onClose: () => void
}) {
  const [token, setToken] = useState('')

  const save = async () => {
    const path = PATHS.freeMeal(abbr)
    logPath('freeMeal', path)
    const colRef = collection(db, path)
    const snap = await getDocs(colRef)
    const idx = String(snap.size + 1).padStart(3, '0')
    const today = new Date()
    const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
    const docName = `${abbr}-FM-${idx}-${yyyyMMdd}`
    await setDoc(doc(colRef, docName), {
      Token: Number(token) || 0,
      timestamp: today,
      EditedBy: 'system',
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={async () => {
            await save()
            onClose()
          }}
          disabled={!token}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
