import React, { useState } from 'react'
import { Modal, Input, Button, Space, Typography } from 'antd'
import { addRetainer, calculateEndDate, RetainerDoc } from '../../lib/retainer'
import { useBillingClient } from '../../lib/billing/useBilling'
import { writeSummaryFromCache, markSessionsInRetainer } from '../../lib/liveRefresh'

const { Text } = Typography

const formatDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
    : '-'

export default function RetainerModal({
  abbr,
  account,
  balanceDue,
  retainer,
  nextStart,
  open,
  onClose,
}: {
  abbr: string
  account: string
  balanceDue: number
  retainer?: RetainerDoc & { id: string }
  nextStart?: Date
  open: boolean
  onClose: (saved: boolean) => void
}) {
  const [start, setStart] = useState<string>(() => {
    if (retainer) return retainer.retainerStarts.toDate().toISOString().slice(0, 10)
    if (nextStart) {
      const d = new Date(nextStart)
      d.setDate(d.getDate() + 1)
      return d.toISOString().slice(0, 10)
    }
    return ''
  })
  const [rate, setRate] = useState<string>(() =>
    retainer ? String(retainer.retainerRate) : '',
  )
  const [error, setError] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const qc = useBillingClient()

  const startDate = start ? new Date(start) : null
  const endDate = startDate ? calculateEndDate(startDate) : null

  const handleSave = async () => {
    if (!startDate || !rate) return
      const numRate = Number(rate)
      setError('')
      setSaving(true)
      try {
        await addRetainer(abbr, startDate, numRate)
      const startMs = startDate.getTime()
      const endMs = endDate ? endDate.getTime() : startMs
      markSessionsInRetainer(qc, abbr, account, startMs, endMs, true)
      await writeSummaryFromCache(qc, abbr, account)
      onClose(true)
    } catch (e: any) {
      setError(String(e.message || e))
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 8,
    fontFamily: 'Newsreader',
    fontWeight: 200,
    color: 'rgba(0, 0, 0, 0.45)'
  }
  const inputStyle: React.CSSProperties = { fontFamily: 'Newsreader', fontWeight: 500 }

  return (
    <Modal
      open={open}
      onCancel={() => onClose(false)}
      title={<span style={{ fontFamily: 'Cantata One' }}>{retainer ? 'Edit Retainer' : 'Add Retainer'}</span>}
      width={400}
      footer={
        <Space>
          <Button onClick={() => onClose(false)} disabled={saving}>
            Close
          </Button>
          <Button
            type="primary"
            onClick={handleSave}
            disabled={saving || !start || !rate}
          >
            Save
          </Button>
        </Space>
      }
    >
      {/* TODO: replace Input type="date" with Ant DatePicker + disabledDate to gray out overlapping ranges. */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Start Date</label>
        <Input
          type="date"
          value={start}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStart(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>End Date</label>
        <Input
          value={formatDate(endDate)}
          readOnly
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Rate</label>
        <Input
          value={rate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRate(e.target.value)}
          type="number"
          style={inputStyle}
        />
        <Text type="secondary" style={{ fontFamily: 'Newsreader', fontWeight: 500, fontSize: 12, marginTop: 4, display: 'block' }}>
          Balance Due: {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD', currencyDisplay: 'code' }).format(balanceDue)} (retainers can be added even if balance is insufficient)
        </Text>
      </div>
      {error && (
        <Text type="danger" style={{ marginBottom: 16, display: 'block' }}>
          {error}
        </Text>
      )}
    </Modal>
  )
}
