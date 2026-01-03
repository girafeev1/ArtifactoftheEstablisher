import React, { useState } from 'react'
import { Typography, Button } from 'antd'
import { PATHS, logPath } from '../../lib/paths'
import RateModal from './RateModal'
import { collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../../lib/firebase'
import { useBillingClient, billingKey } from '../../lib/billing/useBilling'
import { writeSummaryFromCache } from '../../lib/liveRefresh'

const { Text, Title } = Typography

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
    qc.setQueryData(billingKey(abbr, account), (prev?: any) => {
      if (!prev) return prev
      const rows = prev.rows.map((r: any) =>
        r.id === session.id
          ? { ...r, flags: { ...r.flags, voucherUsed: free } }
          : r,
      )
      const old = prev.rows.find((r: any) => r.id === session.id)
      let balanceDue = prev.balanceDue || 0
      if (
        old &&
        !old.flags.cancelled &&
        !old.flags.inRetainer &&
        !old.assignedPaymentId
      ) {
        const amt = old.amountDue || 0
        balanceDue = free
          ? Math.max(0, balanceDue - amt)
          : balanceDue + amt
      }
      return { ...prev, rows, balanceDue }
    })
    await writeSummaryFromCache(qc, abbr, account)
  }

  const markVoucher = async () => {
    await createVoucherEntry(true)
  }

  const unmarkVoucher = async () => {
    if (!window.confirm('Mark session as paid instead?')) return
    await createVoucherEntry(false)
  }

  const labelStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 200 }
  const valueStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 500 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flexGrow: 1, overflow: 'auto', padding: 32, paddingBottom: 64 }}>
        <Text type="secondary" style={labelStyle}>
          iCal ID:
        </Text>
        <Title level={5} style={{ ...valueStyle, marginTop: 0, marginBottom: 16 }}>
          {session.id}
        </Title>
        <Text type="secondary" style={labelStyle}>
          Date:
        </Text>
        <Title level={5} style={{ ...valueStyle, marginTop: 0, marginBottom: 16 }}>
          {formatDate(session.date)}
        </Title>
        <Text type="secondary" style={labelStyle}>
          Time:
        </Text>
        <Title level={5} style={{ ...valueStyle, marginTop: 0, marginBottom: 16 }}>
          {session.time}
        </Title>
        <Text type="secondary" style={labelStyle}>
          Duration:
        </Text>
        <Title level={5} style={{ ...valueStyle, marginTop: 0, marginBottom: 16 }}>
          {session.duration}
        </Title>
        <Text type="secondary" style={labelStyle}>
          Base Rate:
        </Text>
        <Title level={5} style={{ ...valueStyle, marginTop: 0, marginBottom: 16 }}>
          {session.baseRate !== '-' ? formatCurrency(Number(session.baseRate)) : '-'}
        </Title>
        <Text type="secondary" style={labelStyle}>
          Rate Charged:
        </Text>
        <Title
          level={5}
          style={{
            ...valueStyle,
            marginTop: 0,
            marginBottom: 16,
            cursor: voucherUsed ? 'default' : 'pointer',
          }}
          onClick={() => {
            if (!voucherUsed) setRateOpen(true)
          }}
        >
          {session.rateCharged !== '-' ?
            formatCurrency(Number(session.rateCharged)) :
            '-'}
        </Title>
        <Text type="secondary" style={labelStyle}>
          Session Voucher:
        </Text>
        <Title level={5} style={{ ...valueStyle, marginTop: 0, marginBottom: 16 }}>
          {voucherUsed ? 'Yes' : 'No'}
        </Title>
        {voucherUsed ? (
          <Button onClick={unmarkVoucher} style={{ marginTop: 8 }}>
            Remove Session Voucher
          </Button>
        ) : (
          <Button
            onClick={markVoucher}
            disabled={session.rateSpecified}
            style={{ marginTop: 8 }}
          >
            Use Session Voucher
          </Button>
        )}
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={labelStyle}>
            Payment Status:
          </Text>
          <Title level={5} style={{ ...valueStyle, marginTop: 0, marginBottom: 16 }}>
            {session.paymentStatus}
          </Title>
          <Text type="secondary" style={labelStyle}>
            Pay on:
          </Text>
          <Title level={5} style={{ ...valueStyle, marginTop: 0, marginBottom: 16 }}>
            {session.payOn || '-'}
          </Title>
        </div>
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
      </div>

      <div
        className="dialog-footer"
        style={{ padding: 8, display: 'flex', justifyContent: 'flex-start' }}
      >
        <Button type="text" onClick={onBack} aria-label="back to sessions">
          ← Back
        </Button>
      </div>
    </div>
  )
}
