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
  Grid,
} from '@mui/material'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../../lib/firebase'
import {
  listBanks,
  listAccounts,
  buildBankLabel,
  BankInfo,
  AccountInfo,
} from '../../lib/erlDirectory'
import { normalizeIdentifier } from '../../lib/payments/format'
import { PATHS, logPath } from '../../lib/paths'
import { useBillingClient, billingKey } from '../../lib/billing/useBilling'
import { writeSummaryFromCache } from '../../lib/liveRefresh'
import { useSnackbar } from 'notistack'

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
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null)
  const [accountId, setAccountId] = useState('')
  const [banks, setBanks] = useState<BankInfo[]>([])
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [bankError, setBankError] = useState<string | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [refNumber, setRefNumber] = useState('')
  const qc = useBillingClient()
  const isErl = entity === 'Music Establish (ERL)'
  const { enqueueSnackbar } = useSnackbar()
  const bankMsg =
    'Bank directory unavailable (check rules on the erl-directory database).'

  useEffect(() => {
    if (!isErl) {
      setBankCode('')
      setSelectedBank(null)
      setAccountId('')
      setBankError(null)
      setIdentifier('')
    }
  }, [isErl])

  useEffect(() => {
    if (isErl && banks.length === 0) {
      listBanks()
        .then((b) => {
          setBanks(b)
          if (b.length === 0) {
            setBankError(bankMsg)
            enqueueSnackbar(bankMsg, { variant: 'error' })
          } else {
            setBankError(null)
          }
        })
        .catch(() => {
          setBankError(bankMsg)
          enqueueSnackbar(bankMsg, { variant: 'error' })
        })
    }
  }, [isErl, banks.length])

  useEffect(() => {
    if (selectedBank) {
      listAccounts(selectedBank)
        .then((a) => setAccounts(a))
        .catch(() => setAccounts([]))
      setBankCode(selectedBank.bankCode)
    } else {
      setAccounts([])
    }
    setAccountId('')
  }, [selectedBank])

  useEffect(() => {
    if (accountId && process.env.NODE_ENV !== 'production') {
      console.debug('[add-payment] account selected', accountId)
    }
  }, [accountId])

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
      const id = normalizeIdentifier(entity, bankCode, accountId, identifier)
      if (id) data.identifier = id
      data.bankCode = bankCode
      data.accountDocId = accountId
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
              setIdentifier('')
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
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Bank"
                  select
                  value={selectedBank ? selectedBank.bankCode : ''}
                  onChange={(e) => {
                    const b = banks.find((bk) => bk.bankCode === e.target.value)
                    setSelectedBank(b || null)
                  }}
                  fullWidth
                  InputLabelProps={{
                    sx: { fontFamily: 'Newsreader', fontWeight: 200 },
                  }}
                  inputProps={{
                    style: { fontFamily: 'Newsreader', fontWeight: 500 },
                    'data-testid': 'bank-select',
                  }}
                >
                  {banks.map((b) => (
                    <MenuItem key={`${b.bankName}-${b.bankCode}`} value={b.bankCode}>
                      {buildBankLabel(b)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
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
                >
                  {accounts.map((a) => (
                    <MenuItem key={a.accountDocId} value={a.accountDocId}>
                      {a.accountType}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
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
            setSelectedBank(null)
            setAccountId('')
            setIdentifier('')
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
