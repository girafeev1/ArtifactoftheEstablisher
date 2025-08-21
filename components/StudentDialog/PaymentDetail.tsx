import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
  CircularProgress,
  TextField,
  MenuItem,
} from '@mui/material'
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  Timestamp,
  deleteField,
  getDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { formatMMMDDYYYY } from '../../lib/date'
import { titleFor } from './title'
import { PATHS, logPath } from '../../lib/paths'
import { useBillingClient, useBilling } from '../../lib/billing/useBilling'
import { minUnpaidRate } from '../../lib/billing/minUnpaidRate'
import { paymentBlinkClass } from '../../lib/billing/paymentBlink'
import { formatSessions } from '../../lib/billing/formatSessions'
import { truncateList } from '../../lib/payments/truncate'
import {
  patchBillingAssignedSessions,
  writeSummaryFromCache,
  payRetainerPatch,
  upsertUnpaidRetainerRow,
} from '../../lib/liveRefresh'
import { useSession } from 'next-auth/react'
import { useColumnWidths } from '../../lib/useColumnWidths'
import {
  listBanks,
  listAccounts,
  buildBankLabel,
  BankInfo,
  AccountInfo,
  lookupAccount,
} from '../../lib/erlDirectory'
import { useSnackbar } from 'notistack'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)


