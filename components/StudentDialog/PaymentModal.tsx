import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  Typography,
} from '@mui/material'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../../lib/firebase'
import { listBanks, listAccounts, buildBankLabel, BankInfo, AccountInfo } from '../../lib/erlDirectory'
import { buildIdentifier } from '../../lib/payments/format'
import { PATHS, logPath } from '../../lib/paths'
import { useBillingClient, billingKey } from '../../lib/billing/useBilling'
import { writeSummaryFromCache } from '../../lib/liveRefresh'

export default function PaymentModal({
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
  const [amount, setAmount] = useState('')
  const [madeOn, setMadeOn] = useState('')
  const [method, setMethod] = useState('')
  const [entity, setEntity] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountId, setAccountId] = useState('')
  const [banks, setBanks] = useState<BankInfo[]>([])
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [bankError, setBankError] = useState<string | null>(null)
  const [refNumber, setRefNumber] = useState('')
  const qc = useBillingClient()
  const isErl = entity === 'Music Establish (ERL)' || entity === 'ME-ERL'

  useEffect(() => {
    if (isErl && banks.length === 0) {
      listBanks()
        .then((b) => {
          setBanks(b)
          setBankError(null)
        })
        .catch(() => setBankError('Bank directory unavailable (check permissions)'))
    }
  }, [isErl, banks.length])

  useEffect(() => {
    if (bankCode) {
      listAccounts(bankCode)
        .then((a) => setAccounts(a))
        .catch(() => setAccounts([]))
    } else {
      setAccounts([])
    }
    setAccountId('')
  }, [bankCode])

  const save = async () => {
    const paymentsPath = PATHS.payments(abbr)
    logPath('addPayment', paymentsPath)
    const colRef = collection(db, paymentsPath)
    const today = new Date()
    const date = madeOn ? new Date(madeOn) : today
    const data: any = {
      amount: Number(amount) || 0,
      paymentMade: Timestamp.fromDate(date),
      remainingAmount: Number(amount) || 0,
      assignedSessions: [],
      assignedRetainers: [],
      method,
      entity,
      refNumber,
      timestamp: Timestamp.now(),
      editedBy: getAuth().currentUser?.email || 'system',
    }
    if (isErl) {
      const id = buildIdentifier(bankCode, accountId)
      if (id) {
        data.identifier = id
        data.bankCode = bankCode
        data.accountDocId = accountId
      }
    }
    await addDoc(colRef, data)
    qc.setQueryData(billingKey(abbr, account), (prev?: any) => {
      if (!prev) return prev
      return {
        ...prev,
        balanceDue: Math.max(0, (prev.balanceDue || 0) - (Number(amount) || 0)),
      }
    })
    await writeSummaryFromCache(qc, abbr, account)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: { display: 'flex', flexDirection: 'column', height: '100%' },
      }}
    >
      <DialogTitle sx={{ fontFamily: 'Cantata One' }}>Add Payment</DialogTitle>
      <DialogContent sx={{ flex: 1, overflow: 'auto', pb: '64px' }}>
        <TextField
          label="Payment Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          fullWidth
          autoFocus
          sx={{ mt: 1 }}
          InputLabelProps={{
            sx: { fontFamily: 'Newsreader', fontWeight: 200 },
          }}
          inputProps={{ style: { fontFamily: 'Newsreader', fontWeight: 500 } }}
        />
        <TextField
          label="Payment Made On"
          type="date"
          value={madeOn}
          onChange={(e) => setMadeOn(e.target.value)}
          fullWidth
          InputLabelProps={{
            shrink: true,
            sx: { fontFamily: 'Newsreader', fontWeight: 200 },
          }}
          inputProps={{ style: { fontFamily: 'Newsreader', fontWeight: 500 } }}
          sx={{ mt: 2 }}
        />
        <TextField
          label="Payment Method"
          select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          fullWidth
          InputLabelProps={{ sx: { fontFamily: 'Newsreader', fontWeight: 200 } }}
          inputProps={{
            style: { fontFamily: 'Newsreader', fontWeight: 500 },
            'data-testid': 'method-select',
          }}
          sx={{ mt: 2 }}
        >
          {['FPS', 'Bank Transfer', 'Cheque'].map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Entity"
          select
          value={entity}
          onChange={(e) => {
            const val = e.target.value
            setEntity(val)
            if (val !== 'Music Establish (ERL)') {
              setBankCode('')
              setAccountId('')
            }
          }}
          fullWidth
          InputLabelProps={{ sx: { fontFamily: 'Newsreader', fontWeight: 200 } }}
          inputProps={{
            style: { fontFamily: 'Newsreader', fontWeight: 500 },
            'data-testid': 'entity-select',
          }}
          sx={{ mt: 2 }}
        >
          <MenuItem value="Music Establish (ERL)">Music Establish (ERL)</MenuItem>
          <MenuItem value="Personal">Personal</MenuItem>
        </TextField>
        {isErl && (
          <>
            <TextField
              label="Bank"
              select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              fullWidth
              InputLabelProps={{
                sx: { fontFamily: 'Newsreader', fontWeight: 200 },
              }}
              inputProps={{
                style: { fontFamily: 'Newsreader', fontWeight: 500 },
                'data-testid': 'bank-select',
              }}
              sx={{ mt: 2 }}
            >
              {banks.map((b) => (
                <MenuItem key={b.bankCode} value={b.bankCode}>
                  {buildBankLabel(b)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Bank Account"
              select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              fullWidth
              InputLabelProps={{
                sx: { fontFamily: 'Newsreader', fontWeight: 200 },
              }}
              inputProps={{
                style: { fontFamily: 'Newsreader', fontWeight: 500 },
                'data-testid': 'bank-account-select',
              }}
              sx={{ mt: 2 }}
            >
              {accounts.map((a) => (
                <MenuItem key={a.accountDocId} value={a.accountDocId}>
                  {a.accountType}
                </MenuItem>
              ))}
            </TextField>
            {bankError && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                {bankError}
              </Typography>
            )}
          </>
        )}
        <TextField
          label="Reference Number"
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          fullWidth
          InputLabelProps={{ sx: { fontFamily: 'Newsreader', fontWeight: 200 } }}
          inputProps={{
            style: { fontFamily: 'Newsreader', fontWeight: 500 },
            'data-testid': 'ref-input',
          }}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions className="dialog-footer" data-testid="dialog-footer">
        <Button onClick={onClose} data-testid="back-button">
          Back
        </Button>
        <Button
          onClick={async () => {
            await save()
            setAmount('')
            setMadeOn('')
            setMethod('')
            setEntity('')
            setBankCode('')
            setAccountId('')
            setRefNumber('')
            onClose()
          }}
          disabled={!method || !entity || (isErl && (!bankCode || !accountId))}
          data-testid="submit-payment"
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}
