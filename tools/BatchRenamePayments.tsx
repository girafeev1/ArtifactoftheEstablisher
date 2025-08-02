import React, { useState } from 'react'
import {
  collection,
  getDocs,
  writeBatch,
  deleteField,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material'

interface Summary {
  processed: number
  updated: number
  skipped: number
  failed: number
}

export default function BatchRenamePayments({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [logs, setLogs] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)

  const append = (msg: string) => {
    setLogs((l) => [...l, msg])
  }

  const run = async () => {
    if (!window.confirm('Rename timestamp to paymentMade for all payments?'))
      return
    setRunning(true)
    setLogs([])
    setSummary(null)
    let processed = 0
    let updated = 0
    let skipped = 0
    let failed = 0
    try {
      const studSnap = await getDocs(collection(db, 'Students'))
      append(`Found ${studSnap.size} students`)
      for (const stud of studSnap.docs) {
        const abbr = stud.id
        append(`Student ${abbr}`)
        const paySnap = await getDocs(collection(db, 'Students', abbr, 'Payments'))
        let batch = writeBatch(db)
        let ops = 0
        for (const p of paySnap.docs) {
          processed++
          const data = p.data() as any
          if ('paymentMade' in data) {
            skipped++
            append(`  ${p.id} already renamed`)
            continue
          }
          if (!('timestamp' in data)) {
            skipped++
            append(`  ${p.id} missing timestamp`)
            continue
          }
          try {
            batch.update(p.ref, {
              paymentMade: data.timestamp,
              timestamp: deleteField(),
            })
            ops++
            updated++
            append(`  ${p.id} updated`)
            if (ops >= 400) {
              await batch.commit()
              batch = writeBatch(db)
              ops = 0
            }
          } catch (err) {
            console.error(err)
            failed++
            append(`  ${p.id} failed: ${err}`)
          }
        }
        if (ops > 0) await batch.commit()
      }
    } catch (err) {
      console.error(err)
      append(`Error: ${err}`)
    }
    append(`Finished. Updated ${updated}, skipped ${skipped}, failed ${failed}.`)
    setSummary({ processed, updated, skipped, failed })
    setRunning(false)
  }

  return (
    <Dialog open={open} onClose={running ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Batch Rename Payments</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ mb: 2 }}>
          Batch process all students&apos; payment documents, renaming
          <code>timestamp</code> to <code>paymentMade</code>.
        </Typography>
        <Button variant="contained" onClick={run} disabled={running} sx={{ mb: 2 }}>
          {running ? 'Running...' : 'Start'}
        </Button>
        <pre style={{ maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {logs.join('\n')}
        </pre>
        {summary && (
          <Typography sx={{ mt: 2 }}>
            Processed {summary.processed} docs, updated {summary.updated}, skipped{' '}
            {summary.skipped}, failed {summary.failed}.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={running}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
