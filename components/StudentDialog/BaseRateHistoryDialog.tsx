import React, { useEffect, useState } from 'react'
import { Modal, Button, Table, Input, Space } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { PATHS, logPath } from '../../lib/paths'
import { useSession } from 'next-auth/react'
import { useBillingClient } from '../../lib/billing/useBilling'
import { writeSummaryFromCache } from '../../lib/liveRefresh'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Hong_Kong')

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)

export default function BaseRateHistoryDialog({
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
  const [rows, setRows] = useState<any[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [newRate, setNewRate] = useState('')
  const [newDate, setNewDate] = useState(dayjs().tz().format('YYYY-MM-DD'))
  const [editing, setEditing] = useState<{ id: string; field: 'rate' | 'date' } | null>(null)
  const { data: session } = useSession()
  const qc = useBillingClient()
  const formatDate = (v: any) => {
    if (!v) return 'N/A'
    try {
      const d = v.toDate ? v.toDate() : new Date(v)
      return isNaN(d.getTime())
        ? 'N/A'
        : d.toLocaleDateString(undefined, {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          })
    } catch {
      return 'N/A'
    }
  }

  useEffect(() => {
    if (!open) return
    const path = PATHS.baseRateHistory(abbr)
    logPath('baseRateHistory', path)
    const q = query(collection(db, path), orderBy('timestamp', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    })
    return () => unsub()
  }, [abbr, open])

  const add = async () => {
    const path = PATHS.baseRateHistory(abbr)
    const eff = dayjs
      .tz(newDate, 'Asia/Hong_Kong')
      .startOf('day')
      .toDate()
    await addDoc(collection(db, path), {
      rate: Number(newRate) || 0,
      timestamp: Timestamp.fromDate(new Date()),
      effectDate: Timestamp.fromDate(eff),
      editedBy: session?.user?.email || 'unknown',
    })
    setNewRate('')
    setNewDate(dayjs().tz().format('YYYY-MM-DD'))
    setAddOpen(false)
    await writeSummaryFromCache(qc, abbr, account)
  }

  const saveEffectDate = async (id: string, date: string) => {
    const eff = dayjs
      .tz(date, 'Asia/Hong_Kong')
      .startOf('day')
      .toDate()
    const ref = doc(db, PATHS.baseRateHistory(abbr), id)
    await updateDoc(ref, {
      effectDate: Timestamp.fromDate(eff),
      editedBy: session?.user?.email || 'unknown',
    })
    setEditing(null)
  }

  const saveRate = async (id: string, rate: string) => {
    const ref = doc(db, PATHS.baseRateHistory(abbr), id)
    await updateDoc(ref, {
      rate: Number(rate) || 0,
      editedBy: session?.user?.email || 'unknown',
    })
    setEditing(null)
  }

  interface RowType {
    id: string
    rate: number
    effectDate?: any
    timestamp: any
    editedBy?: string
  }

  const columns: ColumnsType<RowType> = [
    {
      title: 'Rate (HKD)',
      dataIndex: 'rate',
      key: 'rate',
      render: (_, r) =>
        editing && editing.id === r.id && editing.field === 'rate' ? (
          <Input
            type="number"
            size="small"
            defaultValue={r.rate}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => saveRate(r.id, e.target.value)}
            style={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          />
        ) : (
          <span
            role="button"
            tabIndex={0}
            style={{ fontFamily: 'Newsreader', fontWeight: 500, cursor: 'pointer' }}
            onClick={() => setEditing({ id: r.id, field: 'rate' })}
          >
            {formatCurrency(Number(r.rate) || 0)}
          </span>
        ),
    },
    {
      title: 'Effective Date',
      dataIndex: 'effectDate',
      key: 'effectDate',
      render: (_, r) => {
        if (editing && editing.id === r.id && editing.field === 'date') {
          return (
            <Input
              type="date"
              size="small"
              defaultValue={
                r.effectDate
                  ? dayjs(r.effectDate.toDate ? r.effectDate.toDate() : r.effectDate)
                      .tz()
                      .format('YYYY-MM-DD')
                  : dayjs().tz().format('YYYY-MM-DD')
              }
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => saveEffectDate(r.id, e.target.value)}
              style={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            />
          )
        }
        if (r.effectDate) {
          return (
            <span
              role="button"
              tabIndex={0}
              style={{ fontFamily: 'Newsreader', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setEditing({ id: r.id, field: 'date' })}
            >
              {formatDate(r.effectDate)}
            </span>
          )
        }
        return (
          <Input
            type="date"
            size="small"
            defaultValue={dayjs().tz().format('YYYY-MM-DD')}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => saveEffectDate(r.id, e.target.value)}
            style={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          />
        )
      },
    },
  ]

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        title={<span style={{ fontFamily: 'Cantata One' }}>Base Rate History</span>}
        width={600}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setAddOpen(true)}>Add</Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        }
      >
        <Table
          size="small"
          columns={columns}
          dataSource={rows}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'No history.' }}
        />
      </Modal>
      <Modal
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        title={<span style={{ fontFamily: 'Cantata One' }}>Add Base Rate</span>}
        footer={
          <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={add} disabled={!newRate}>
              Add
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontFamily: 'Newsreader', fontWeight: 200 }}>
            New Rate (HKD)
          </label>
          <Input
            type="number"
            value={newRate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRate(e.target.value)}
            style={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontFamily: 'Newsreader', fontWeight: 200 }}>
            Effective Date
          </label>
          <Input
            type="date"
            value={newDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDate(e.target.value)}
            style={{ fontFamily: 'Newsreader', fontWeight: 500 }}
          />
        </div>
      </Modal>
    </>
  )
}