export default function PaymentDetail({
  abbr,
  account,
  payment,
  onBack,
  onTitleChange,
}: {
  abbr: string
  account: string
  payment: any
  onBack: () => void
  onTitleChange?: (title: string | null) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const amount = Number(payment.amount) || 0
  const applied = Number(payment.appliedAmount ?? 0)
  const initialRemaining = Number(
    payment.remainingAmount ?? (amount - applied),
  )
  const [remaining, setRemaining] = useState<number>(initialRemaining)
  const [assignedSessionIds, setAssignedSessionIds] = useState<string[]>(
    payment.assignedSessions || [],
  )
  const [assignedRetainerIds, setAssignedRetainerIds] = useState<string[]>(
    payment.assignedRetainers || [],
  )
  const [sortField, setSortField] = useState<'ordinal' | 'date' | 'time' | 'rate'>(
    'ordinal',
  )
  const [sortAsc, setSortAsc] = useState(true)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [methodVal, setMethodVal] = useState(payment.method || '')
  const [entityVal, setEntityVal] = useState(payment.entity || '')
  const [refVal, setRefVal] = useState(payment.refNumber || '')
  const [bankCodeVal, setBankCodeVal] = useState(payment.bankCode || '')
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null)
  const [accountIdVal, setAccountIdVal] = useState(payment.accountDocId || '')
  const [banks, setBanks] = useState<BankInfo[]>([])
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [studentName, setStudentName] = useState<{ first: string; last: string }>({
    first: '',
    last: '',
  })
  const [acctInfo, setAcctInfo] = useState<
    | {
        bankName: string
        bankCode: string
        accountType?: string
        accountNumber?: string
      }
    | null
  >(null)
  const qc = useBillingClient()
  const { data: bill } = useBilling(abbr, account)
  const [retainers, setRetainers] = useState<any[]>([])
  const { data: session } = useSession()
  const userEmail = session?.user?.email || 'anon'
  const columns = [
    { key: 'ordinal', width: 80 },
    { key: 'date', width: 110 },
    { key: 'time', width: 100 },
    { key: 'rate', width: 130 },
  ] as const
  const { widths, startResize, dblClickResize, keyResize } = useColumnWidths(
    'paymentDetail',
    columns,
    userEmail,
  )
  const tableRef = React.useRef<HTMLTableElement>(null)
  const minDue = React.useMemo(() => minUnpaidRate(bill?.rows || []), [bill])
  const isErl =
    entityVal === 'Music Establish (ERL)' || entityVal === 'ME-ERL'
  const bankMsg =
    'Bank directory unavailable (check rules on the erl-directory database).'
  const [bankError, setBankError] = useState<string | null>(null)
  const { enqueueSnackbar } = useSnackbar()
  useEffect(() => {
    if (isErl && banks.length === 0) {
      listBanks()
        .then((b) => {
          setBanks(b)
          const match = b.find((bk) => bk.bankCode === bankCodeVal)
          if (match) setSelectedBank(match)
          if (b.length === 0) {
            setBankError(bankMsg)
            enqueueSnackbar(bankMsg, { variant: 'error' })
          } else {
            setBankError(null)
          }
        })
        .catch(() => {
          setBanks([])
          setBankError(bankMsg)
          enqueueSnackbar(bankMsg, { variant: 'error' })
        })
    }
  }, [isErl, banks.length, bankCodeVal])
  useEffect(() => {
    if (!isErl) {
      setBankCodeVal('')
      setSelectedBank(null)
      setAccountIdVal('')
      setBankError(null)
    }
  }, [isErl])
  useEffect(() => {
    if (isErl && selectedBank) {
      listAccounts(selectedBank)
        .then((a) => setAccounts(a))
        .catch(() => setAccounts([]))
      setBankCodeVal(selectedBank.bankCode)
    } else {
      setAccounts([])
      setAccountIdVal('')
    }
  }, [isErl, selectedBank])
  useEffect(() => {
    getDoc(doc(db, PATHS.student(abbr)))
      .then((snap) => {
        const data = snap.data() as any
        setStudentName({ first: data?.firstName || '', last: data?.lastName || '' })
      })
      .catch(() => setStudentName({ first: '', last: '' }))
  }, [abbr])

  useEffect(() => {
    if (!payment.identifier) {
      setAcctInfo(null)
      return
    }
    lookupAccount(payment.identifier)
      .then((info) => setAcctInfo(info))
      .catch(() => setAcctInfo(null))
  }, [payment.identifier])

  const assignedSet = new Set(assignedSessionIds)
  const allRows = bill
    ? bill.rows.map((r: any, i: number) => ({ ...r, ordinal: i + 1 }))
    : []
  const sessionRows = allRows
    .filter(
      (r) => !r.flags.cancelled && !r.flags.voucherUsed && !r.flags.inRetainer,
    )
    .map((r) => ({
      id: r.id,
      startMs: r.startMs,
      date: r.date,
      time: r.time,
      rate: r.amountDue,
      rateDisplay: r.displayRate,
      assignedPaymentId: r.assignedPaymentId,
      ordinal: r.ordinal,
    }))
    .sort((a, b) => a.startMs - b.startMs)
  const assignedSessions = sessionRows.filter((r) => assignedSet.has(r.id))
  const availableSessions = sessionRows.filter(
    (r) => !assignedSet.has(r.id) && !r.assignedPaymentId,
  )
  const retRows = retainers.map((r: any, i: number) => ({
    id: `retainer:${r.retainerId}`,
    retainerId: r.retainerId,
    startMs: r.startMs,
    date: (() => {
      const d = new Date(r.startMs)
      if (d.getDate() >= 21) d.setMonth(d.getMonth() + 1)
      return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    })(),
    time: '',
    rate: r.rate,
    rateDisplay: formatCurrency(r.rate),
    paymentId: r.paymentId,
    ordinal: sessionRows.length + i + 1,
  }))
  const assignedRetainers = retRows.filter((r: any) => r.paymentId === payment.id)
  const availableRetainers = retRows.filter((r: any) => !r.paymentId)
  const assigned = [...assignedSessions, ...assignedRetainers]
  const available = [...availableSessions, ...availableRetainers]
  const sessionOrds = assignedSessions
    .map((r) => r.ordinal)
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b)

  const sortRows = (rows: any[]) => {
    const val = (r: any) => {
      switch (sortField) {
        case 'ordinal':
          return r.ordinal || 0
        case 'date':
        case 'time':
          return r.startMs || 0
        case 'rate':
          return Number(r.rate) || 0
        default:
          return 0
      }
    }
    return [...rows].sort((a, b) =>
      sortAsc ? val(a) - val(b) : val(b) - val(a),
    )
  }

  const [metaComplete, setMetaComplete] = useState(!!payment.identifier)
  const needsCascade = !metaComplete

  const needsMeta = needsCascade || !payment.refNumber

  useEffect(() => {
    setMetaComplete(!!payment.identifier)
    setMethodVal(payment.method || '')
    setEntityVal(payment.entity || '')
    setBankCodeVal(payment.bankCode || '')
    setAccountIdVal(payment.accountDocId || '')
    setRefVal(payment.refNumber || '')
  }, [payment])

  const saveMetaDetails = async () => {
    const patch: any = {
      method: methodVal,
      refNumber: refVal,
      timestamp: Timestamp.now(),
      editedBy: userEmail,
      entity: deleteField(),
      bankCode: deleteField(),
      accountDocId: deleteField(),
    }
    if (isErl) {
      if (!accountIdVal) return
      patch.identifier = accountIdVal
    } else if (payment.identifier) {
      patch.identifier = deleteField()
    }
    await updateDoc(doc(db, PATHS.payments(abbr), payment.id), patch)
    Object.assign(payment, {
      method: methodVal,
      refNumber: refVal,
      identifier: isErl ? accountIdVal : undefined,
    })
    delete payment.bankCode
    delete payment.accountDocId
    delete payment.entity
    if (!isErl) delete payment.identifier
    await writeSummaryFromCache(qc, abbr, account)
    setMetaComplete(true)
  }

  useEffect(() => {
    const d = payment.paymentMade?.toDate
      ? payment.paymentMade.toDate()
      : new Date(payment.paymentMade)
    const label = isNaN(d.getTime()) ? '-' : formatMMMDDYYYY(d)
    onTitleChange?.(titleFor('billing', 'payment-history', account, label))
    return () => onTitleChange?.(null)
  }, [account, payment.paymentMade, onTitleChange])

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, PATHS.payments(abbr), payment.id),
      (snap) => {
        const data = snap.data()
        if (data) {
          const amt = Number(data.amount) || 0
          const appliedAmt = Number(data.appliedAmount ?? 0)
          setRemaining(
            Number(data.remainingAmount ?? (amt - appliedAmt)),
          )
          setAssignedSessionIds(data.assignedSessions || [])
          setAssignedRetainerIds(data.assignedRetainers || [])
        }
      },
    )
    return () => unsub()
  }, [abbr, payment.id])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, PATHS.retainers(abbr)),
      (snap) => {
        const list: any[] = []
        snap.forEach((d) => {
          const r = d.data() as any
          const start = r.retainerStarts?.toDate
            ? r.retainerStarts.toDate()
            : new Date(r.retainerStarts)
          const end = r.retainerEnds?.toDate
            ? r.retainerEnds.toDate()
            : new Date(r.retainerEnds)
          const rate = Number(r.retainerRate) || 0
          const paymentId = r.paymentId || null
          const startMs = start.getTime()
          list.push({
            id: `retainer:${d.id}`,
            retainerId: d.id,
            startMs,
            rate,
            paymentId,
          })
          upsertUnpaidRetainerRow(
            qc,
            abbr,
            account,
            d.id,
            startMs,
            end.getTime(),
            rate,
            !paymentId,
          )
        })
        setRetainers(list)
      },
    )
    return () => unsub()
  }, [abbr, account, qc])


  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const totalSelected = selected.reduce((sum, id) => {
    const rate = available.find((s) => s.id === id)?.rate || 0
    return sum + rate
  }, 0)
  const pendingRemaining = Math.max(0, remaining - totalSelected)
  const remainingClass = paymentBlinkClass(pendingRemaining, minDue)

  const handleAssign = async () => {
    if (totalSelected > remaining) return
    setAssigning(true)
    try {
      const sessionIds = selected.filter((id) => !id.startsWith('retainer:'))
      const retainerIds = selected
        .filter((id) => id.startsWith('retainer:'))
        .map((id) => id.replace('retainer:', ''))

      for (const id of sessionIds) {
        const session = available.find((s) => s.id === id)
        const rate = session?.rate || 0
        const sessionPayPath = PATHS.sessionPayment(id)
        logPath('assignPayment', `${sessionPayPath}/${payment.id}`)
        await setDoc(doc(db, sessionPayPath, payment.id), {
          amount: rate,
          paymentId: payment.id,
          paymentMade: payment.paymentMade,
        })
      }

      for (const rid of retainerIds) {
        const retPath = PATHS.retainers(abbr)
        logPath('retainerPay', `${retPath}/${rid}`)
        await updateDoc(doc(db, retPath, rid), { paymentId: payment.id })
      }

      const newAssignedSessions = [...assignedSessionIds, ...sessionIds]
      const newAssignedRetainers = [...assignedRetainerIds, ...retainerIds]
      const newRemaining = remaining - totalSelected
      const payDocPath = PATHS.payments(abbr)
      logPath('updatePayment', `${payDocPath}/${payment.id}`)
      await updateDoc(doc(db, payDocPath, payment.id), {
        assignedSessions: newAssignedSessions,
        assignedRetainers: newAssignedRetainers,
        remainingAmount: newRemaining,
      })
      setAssignedSessionIds(newAssignedSessions)
      setAssignedRetainerIds(newAssignedRetainers)
      setRemaining(newRemaining)
      setSelected([])

      if (sessionIds.length) {
        patchBillingAssignedSessions(qc, abbr, account, sessionIds)
      }
      retainerIds.forEach((rid) =>
        payRetainerPatch(qc, abbr, account, rid),
      )
      await writeSummaryFromCache(qc, abbr, account)
    } catch (e) {
      console.error('assign payment failed', e)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 4, pb: '64px' }}>
        {needsCascade ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 2,
              rowGap: 1,
              mb: 2,
            }}
          >
            {(() => {
              const d = payment.paymentMade?.toDate
                ? payment.paymentMade.toDate()
                : new Date(payment.paymentMade)
              const fields: { label: string; value: React.ReactNode }[] = [
                { label: 'Payment Amount', value: formatCurrency(amount) },
                {
                  label: 'Payment Date',
                  value: isNaN(d.getTime()) ? '-' : formatMMMDDYYYY(d),
                },
                {
                  label: 'Method',
                  value: (
                    <TextField
                      select
                      size="small"
                      value={methodVal}
                      onChange={(e) => setMethodVal(e.target.value)}
                      inputProps={{
                        'data-testid': 'detail-method-select',
                        style: { fontFamily: 'Newsreader', fontWeight: 500 },
                      }}
                    >
                      {['FPS', 'Bank Transfer', 'Cheque'].map((m) => (
                        <MenuItem key={m} value={m}>
                          {m}
                        </MenuItem>
                      ))}
                    </TextField>
                  ),
                },
                {
                  label: 'Entity',
                  value: (
                    <TextField
                      select
                      size="small"
                      value={entityVal}
                      onChange={(e) => setEntityVal(e.target.value)}
                      inputProps={{
                        'data-testid': 'detail-entity-select',
                        style: { fontFamily: 'Newsreader', fontWeight: 500 },
                      }}
                    >
                      <MenuItem value="Music Establish (ERL)">Music Establish (ERL)</MenuItem>
                      <MenuItem value="Personal">Personal</MenuItem>
                    </TextField>
                  ),
                },
              ]
              if (entityVal === 'Music Establish (ERL)') {
                fields.push({
                  label: 'Bank',
                  value: (
                    <TextField
                      select
                      size="small"
                      value={selectedBank ? selectedBank.bankCode : ''}
                      onChange={(e) => {
                        const b = banks.find((bk) => bk.bankCode === e.target.value)
                        setSelectedBank(b || null)
                      }}
                      inputProps={{
                        'data-testid': 'detail-bank-select',
                        style: { fontFamily: 'Newsreader', fontWeight: 500 },
                      }}
                    >
                      {banks.map((b) => (
                        <MenuItem key={`${b.bankName}-${b.bankCode}`} value={b.bankCode}>
                          {buildBankLabel(b)}
                        </MenuItem>
                      ))}
                    </TextField>
                  ),
                })
                fields.push({
                  label: 'Bank Account',
                  value: (
                    <TextField
                      select
                      size="small"
                      value={accountIdVal}
                      onChange={(e) => setAccountIdVal(e.target.value)}
                      inputProps={{
                        'data-testid': 'detail-bank-account-select',
                        style: { fontFamily: 'Newsreader', fontWeight: 500 },
                      }}
                    >
                      {accounts.map((a) => (
                        <MenuItem key={a.accountDocId} value={a.accountDocId}>
                          {a.accountType}
                        </MenuItem>
                      ))}
                    </TextField>
                  ),
                })
              }
              if (sessionOrds.length) {
                const { visible, hiddenCount } = truncateList(sessionOrds)
                fields.push({
                  label: 'For Session(s)',
                  value: (
                    <>
                      {formatSessions(showAllSessions ? sessionOrds : visible)}
                      {hiddenCount > 0 && !showAllSessions && <> … (+{hiddenCount} more)</>}
                      {hiddenCount > 0 && (
                        <Button
                          size="small"
                          onClick={() => setShowAllSessions((s) => !s)}
                          sx={{ ml: 1 }}
                        >
                          {showAllSessions ? 'Hide' : 'View all'}
                        </Button>
                      )}
                    </>
                  ),
                })
              }
              fields.push({
                label: 'Reference #',
                value: (
                  <TextField
                    size="small"
                    value={refVal}
                    onChange={(e) => setRefVal(e.target.value)}
                    inputProps={{
                      'data-testid': 'detail-ref-input',
                      style: { fontFamily: 'Newsreader', fontWeight: 500 },
                    }}
                  />
                ),
              })
              fields.push({
                label: 'Remaining amount',
                value: (
                  <span data-testid="remaining-amount" className={remainingClass}>
                    {formatCurrency(pendingRemaining)}
                  </span>
                ),
              })
              return fields.map((f) => (
                <React.Fragment key={f.label}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
                  >
                    {f.label}:
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'Newsreader', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {f.value}
                  </Typography>
                </React.Fragment>
              ))
            })()}
            {bankError && (
              <Typography
                variant="body2"
                color="error"
                sx={{ gridColumn: '1 / span 2', mt: 1 }}
              >
                {bankError}
              </Typography>
            )}
          </Box>
        ) : (
          <>
            <Box data-testid="payment-summary-block" sx={{ mb: 2 }}>
              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                Payment made by –
              </Typography>
              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                {(studentName.first || 'N/A')}, {(studentName.last || 'N/A')}
              </Typography>
              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                on {(() => { const d = payment.paymentMade?.toDate ? payment.paymentMade.toDate() : new Date(payment.paymentMade); return isNaN(d.getTime()) ? '-' : formatMMMDDYYYY(d) })()} thru {payment.method || 'N/A'}
              </Typography>
              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                to Establish Records Limited:
              </Typography>
              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                {(acctInfo?.bankName || 'N/A')} ({acctInfo?.bankCode || 'N/A'})
              </Typography>
              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                {acctInfo?.accountType || 'N/A'}
              </Typography>
              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                {acctInfo?.accountNumber || 'N/A'}
              </Typography>
              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                for
              </Typography>
              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                {formatCurrency(amount)}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                columnGap: 2,
                rowGap: 1,
                mb: 2,
              }}
            >
              {(() => {
                const fields: { label: string; value: React.ReactNode }[] = []
                fields.push({
                  label: 'Reference #',
                  value: payment.refNumber ? (
                    payment.refNumber
                  ) : (
                    <TextField
                      size="small"
                      value={refVal}
                      onChange={(e) => setRefVal(e.target.value)}
                      inputProps={{
                        'data-testid': 'detail-ref-input',
                        style: { fontFamily: 'Newsreader', fontWeight: 500 },
                      }}
                    />
                  ),
                })
                fields.push({
                  label: 'Remaining amount',
                  value: (
                    <span data-testid="remaining-amount" className={remainingClass}>
                      {formatCurrency(pendingRemaining)}
                    </span>
                  ),
                })
                return fields.map((f) => (
                  <React.Fragment key={f.label}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
                    >
                      {f.label}:
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {f.value}
                    </Typography>
                  </React.Fragment>
                ))
              })()}
            </Box>
          </>
        )}

        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
        >
          For session:
        </Typography>
        <Table
          ref={tableRef}
          size="small"
          sx={{
            mt: 1,
            tableLayout: 'fixed',
            width: 'max-content',
            '& td, & th': {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
            '& th .MuiTableSortLabel-root': {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                data-col="ordinal"
                data-col-header
                title="Session #"
                sx={{
                  fontFamily: 'Cantata One',
                  fontWeight: 'bold',
                  position: 'relative',
                  width: widths['ordinal'],
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <TableSortLabel
                  active={sortField === 'ordinal'}
                  direction={sortField === 'ordinal' && sortAsc ? 'asc' : 'desc'}
                  onClick={() => {
                    if (sortField === 'ordinal') setSortAsc((s) => !s)
                    else {
                      setSortField('ordinal')
                      setSortAsc(true)
                    }
                  }}
                >
                  Session #
                </TableSortLabel>
                <Box
                  className="col-resizer"
                  aria-label="Resize column Session #"
                  role="separator"
                  tabIndex={0}
                  onMouseDown={(e) => startResize('ordinal', e)}
                  onDoubleClick={() =>
                    dblClickResize('ordinal', tableRef.current || undefined)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') keyResize('ordinal', 'left')
                    if (e.key === 'ArrowRight') keyResize('ordinal', 'right')
                  }}
                />
              </TableCell>
              <TableCell
                data-col="date"
                data-col-header
                title="Date"
                sx={{
                  fontFamily: 'Cantata One',
                  fontWeight: 'bold',
                  position: 'relative',
                  width: widths['date'],
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <TableSortLabel
                  active={sortField === 'date'}
                  direction={sortField === 'date' && sortAsc ? 'asc' : 'desc'}
                  onClick={() => {
                    if (sortField === 'date') setSortAsc((s) => !s)
                    else {
                      setSortField('date')
                      setSortAsc(true)
                    }
                  }}
                >
                  Date
                </TableSortLabel>
                <Box
                  className="col-resizer"
                  aria-label="Resize column Date"
                  role="separator"
                  tabIndex={0}
                  onMouseDown={(e) => startResize('date', e)}
                  onDoubleClick={() =>
                    dblClickResize('date', tableRef.current || undefined)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') keyResize('date', 'left')
                    if (e.key === 'ArrowRight') keyResize('date', 'right')
                  }}
                />
              </TableCell>
              <TableCell
                data-col="time"
                data-col-header
                title="Time"
                sx={{
                  fontFamily: 'Cantata One',
                  fontWeight: 'bold',
                  position: 'relative',
                  width: widths['time'],
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <TableSortLabel
                  active={sortField === 'time'}
                  direction={sortField === 'time' && sortAsc ? 'asc' : 'desc'}
                  onClick={() => {
                    if (sortField === 'time') setSortAsc((s) => !s)
                    else {
                      setSortField('time')
                      setSortAsc(true)
                    }
                  }}
                >
                  Time
                </TableSortLabel>
                <Box
                  className="col-resizer"
                  aria-label="Resize column Time"
                  role="separator"
                  tabIndex={0}
                  onMouseDown={(e) => startResize('time', e)}
                  onDoubleClick={() =>
                    dblClickResize('time', tableRef.current || undefined)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') keyResize('time', 'left')
                    if (e.key === 'ArrowRight') keyResize('time', 'right')
                  }}
                />
              </TableCell>
              <TableCell
                data-col="rate"
                data-col-header
                title="Rate"
                sx={{
                  fontFamily: 'Cantata One',
                  fontWeight: 'bold',
                  position: 'relative',
                  width: widths['rate'],
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <TableSortLabel
                  active={sortField === 'rate'}
                  direction={sortField === 'rate' && sortAsc ? 'asc' : 'desc'}
                  onClick={() => {
                    if (sortField === 'rate') setSortAsc((s) => !s)
                    else {
                      setSortField('rate')
                      setSortAsc(true)
                    }
                  }}
                >
                  Rate
                </TableSortLabel>
                <Box
                  className="col-resizer"
                  aria-label="Resize column Rate"
                  role="separator"
                  tabIndex={0}
                  onMouseDown={(e) => startResize('rate', e)}
                  onDoubleClick={() =>
                    dblClickResize('rate', tableRef.current || undefined)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') keyResize('rate', 'left')
                    if (e.key === 'ArrowRight') keyResize('rate', 'right')
                  }}
                />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!bill ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <CircularProgress size={16} />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sortRows(assigned).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell
                      data-col="ordinal"
                      title={String(s.ordinal ?? '-')}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {s.ordinal ?? '-'}
                    </TableCell>
                    <TableCell
                      data-col="date"
                      title={s.date || '-'}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {s.date || '-'}
                    </TableCell>
                    <TableCell
                      data-col="time"
                      title={s.time || '-'}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {s.time || '-'}
                    </TableCell>
                    <TableCell
                      data-col="rate"
                      title={formatCurrency(Number(s.rate) || 0)}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {formatCurrency(Number(s.rate) || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {sortRows(available).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell
                      data-col="ordinal"
                      title={String(s.ordinal ?? '-')}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      <Checkbox
                        checked={selected.includes(s.id)}
                        onChange={() => toggle(s.id)}
                        disabled={
                          assigning ||
                          (!selected.includes(s.id) &&
                            (s.rate || 0) >
                              Math.max(0, remaining - totalSelected))
                        }
                        sx={{ p: 0, mr: 1 }}
                      />
                      {s.ordinal ?? '-'}
                    </TableCell>
                    <TableCell
                      data-col="date"
                      title={s.date || '-'}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {s.date || '-'}
                    </TableCell>
                    <TableCell
                      data-col="time"
                      title={s.time || '-'}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {s.time || '-'}
                    </TableCell>
                    <TableCell
                      data-col="rate"
                      title={formatCurrency(Number(s.rate) || 0)}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {formatCurrency(Number(s.rate) || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {assigned.length === 0 && available.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                      data-testid="assignment-zero"
                    >
                      No sessions available.
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </Box>
      <Box
        className="dialog-footer"
        data-testid="dialog-footer"
        sx={{ p: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}
      >
        <Button
          variant="text"
          onClick={() => {
            onBack()
            onTitleChange?.(null)
          }}
          aria-label="back to payments"
          data-testid="back-button"
        >
          ← Back
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {needsMeta && (
            <Button
              variant="contained"
              onClick={saveMetaDetails}
              disabled={!methodVal || !entityVal || (isErl && !accountIdVal)}
              data-testid="detail-save"
            >
              Save
            </Button>
          )}
          {remaining > 0 && (
            <Button
              variant="contained"
              onClick={handleAssign}
              disabled={
                assigning || totalSelected === 0 || totalSelected > remaining
              }
            >
              Assign
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  )
}

