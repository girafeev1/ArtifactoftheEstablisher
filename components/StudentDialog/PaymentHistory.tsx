import React, { useEffect, useState } from 'react'
import { Typography, Table, Spin, Button, Popover, Checkbox, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FilterOutlined } from '@ant-design/icons'
import { collection, orderBy, query, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import PaymentDetail from './PaymentDetail'
import { titleFor } from './title'
import { PATHS, logPath } from '../../lib/paths'
import { CreateIcon } from './icons'
import PaymentModal from './PaymentModal'
import { useBilling } from '../../lib/billing/useBilling'
import { formatSessions } from '../../lib/billing/formatSessions'
import { truncateList } from '../../lib/payments/truncate'
import { useSession } from 'next-auth/react'
import { useColumnWidths } from '../../lib/useColumnWidths'
import { readColumnPrefs, writeColumnPrefs } from '../../lib/columnPrefs'

const { Text } = Typography

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'HKD',
    currencyDisplay: 'code',
  }).format(n)

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

interface PaymentRow {
  id: string
  amount?: number
  paymentMade?: any
  method?: string
  entity?: string
  identifier?: string
  refNumber?: string
  assignedSessions?: string[]
}

export default function PaymentHistory({
  abbr,
  account,
  onTitleChange,
  active,
}: {
  abbr: string
  account: string
  onTitleChange?: (title: string | null) => void
  active: boolean
}) {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any | null>(null)
  const [sortField, setSortField] = useState<'amount' | 'paymentMade'>('paymentMade')
  const [sortAsc, setSortAsc] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const { data: bill } = useBilling(abbr, account)
  const { data: session } = useSession()
  const userEmail = session?.user?.email || 'anon'
  const columnDefs = [
    { key: 'paymentMade', label: 'Date', width: 140 },
    { key: 'amount', label: 'Amount', width: 130 },
    { key: 'method', label: 'Method', width: 120 },
    { key: 'entity', label: 'Entity', width: 160 },
    { key: 'identifier', label: 'Bank Account', width: 160 },
    { key: 'refNumber', label: 'Reference #', width: 160 },
    { key: 'session', label: 'For Session(s)', width: 180 },
  ] as const
  const defaultVisible = columnDefs.reduce((acc, c) => {
    acc[c.key] = ['paymentMade', 'amount', 'session'].includes(c.key)
    return acc
  }, {} as Record<string, boolean>)
  const prefsKey = `pms:ph:cols:${userEmail}`
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    readColumnPrefs(prefsKey, defaultVisible),
  )
  useEffect(() => {
    setVisible(readColumnPrefs(prefsKey, defaultVisible))
  }, [prefsKey])
  const toggleCol = (k: string) => {
    const next = { ...visible, [k]: !visible[k] }
    setVisible(next)
    writeColumnPrefs(prefsKey, next)
  }
  const [filterOpen, setFilterOpen] = useState(false)
  const { widths } = useColumnWidths(
    'payments',
    columnDefs,
    userEmail,
  )

  const sessionMap = React.useMemo(() => {
    const m: Record<string, number> = {}
    bill?.rows?.forEach((r: any, i: number) => {
      m[r.id] = i + 1
    })
    return m
  }, [bill])

  useEffect(() => {
    if (active) onTitleChange?.(titleFor('billing', 'payment-history', account))
    else onTitleChange?.(null)
  }, [account, onTitleChange, active])

  useEffect(() => {
    const paymentsPath = PATHS.payments(abbr)
    logPath('payments', paymentsPath)
    const q = query(collection(db, paymentsPath), orderBy('paymentMade', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        setPayments(list)
        setLoading(false)
      },
      (e) => {
        console.error('load payments failed', e)
        setPayments([])
        setLoading(false)
      },
    )
    return () => unsub()
  }, [abbr])


  const ts = (v: any) => {
    if (!v) return 0
    const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v)
    return isNaN(d.getTime()) ? 0 : d.getTime()
  }
  const sortedPayments = [...payments].sort((a, b) => {
    const av = sortField === 'amount' ? Number(a.amount) || 0 : ts(a.paymentMade)
    const bv = sortField === 'amount' ? Number(b.amount) || 0 : ts(b.paymentMade)
    return sortAsc ? av - bv : bv - av
  })

  if (detail)
    return (
      <div style={{ height: '100%' }}>
        <PaymentDetail
          abbr={abbr}
          account={account}
          payment={detail}
          onBack={() => setDetail(null)}
          onTitleChange={onTitleChange}
        />
      </div>
    )

  const tableColumns: ColumnsType<PaymentRow> = []

  if (visible['paymentMade']) {
    tableColumns.push({
      title: 'Date',
      dataIndex: 'paymentMade',
      key: 'paymentMade',
      width: widths['paymentMade'],
      sorter: true,
      sortOrder: sortField === 'paymentMade' ? (sortAsc ? 'ascend' : 'descend') : undefined,
      render: (v: any) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{formatDate(v)}</span>,
    })
  }
  if (visible['amount']) {
    tableColumns.push({
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: widths['amount'],
      sorter: true,
      sortOrder: sortField === 'amount' ? (sortAsc ? 'ascend' : 'descend') : undefined,
      render: (v: number) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{formatCurrency(Number(v) || 0)}</span>,
    })
  }
  if (visible['method']) {
    tableColumns.push({
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      width: widths['method'],
      render: (v: string) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{v || '—'}</span>,
    })
  }
  if (visible['entity']) {
    tableColumns.push({
      title: 'Entity',
      dataIndex: 'entity',
      key: 'entity',
      width: widths['entity'],
      render: (v: string) => (
        <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
          {v ? (v === 'ME-ERL' ? 'Music Establish (ERL)' : v) : '—'}
        </span>
      ),
    })
  }
  if (visible['identifier']) {
    tableColumns.push({
      title: 'Bank Account',
      dataIndex: 'identifier',
      key: 'identifier',
      width: widths['identifier'],
      render: (v: string) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{v || '—'}</span>,
    })
  }
  if (visible['refNumber']) {
    tableColumns.push({
      title: 'Reference #',
      dataIndex: 'refNumber',
      key: 'refNumber',
      width: widths['refNumber'],
      render: (v: string) => <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>{v || '—'}</span>,
    })
  }
  if (visible['session']) {
    tableColumns.push({
      title: 'For Session(s)',
      key: 'session',
      width: widths['session'],
      render: (_: any, p: PaymentRow) => {
        const ords = (p.assignedSessions || [])
          .map((id: string) => sessionMap[id])
          .filter((n: number | undefined): n is number => typeof n === 'number')
          .sort((a: number, b: number) => a - b)
        const { visible: ordVisible, hiddenCount } = truncateList<number>(ords)
        return (
          <span style={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
            {formatSessions(ordVisible)}
            {hiddenCount > 0 && ' …'}
          </span>
        )
      },
    })
  }

  const filterContent = (
    <div style={{ padding: 8 }}>
      {columnDefs.map((c) => (
        <div key={c.key} style={{ marginBottom: 4 }}>
          <Checkbox
            checked={visible[c.key]}
            onChange={() => toggleCol(c.key)}
          >
            {c.label}
          </Checkbox>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flexGrow: 1, overflow: 'auto', padding: 16, paddingBottom: 64 }}>
        {loading ? (
          <Spin />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <Text style={{ fontFamily: 'Cantata One', textDecoration: 'underline', display: 'block' }}>
                  Payment History
                </Text>
                <Popover
                  content={filterContent}
                  title="Filter Columns"
                  trigger="click"
                  open={filterOpen}
                  onOpenChange={setFilterOpen}
                >
                  <Tooltip title="Filter Columns">
                    <Button
                      type="text"
                      icon={<FilterOutlined />}
                      aria-label="Filter Columns"
                      data-testid="filter-columns"
                      style={{ marginTop: 4 }}
                    />
                  </Tooltip>
                </Popover>
              </div>
              <Tooltip title="Create Payment">
                <Button
                  type="text"
                  icon={<CreateIcon />}
                  onClick={() => setModalOpen(true)}
                  aria-label="Create Payment"
                />
              </Tooltip>
            </div>
            <Table
              size="small"
              columns={tableColumns}
              dataSource={sortedPayments}
              rowKey="id"
              pagination={false}
              style={{ cursor: 'pointer' }}
              onRow={(p: PaymentRow) => ({
                onClick: () => setDetail(p),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setDetail(p)
                  }
                },
                role: 'button',
                tabIndex: 0,
              })}
              onChange={(_: any, __: any, sorter: any) => {
                if (sorter.field) {
                  const field = sorter.field as 'amount' | 'paymentMade'
                  if (sortField === field) {
                    setSortAsc(sorter.order === 'ascend')
                  } else {
                    setSortField(field)
                    setSortAsc(sorter.order === 'ascend')
                  }
                }
              }}
              locale={{ emptyText: 'No payments recorded.' }}
            />
          </>
        )}
      </div>
      <PaymentModal
        abbr={abbr}
        account={account}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
