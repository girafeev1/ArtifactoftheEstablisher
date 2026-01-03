import React, { useState, useEffect } from 'react'
import { Modal, Input, Button, Select, Typography, Row, Col, Space } from 'antd'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../../lib/firebase'
import {
  listBanks,
  listAccounts,
  buildBankLabel,
  buildAccountLabel,
  BankInfo,
  AccountInfo,
} from '../../lib/erlDirectory'
import { reducePaymentPayload } from '../../lib/payments/submit'
import { PATHS, logPath } from '../../lib/paths'
import { useBillingClient, billingKey } from '../../lib/billing/useBilling'
import { writeSummaryFromCache } from '../../lib/liveRefresh'
import { useSnackbar } from 'notistack'

const { Text } = Typography

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
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null)
  const [accountId, setAccountId] = useState('')
  const [banks, setBanks] = useState<BankInfo[]>([])
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [bankError, setBankError] = useState<string | null>(null)
  const [acctError, setAcctError] = useState<string | null>(null)
  const [acctEmpty, setAcctEmpty] = useState(false)
  const [refNumber, setRefNumber] = useState('')
  const qc = useBillingClient()
  const isErl = entity === 'Music Establish (ERL)'
  const { enqueueSnackbar } = useSnackbar()
  const bankMsg = "Can't read ERL directory. Check erl-directory rules."

  useEffect(() => {
    if (!isErl) {
      setSelectedBank(null)
      setAccountId('')
      setBankError(null)
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
    const load = () => {
      if (selectedBank) {
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
      } else {
        setAccounts([])
        setAcctEmpty(false)
        setAcctError(null)
      }
      setAccountId('')
    }
    load()
  }, [selectedBank])

  const retryAccounts = () => {
    if (selectedBank) {
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

  const save = async () => {
    const paymentsPath = PATHS.payments(abbr)
    logPath('addPayment', paymentsPath)
    const colRef = collection(db, paymentsPath)
    const today = new Date()
    const date = madeOn ? new Date(madeOn) : today
    const draft: any = {
      amount: Number(amount) || 0,
      paymentMade: Timestamp.fromDate(date),
      remainingAmount: Number(amount) || 0,
      assignedSessions: [],
      assignedRetainers: [],
      method,
      refNumber,
      timestamp: Timestamp.now(),
      editedBy: getAuth().currentUser?.email || 'system',
      accountDocId: isErl ? accountId : undefined,
    }
    const data = reducePaymentPayload(draft)
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

  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 8, fontFamily: 'Newsreader', fontWeight: 200, color: 'rgba(0, 0, 0, 0.45)' }
  const inputStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 500 }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={<span style={{ fontFamily: 'Cantata One' }}>Add Payment</span>}
      width={400}
      footer={
        <Space className="dialog-footer" data-testid="dialog-footer">
          <Button onClick={onClose} data-testid="back-button">
            Back
          </Button>
          <Button
            type="primary"
            onClick={async () => {
              await save()
              setAmount('')
              setMadeOn('')
              setMethod('')
              setEntity('')
              setSelectedBank(null)
              setAccountId('')
              setRefNumber('')
              onClose()
            }}
            disabled={!method || !entity || (isErl && !accountId)}
            data-testid="submit-payment"
          >
            Submit
          </Button>
        </Space>
      }
    >
      <div style={{ marginTop: 8 }}>
        <label style={labelStyle}>Payment Amount</label>
        <Input
          type="number"
          value={amount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
          autoFocus
          style={inputStyle}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>Payment Made On</label>
        <Input
          type="date"
          value={madeOn}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMadeOn(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>Payment Method</label>
        <Select
          value={method || undefined}
          onChange={(val: string) => setMethod(val)}
          style={{ width: '100%', ...inputStyle }}
          data-testid="method-select"
          options={['FPS', 'Bank Transfer', 'Cheque'].map((m) => ({ label: m, value: m }))}
          placeholder="Select method"
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>Entity</label>
        <Select
          value={entity || undefined}
          onChange={(val: string) => {
            setEntity(val)
            if (val !== 'Music Establish (ERL)') {
              setAccountId('')
            }
          }}
          style={{ width: '100%', ...inputStyle }}
          data-testid="entity-select"
          options={[
            { label: 'Music Establish (ERL)', value: 'Music Establish (ERL)' },
            { label: 'Personal', value: 'Personal' },
          ]}
          placeholder="Select entity"
        />
      </div>
      {isErl && (
        <>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <label style={labelStyle}>Bank</label>
              <Select
                value={selectedBank ? selectedBank.rawCodeSegment : undefined}
                onChange={(val: string) => {
                  const b = banks.find((bk) => bk.rawCodeSegment === val)
                  setSelectedBank(b || null)
                }}
                style={{ width: '100%', ...inputStyle }}
                data-testid="bank-select"
                options={banks.map((b) => ({
                  label: buildBankLabel(b),
                  value: b.rawCodeSegment,
                }))}
                placeholder="Select bank"
              />
            </Col>
            <Col xs={24} md={12}>
              <label style={labelStyle}>Bank Account</label>
              <Select
                value={accountId || undefined}
                onChange={(val: string) => setAccountId(val)}
                style={{ width: '100%', ...inputStyle }}
                data-testid="bank-account-select"
                options={accounts.map((a) => ({
                  label: buildAccountLabel(a),
                  value: a.accountDocId,
                }))}
                placeholder="Select account"
              />
            </Col>
          </Row>
          {bankError && (
            <Text type="danger" style={{ display: 'block', marginTop: 8 }}>
              {bankError}
            </Text>
          )}
          {acctError && !bankError && (
            <Text type="danger" style={{ display: 'block', marginTop: 8 }}>
              {acctError}
            </Text>
          )}
          {acctEmpty && !acctError && (
            <Text style={{ display: 'block', marginTop: 8 }}>
              No accounts found.{' '}
              <Button size="small" onClick={retryAccounts}>
                Retry
              </Button>
            </Text>
          )}
        </>
      )}
      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>Reference Number</label>
        <Input
          value={refNumber}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRefNumber(e.target.value)}
          style={inputStyle}
          data-testid="ref-input"
        />
      </div>
    </Modal>
  )
}
