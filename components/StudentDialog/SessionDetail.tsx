import React, { useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import InlineEdit from '../../common/InlineEdit'
import { PATHS, logPath } from '../../lib/paths'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)

const formatDate = (s: string) => {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface SessionDetailProps {
  session: any
  onBack: () => void
}

// SessionDetail shows information for a single session. Limited editing, such
// as rate charged, occurs here rather than inline in the sessions table.
export default function SessionDetail({ session, onBack }: SessionDetailProps) {
  const [voucherUsed, setVoucherUsed] = useState(!!session.voucherUsed)

  const markVoucher = async () => {
    const path = PATHS.sessionVoucher(session.id)
    logPath('sessionVoucher', path)
    const colRef = collection(db, path)
    const snap = await getDocs(colRef)
    const idx = String(snap.size + 1).padStart(3, '0')
    const today = new Date()
    const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
    const docName = `free_${idx}_${yyyyMMdd}`
    await setDoc(doc(colRef, docName), { 'free?': true })
    setVoucherUsed(true)
    session.voucherUsed = true
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 4 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Date:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {formatDate(session.date)}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Time:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {session.time}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Duration:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {session.duration}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Base Rate:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {session.baseRate !== '-' ? formatCurrency(Number(session.baseRate)) : '-'}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Rate Charged:
        </Typography>
        <InlineEdit
          value={
            session.rateCharged !== '-' ? Number(session.rateCharged) : ''
          }
          fieldPath={PATHS.sessionRate(session.id)}
          fieldKey="rateCharged"
          editable={!voucherUsed}
          type="number"
          displayFormatter={(v) =>
            v === '' ? '-' : formatCurrency(Number(v))
          }
          onSaved={(v) => {
            session.rateCharged = v
            logPath('sessionRate', PATHS.sessionRate(session.id))
          }}
        />
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Session Voucher:
        </Typography>
        {voucherUsed ? (
          <Typography
            variant="h6"
            sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          >
            Yes
          </Typography>
        ) : (
          <Button
            variant="outlined"
            onClick={markVoucher}
            disabled={session.rateSpecified}
          >
            Use Session Voucher
          </Button>
        )}
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Payment Status:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {session.paymentStatus}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Pay on:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {session.payOn || '-'}
        </Typography>
      </Box>

      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          p: 1,
          display: 'flex',
          justifyContent: 'flex-start',
          bgcolor: 'background.paper',
        }}
      >
        <Button variant="text" onClick={onBack} aria-label="back to sessions">
          ← Back
        </Button>
      </Box>
    </Box>
  )
}
