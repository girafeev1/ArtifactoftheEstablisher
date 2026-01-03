import React, { useEffect, useState } from 'react'
import { Typography, Table, Tooltip, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { RetainerDoc, getRetainerStatus, RetainerStatusColor } from '../../lib/retainer'
import RetainerModal from './RetainerModal'
import { CreateIcon } from './icons'
import { useSession } from 'next-auth/react'
import { useColumnWidths } from '../../lib/useColumnWidths'

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

interface RetRow extends RetainerDoc {
  id: string
}

export default function RetainersTab({
  abbr,
  account,
  balanceDue,
}: {
  abbr: string
  account: string
  balanceDue: number
}) {
  const [rows, setRows] = useState<RetRow[]>([])
  const [sortAsc, setSortAsc] = useState(false)
  const [modal, setModal] = useState<{
    open: boolean
    retainer?: RetRow
    nextStart?: Date
  }>({ open: false })
  const { data: session } = useSession()
  const userEmail = session?.user?.email || 'anon'
  const columns = [
    { key: 'retainer', width: 120 },
    { key: 'period', width: 200 },
    { key: 'rate', width: 120 },
    { key: 'status', width: 120 },
    { key: 'actions', width: 100 },
  ] as const
  const { widths, startResize, dblClickResize, keyResize } = useColumnWidths(
    'retainers',
    columns,
    userEmail,
  )
  const tableRef = React.useRef<HTMLTableElement>(null)

  const load = async () => {
    try {
      const snap = await getDocs(collection(db, 'Students', abbr, 'Retainers'))
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as RetainerDoc) }))
        .sort((a, b) =>
          a.retainerStarts.toDate().getTime() - b.retainerStarts.toDate().getTime(),
        )
      setRows(list)
    } catch (e) {
      console.error('load retainers failed', e)
      setRows([])
    }
  }

  useEffect(() => {
    load()
  }, [abbr])


  const sortedRows = [...rows].sort((a, b) => {
    const diff =
      a.retainerStarts.toDate().getTime() - b.retainerStarts.toDate().getTime()
    return sortAsc ? diff : -diff
  })

  const today = new Date()
  const nextFuture = [...rows]
    .map((r) => ({ row: r, s: r.retainerStarts.toDate() }))
    .filter((r) => r.s > today)
    .sort((a, b) => a.s.getTime() - b.s.getTime())[0]?.row

  const colorMap: Record<RetainerStatusColor, string> = {
    green: '#52c41a',
    red: '#ff4d4f',
    lightBlue: '#69b1ff',
    lightGreen: '#95de64',
  }

  const tableColumns: ColumnsType<RetRow> = [
    {
      title: 'Retainer',
      dataIndex: 'retainerStarts',
      key: 'retainer',
      width: widths['retainer'],
      sorter: (a, b) => a.retainerStarts.toDate().getTime() - b.retainerStarts.toDate().getTime(),
      defaultSortOrder: sortAsc ? 'ascend' : 'descend',
      render: (_, r) => {
        const start = r.retainerStarts.toDate()
        const labelDate = new Date(start)
        if (labelDate.getDate() >= 21) labelDate.setMonth(labelDate.getMonth() + 1)
        const monthLabel = labelDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })
        return <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{monthLabel}</span>
      },
    },
    {
      title: 'Coverage Period',
      key: 'period',
      width: widths['period'],
      render: (_, r) => (
        <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
          {`${formatDate(r.retainerStarts)} – ${formatDate(r.retainerEnds)}`}
        </span>
      ),
    },
    {
      title: 'Rate',
      dataIndex: 'retainerRate',
      key: 'rate',
      width: widths['rate'],
      render: (v) => (
        <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
          {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'HKD', currencyDisplay: 'code' }).format(v)}
        </span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: widths['status'],
      render: (_, r) => {
        const start = r.retainerStarts.toDate()
        const end = r.retainerEnds.toDate()
        let status
        if (today < start) status = getRetainerStatus(r, today)
        else if (today <= end) status = getRetainerStatus(r, today)
        else status = getRetainerStatus(r, today, nextFuture)
        return (
          <Tooltip title={status.label}>
            <span style={{ fontFamily: 'Newsreader', fontWeight: 500, color: colorMap[status.color] }}>
              {status.label}
            </span>
          </Tooltip>
        )
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: widths['actions'],
      render: (_, r) => (
        <Button size="small" onClick={() => setModal({ open: true, retainer: r })}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', textAlign: 'left' }}>
      <div style={{ flexGrow: 1, overflow: 'auto', padding: 8, paddingBottom: 64 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontFamily: 'Cantata One', textDecoration: 'underline' }}>
            Retainers
          </Text>
          <Tooltip title="Create Retainer">
            <Button
              type="text"
              icon={<CreateIcon />}
              aria-label="Create Retainer"
              onClick={() =>
                setModal({
                  open: true,
                  nextStart: rows[rows.length - 1]
                    ? rows[rows.length - 1].retainerEnds.toDate()
                    : undefined,
                })
              }
            />
          </Tooltip>
        </div>
        <Table
          size="small"
          columns={tableColumns}
          dataSource={sortedRows}
          rowKey="id"
          pagination={false}
          rowClassName={(r: RetRow) => {
            const start = r.retainerStarts.toDate()
            const end = r.retainerEnds.toDate()
            const active = today >= start && today <= end
            return active ? 'ant-table-row-selected' : ''
          }}
        />
        {modal.open && (
          <RetainerModal
            abbr={abbr}
            account={account}
            balanceDue={balanceDue}
            retainer={modal.retainer}
            nextStart={modal.nextStart}
            open={modal.open}
            onClose={(saved) => {
              setModal({ open: false })
              if (saved) load()
            }}
          />
        )}
      </div>
    </div>
  )
}

