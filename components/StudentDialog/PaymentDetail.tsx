import React, { useEffect, useState } from 'react'
import { Typography, Button, Checkbox, Table, Spin, Input, Select } from 'antd'
import type { ColumnsType } from 'antd/es/table'

const { Text } = Typography
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
  buildAccountLabel,
  maskAccountNumber,
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
  const [acctError, setAcctError] = useState<string | null>(null)
  const [acctEmpty, setAcctEmpty] = useState(false)
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
  const bankMsg = "Can't read ERL directory. Check erl-directory rules."
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
    const load = () => {
      if (isErl && selectedBank) {
        listAccounts(selectedBank)
          .then((a) => {
            setAccounts(a)
            setAcctEmpty(a.length === 0)
            setAcctError(null)
          })
          .catch(() => {
            setAccounts([])
            setAcctEmpty(false)
            setAcctError(bankMsg)
          })
        setBankCodeVal(selectedBank.bankCode)
      } else {
        setAccounts([])
        setAccountIdVal('')
        setAcctEmpty(false)
        setAcctError(null)
      }
    }
    load()
  }, [isErl, selectedBank])

  const retryAccounts = () => {
    if (isErl && selectedBank) {
      listAccounts(selectedBank)
        .then((a) => {
          setAccounts(a)
          setAcctEmpty(a.length === 0)
          setAcctError(null)
        })
        .catch(() => {
          setAccounts([])
          setAcctEmpty(false)
          setAcctError(bankMsg)
        })
    }
  }
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

  const labelStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 200 }
  const valueStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }

  interface SessionRow {
    id: string
    ordinal?: number
    date?: string
    time?: string
    rate?: number
    rateDisplay?: string
    startMs?: number
    assignedPaymentId?: string
    retainerId?: string
    paymentId?: string
  }

  const tableColumns: ColumnsType<SessionRow> = [
    {
      title: 'Session #',
      dataIndex: 'ordinal',
      key: 'ordinal',
      width: widths['ordinal'],
      sorter: true,
      sortOrder: sortField === 'ordinal' ? (sortAsc ? 'ascend' : 'descend') : undefined,
      render: (v: number | undefined, r: SessionRow) => {
        const isAvail = available.some((a) => a.id === r.id)
        if (isAvail) {
          return (
            <>
              <Checkbox
                checked={selected.includes(r.id)}
                onChange={() => toggle(r.id)}
                disabled={
                  assigning ||
                  (!selected.includes(r.id) &&
                    (r.rate || 0) > Math.max(0, remaining - totalSelected))
                }
                style={{ padding: 0, marginRight: 8 }}
              />
              <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{v ?? '-'}</span>
            </>
          )
        }
        return <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{v ?? '-'}</span>
      },
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: widths['date'],
      sorter: true,
      sortOrder: sortField === 'date' ? (sortAsc ? 'ascend' : 'descend') : undefined,
      render: (v: string) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{v || '-'}</span>,
    },
    {
      title: 'Time',
      dataIndex: 'time',
      key: 'time',
      width: widths['time'],
      sorter: true,
      sortOrder: sortField === 'time' ? (sortAsc ? 'ascend' : 'descend') : undefined,
      render: (v: string) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{v || '-'}</span>,
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      width: widths['rate'],
      sorter: true,
      sortOrder: sortField === 'rate' ? (sortAsc ? 'ascend' : 'descend') : undefined,
      render: (v: number) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{formatCurrency(Number(v) || 0)}</span>,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flexGrow: 1, overflow: 'auto', padding: 16, paddingBottom: 64 }}>
        {needsCascade ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 16,
              rowGap: 8,
              marginBottom: 16,
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
                    <Select
                      size="small"
                      value={methodVal || undefined}
                      onChange={(val: string) => setMethodVal(val)}
                      style={{ minWidth: 150, fontFamily: 'Newsreader', fontWeight: 500 }}
                      data-testid="detail-method-select"
                      options={['FPS', 'Bank Transfer', 'Cheque'].map((m) => ({ label: m, value: m }))}
                      placeholder="Select method"
                    />
                  ),
                },
                {
                  label: 'Entity',
                  value: (
                    <Select
                      size="small"
                      value={entityVal || undefined}
                      onChange={(val: string) => setEntityVal(val)}
                      style={{ minWidth: 180, fontFamily: 'Newsreader', fontWeight: 500 }}
                      data-testid="detail-entity-select"
                      options={[
                        { label: 'Music Establish (ERL)', value: 'Music Establish (ERL)' },
                        { label: 'Personal', value: 'Personal' },
                      ]}
                      placeholder="Select entity"
                    />
                  ),
                },
              ]
              if (entityVal === 'Music Establish (ERL)') {
                fields.push({
                  label: 'Bank',
                  value: (
                    <Select
                      size="small"
                      value={selectedBank ? selectedBank.rawCodeSegment : undefined}
                      onChange={(val: string) => {
                        const b = banks.find((bk) => bk.rawCodeSegment === val)
                        setSelectedBank(b || null)
                      }}
                      style={{ minWidth: 200, fontFamily: 'Newsreader', fontWeight: 500 }}
                      data-testid="detail-bank-select"
                      options={banks.map((b) => ({
                        label: buildBankLabel(b),
                        value: b.rawCodeSegment,
                      }))}
                      placeholder="Select bank"
                    />
                  ),
                })
                fields.push({
                  label: 'Bank Account',
                  value: (
                    <Select
                      size="small"
                      value={accountIdVal || undefined}
                      onChange={(val: string) => setAccountIdVal(val)}
                      style={{ minWidth: 200, fontFamily: 'Newsreader', fontWeight: 500 }}
                      data-testid="detail-bank-account-select"
                      options={accounts.map((a) => ({
                        label: buildAccountLabel(a),
                        value: a.accountDocId,
                      }))}
                      placeholder="Select account"
                    />
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
                          style={{ marginLeft: 8 }}
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
                  <Input
                    size="small"
                    value={refVal}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRefVal(e.target.value)}
                    data-testid="detail-ref-input"
                    style={{ fontFamily: 'Newsreader', fontWeight: 500, maxWidth: 200 }}
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
                  <Text style={labelStyle}>{f.label}:</Text>
                  <Text style={valueStyle}>{f.value}</Text>
                </React.Fragment>
              ))
            })()}
            {bankError && (
              <Text type="danger" style={{ gridColumn: '1 / span 2', marginTop: 8 }}>
                {bankError}
              </Text>
            )}
            {acctError && !bankError && (
              <Text type="danger" style={{ gridColumn: '1 / span 2', marginTop: 8 }}>
                {acctError}
              </Text>
            )}
            {acctEmpty && !acctError && (
              <Text style={{ gridColumn: '1 / span 2', marginTop: 8 }}>
                No accounts found.{' '}
                <Button size="small" onClick={retryAccounts}>
                  Retry
                </Button>
              </Text>
            )}
          </div>
        ) : (
          <>
            <div data-testid="payment-summary-block" style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: 'Newsreader', fontWeight: 500, display: 'block' }}>
                Payment made by –
              </Text>
              <Text style={{ fontFamily: 'Newsreader', fontWeight: 500, display: 'block' }}>
                {(studentName.first || 'N/A')}, {(studentName.last || 'N/A')}
              </Text>
              <Text style={{ fontFamily: 'Newsreader', fontWeight: 500, display: 'block' }}>
                on {(() => { const d = payment.paymentMade?.toDate ? payment.paymentMade.toDate() : new Date(payment.paymentMade); return isNaN(d.getTime()) ? '-' : formatMMMDDYYYY(d) })()} thru {payment.method || 'N/A'}
              </Text>
              <Text style={{ fontFamily: 'Newsreader', fontWeight: 500, display: 'block' }}>
                to Establish Records Limited:
              </Text>
              <Text style={{ fontFamily: 'Newsreader', fontWeight: 500, display: 'block' }}>
                {(acctInfo?.bankName || 'N/A')} ({acctInfo?.bankCode || 'N/A'})
              </Text>
              <Text style={{ fontFamily: 'Newsreader', fontWeight: 500, display: 'block' }}>
                {acctInfo?.accountType || 'N/A'}
              </Text>
              <Text style={{ fontFamily: 'Newsreader', fontWeight: 500, display: 'block' }}>
                {maskAccountNumber(acctInfo?.accountNumber) || 'N/A'}
              </Text>
              <Text style={{ fontFamily: 'Newsreader', fontWeight: 500, display: 'block' }}>
                for
              </Text>
              <Text style={{ fontFamily: 'Newsreader', fontWeight: 500, display: 'block' }}>
                {formatCurrency(amount)}
              </Text>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                columnGap: 16,
                rowGap: 8,
                marginBottom: 16,
              }}
            >
              {(() => {
                const fields: { label: string; value: React.ReactNode }[] = []
                fields.push({
                  label: 'Reference #',
                  value: payment.refNumber ? (
                    payment.refNumber
                  ) : (
                    <Input
                      size="small"
                      value={refVal}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRefVal(e.target.value)}
                      data-testid="detail-ref-input"
                      style={{ fontFamily: 'Newsreader', fontWeight: 500, maxWidth: 200 }}
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
                    <Text style={labelStyle}>{f.label}:</Text>
                    <Text style={valueStyle}>{f.value}</Text>
                  </React.Fragment>
                ))
              })()}
            </div>
          </>
        )}

        <Text style={{ fontFamily: 'Newsreader', fontWeight: 200 }}>For session:</Text>
        {!bill ? (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Spin size="small" />
          </div>
        ) : (
          <Table
            size="small"
            columns={tableColumns}
            dataSource={[...sortRows(assigned), ...sortRows(available)]}
            rowKey="id"
            pagination={false}
            style={{ marginTop: 8 }}
            onChange={(_: any, __: any, sorter: any) => {
              if (sorter.field) {
                const field = sorter.field as 'ordinal' | 'date' | 'time' | 'rate'
                if (sortField === field) {
                  setSortAsc(sorter.order === 'ascend')
                } else {
                  setSortField(field)
                  setSortAsc(sorter.order === 'ascend')
                }
              }
            }}
            locale={{ emptyText: <span data-testid="assignment-zero">No sessions available.</span> }}
          />
        )}
      </div>
      <div
        className="dialog-footer"
        data-testid="dialog-footer"
        style={{ padding: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}
      >
        <Button
          type="text"
          onClick={() => {
            onBack()
            onTitleChange?.(null)
          }}
          aria-label="back to payments"
          data-testid="back-button"
        >
          ← Back
        </Button>
        <div style={{ display: 'flex', gap: 8 }}>
          {needsMeta && (
            <Button
              type="primary"
              onClick={saveMetaDetails}
              disabled={!methodVal || !entityVal || (isErl && !accountIdVal)}
              data-testid="detail-save"
            >
              Save
            </Button>
          )}
          {remaining > 0 && (
            <Button
              type="primary"
              onClick={handleAssign}
              disabled={
                assigning || totalSelected === 0 || totalSelected > remaining
              }
            >
              Assign
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

