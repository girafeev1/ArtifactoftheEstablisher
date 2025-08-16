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
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { PATHS, logPath } from '../../lib/paths'
import { useSession } from 'next-auth/react'
import { useBillingClient } from '../../lib/billing/useBilling'
import { writeSummaryFromCache } from '../../lib/liveRefresh'
import dayjs from 'dayjs'
import utc from 'dayjs-plugin-utc'
import timezone from 'dayjs-plugin-timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Hong_Kong')

export default function BaseRateHistoryDialog({
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
  const [addOpen, setAddOpen] = useState(false)
  const [newRate, setNewRate] = useState('')
  const [newDate, setNewDate] = useState(dayjs().tz().format('YYYY-MM-DD'))
  const [editing, setEditing] = useState<string | null>(null)
  const { data: session } = useSession()
  const qc = useBillingClient()
  const formatDate = (v: any) => {
    if (!v) return 'N/A'
    try {
      const d = v.toDate ? v.toDate() : new Date(v)
      return isNaN(d.getTime())
        ? 'N/A'
        : d.toLocaleDateString(undefined, {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          })
    } catch {
      return 'N/A'
    }
  }

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
    const eff = dayjs
      .tz(newDate, 'Asia/Hong_Kong')
      .startOf('day')
      .toDate()
    await addDoc(collection(db, path), {
      rate: Number(newRate) || 0,
      timestamp: Timestamp.fromDate(new Date()),
      effectDate: Timestamp.fromDate(eff),
      editedBy: session?.user?.email || 'unknown',
    })
    setNewRate('')
    setNewDate(dayjs().tz().format('YYYY-MM-DD'))
    setAddOpen(false)
    await writeSummaryFromCache(qc, abbr, account)
  }

  const saveEffectDate = async (id: string, date: string) => {
    const eff = dayjs
      .tz(date, 'Asia/Hong_Kong')
      .startOf('day')
      .toDate()
    const ref = doc(db, PATHS.baseRateHistory(abbr), id)
    await updateDoc(ref, {
      effectDate: Timestamp.fromDate(eff),
      editedBy: session?.user?.email || 'unknown',
    })
    setEditing(null)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontFamily: 'Cantata One' }}>Base Rate History</DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>Rate</TableCell>
              <TableCell sx={{ fontFamily: 'Cantata One', fontWeight: 'bold' }}>Effective Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} title={r.editedBy || 'unknown'}>
                <TableCell
                  sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                  title={r.editedBy || 'unknown'}
                >
                  {r.rate}
                </TableCell>
                <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {r.effectDate ? (
                    formatDate(r.effectDate)
                  ) : editing === r.id ? (
                    <TextField
                      type="date"
                      size="small"
                      defaultValue={dayjs().tz().format('YYYY-MM-DD')}
                      onBlur={(e) => saveEffectDate(r.id, e.target.value)}
                      inputProps={{ style: { fontFamily: 'Newsreader', fontWeight: 500 } }}
                    />
                  ) : (
                    <span
                      className="blink-amount--warn"
                      role="button"
                      tabIndex={0}
                      onClick={() => setEditing(r.id)}
                    >
                      –
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  No history.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={() => setAddOpen(true)}>Add</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
        <DialogTitle sx={{ fontFamily: 'Cantata One' }}>Add Base Rate</DialogTitle>
        <DialogContent>
          <TextField
            label="New Rate"
            type="number"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            fullWidth
            sx={{ my: 1 }}
            InputLabelProps={{ sx: { fontFamily: 'Newsreader', fontWeight: 200 } }}
            inputProps={{ style: { fontFamily: 'Newsreader', fontWeight: 500 } }}
          />
          <TextField
            label="Effective Date"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            fullWidth
            sx={{ my: 1 }}
            InputLabelProps={{ sx: { fontFamily: 'Newsreader', fontWeight: 200 } }}
            inputProps={{ style: { fontFamily: 'Newsreader', fontWeight: 500 } }}
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button onClick={add} disabled={!newRate}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}
