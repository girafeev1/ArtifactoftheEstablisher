import React, { useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { PATHS, logPath } from '../../lib/paths'
import RateModal from './RateModal'
import { collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../../lib/firebase'
import { buildContext, computeBilling } from '../../lib/billing/compute'
import {
  useBillingClient,
  invalidateBilling,
  writeBillingSummary,
} from '../../lib/billing/useBilling'

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
  abbr: string
  account: string
  session: any
  onBack: () => void
}

// SessionDetail shows information for a single session. Limited editing, such
// as rate charged, occurs here rather than inline in the sessions table.
export default function SessionDetail({
  abbr,
  account,
  session,
  onBack,
}: SessionDetailProps) {
  const [voucherUsed, setVoucherUsed] = useState(!!session.voucherUsed)
  const [rateOpen, setRateOpen] = useState(false)
  const qc = useBillingClient()

  const createVoucherEntry = async (free: boolean) => {
    const path = PATHS.sessionVoucher(session.id)
    logPath('sessionVoucher', path)
    const colRef = collection(db, path)
    const snap = await getDocs(colRef)
    const idx = String(snap.size + 1).padStart(3, '0')
    const today = new Date()
    const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
    const docName = `free_${idx}_${yyyyMMdd}`
    const editedBy = getAuth().currentUser?.email || 'system'
    await setDoc(doc(colRef, docName), {
      'free?': free,
      timestamp: Timestamp.now(),
      editedBy,
    })
    setVoucherUsed(free)
    session.voucherUsed = free
    await invalidateBilling(abbr, account, qc)
    const res = computeBilling(await buildContext(abbr, account))
    await writeBillingSummary(abbr, res)
  }

  const markVoucher = async () => {
    await createVoucherEntry(true)
  }

  const unmarkVoucher = async () => {
    if (!window.confirm('Mark session as paid instead?')) return
    await createVoucherEntry(false)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 4 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          iCal ID:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {session.id}
        </Typography>
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
        <Typography
          variant="h6"
          sx={{
            fontFamily: 'Newsreader',
            fontWeight: 500,
            cursor: voucherUsed ? 'default' : 'pointer',
          }}
          onClick={() => {
            if (!voucherUsed) setRateOpen(true)
          }}
        >
          {session.rateCharged !== '-' ?
            formatCurrency(Number(session.rateCharged)) :
            '-'}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          Session Voucher:
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
        >
          {voucherUsed ? 'Yes' : 'No'}
        </Typography>
        {voucherUsed ? (
          <Button variant="outlined" onClick={unmarkVoucher} sx={{ mt: 1 }}>
            Remove Session Voucher
          </Button>
        ) : (
          <Button
            variant="outlined"
            onClick={markVoucher}
            disabled={session.rateSpecified}
            sx={{ mt: 1 }}
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
        <RateModal
          sessionId={session.id}
          abbr={abbr}
          account={account}
          open={rateOpen}
          onClose={() => setRateOpen(false)}
          initialRate={
            session.rateCharged !== '-' ? String(session.rateCharged) : ''
          }
          onSaved={(v) => {
            session.rateCharged = v
            session.rateSpecified = true
          }}
        />
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
