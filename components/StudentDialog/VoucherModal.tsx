import React, { useState } from 'react'
import { Modal, Input, Button, Space } from 'antd'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { PATHS, logPath } from '../../lib/paths'
import { useBillingClient, billingKey } from '../../lib/billing/useBilling'
import { writeSummaryFromCache } from '../../lib/liveRefresh'

export default function VoucherModal({
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
  const [token, setToken] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const qc = useBillingClient()

  const save = async () => {
    const path = PATHS.freeMeal(abbr)
    logPath('freeMeal', path)
    const colRef = collection(db, path)
    const snap = await getDocs(colRef)
    const idx = String(snap.size + 1).padStart(3, '0')
    const today = new Date()
    const yyyyMMdd = today.toISOString().slice(0, 10).replace(/-/g, '')
    const docName = `${abbr}-FM-${idx}-${yyyyMMdd}`
    const eff = effectiveDate ? new Date(effectiveDate) : today
    await setDoc(doc(colRef, docName), {
      Token: Number(token) || 0,
      timestamp: today,
      effectiveDate: eff,
      EditedBy: 'system',
    })
    qc.setQueryData(billingKey(abbr, account), (prev?: any) => {
      if (!prev) return prev
      return {
        ...prev,
        voucherBalance: (prev.voucherBalance || 0) + (Number(token) || 0),
      }
    })
    await writeSummaryFromCache(qc, abbr, account)
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={<span style={{ fontFamily: 'Cantata One' }}>Add Session Voucher</span>}
      width={400}
      zIndex={1601}
      footer={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            onClick={async () => {
              await save()
              setToken('')
              setEffectiveDate('')
              onClose()
            }}
            disabled={!token || !effectiveDate}
          >
            Save
          </Button>
        </Space>
      }
    >
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 8, color: 'rgba(0, 0, 0, 0.45)' }}>
          Token
        </label>
        <Input
          type="number"
          value={token}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
          autoFocus
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 8, color: 'rgba(0, 0, 0, 0.45)' }}>
          Effective Date
        </label>
        <Input
          type="date"
          value={effectiveDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEffectiveDate(e.target.value)}
        />
      </div>
    </Modal>
  )
}
