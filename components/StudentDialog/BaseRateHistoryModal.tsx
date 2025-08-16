import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
} from '@mui/material'
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { PATHS, logPath } from '../../lib/paths'
import { useSession } from 'next-auth/react'
import { useBillingClient } from '../../lib/billing/useBilling'
import { writeSummaryFromCache } from '../../lib/liveRefresh'

export default function BaseRateHistoryModal({
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
  const [rows, setRows] = useState<any[]>([])
  const [rate, setRate] = useState('')
  const { data: session } = useSession()
  const qc = useBillingClient()

  useEffect(() => {
    if (!open) return
    const path = PATHS.baseRateHistory(abbr)
    logPath('baseRateHistory', path)
    const q = query(collection(db, path), orderBy('timestamp', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    })
    return () => unsub()
  }, [abbr, open])

  const add = async () => {
    const path = PATHS.baseRateHistory(abbr)
    await addDoc(collection(db, path), {
      rate: Number(rate) || 0,
      timestamp: Timestamp.fromDate(new Date()),
      editedBy: session?.user?.email || 'unknown',
    })
    setRate('')
    await writeSummaryFromCache(qc, abbr, account)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontFamily: 'Cantata One' }}>Base Rate History</DialogTitle>
      <DialogContent>
        <TextField
          label="New Rate"
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          fullWidth
          sx={{ my: 1 }}
        />
        <Button onClick={add} variant="contained" disabled={!rate} sx={{ mb: 2 }}>
          Add
        </Button>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>Rate</TableCell>
              <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>Timestamp</TableCell>
              <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>Edited By</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {r.rate}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {r.timestamp?.toDate
                    ? r.timestamp.toDate().toLocaleString()
                    : ''}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {r.editedBy || 'unknown'}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                >
                  No history.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
