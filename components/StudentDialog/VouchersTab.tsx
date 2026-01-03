import React, { useEffect, useState } from 'react'
import { Typography, Table, Tooltip, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { PATHS, logPath } from '../../lib/paths'
import { CreateIcon } from './icons'
import VoucherModal from './VoucherModal'

const { Text } = Typography

const formatDate = (v: any) => {
  try {
    const d = v?.toDate ? v.toDate() : new Date(v)
    return isNaN(d.getTime())
      ? '-'
      : d.toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
  } catch {
    return '-'
  }
}

interface Row {
  id: string
  Token: number
  effectiveDate?: any
  timestamp: any
  EditedBy?: string
}

export default function VouchersTab({ abbr, account }: { abbr: string; account: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    const path = PATHS.freeMeal(abbr)
    logPath('freeMeal', path)
    const snap = await getDocs(collection(db, path))
    const list = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => {
        const ta =
          a.effectiveDate?.toDate?.()?.getTime() ||
          new Date(a.effectiveDate).getTime() ||
          a.timestamp?.toDate?.()?.getTime() ||
          0
        const tb =
          b.effectiveDate?.toDate?.()?.getTime() ||
          new Date(b.effectiveDate).getTime() ||
          b.timestamp?.toDate?.()?.getTime() ||
          0
        return ta - tb
      })
    setRows(list)
  }

  useEffect(() => {
    load()
  }, [abbr])

  const columns: ColumnsType<Row> = [
    {
      title: 'Token',
      dataIndex: 'Token',
      key: 'Token',
      render: (v) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Effective Date',
      dataIndex: 'effectiveDate',
      key: 'effectiveDate',
      render: (v) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{formatDate(v)}</span>,
    },
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (v) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{formatDate(v)}</span>,
    },
    {
      title: 'Edited By',
      dataIndex: 'EditedBy',
      key: 'EditedBy',
      render: (v) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{v || '-'}</span>,
    },
  ]

  return (
    <div style={{ padding: 8, textAlign: 'left', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontFamily: 'Cantata One', textDecoration: 'underline' }}>
          Session Vouchers
        </Text>
        <Tooltip title="Create Voucher">
          <Button type="text" icon={<CreateIcon />} onClick={() => setModalOpen(true)} />
        </Tooltip>
      </div>
      <Table
        size="small"
        columns={columns}
        dataSource={rows}
        rowKey="id"
        pagination={false}
      />
      <VoucherModal
        abbr={abbr}
        account={account}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          load()
        }}
      />
    </div>
  )
}
