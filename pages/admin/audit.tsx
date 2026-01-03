/**
 * Admin Audit Log Page
 *
 * View and search audit log entries.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import {
  Table,
  Card,
  Tag,
  Space,
  Typography,
  Input,
  Select,
  DatePicker,
  Button,
  Collapse,
  Descriptions,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

import { RBAC_ENABLED } from '../../lib/rbac/config'
import type { AuditLogEntry, AuditAction, AuditEntity } from '../../lib/rbac/types'

const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker
const { Panel } = Collapse

const ACTION_ICONS: Record<AuditAction, React.ReactNode> = {
  create: <PlusCircleOutlined style={{ color: '#52c41a' }} />,
  read: <EyeOutlined style={{ color: '#1890ff' }} />,
  update: <EditOutlined style={{ color: '#faad14' }} />,
  delete: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
}

const ACTION_COLORS: Record<AuditAction, string> = {
  create: 'green',
  read: 'blue',
  update: 'orange',
  delete: 'red',
}

const ENTITY_LABELS: Record<AuditEntity, string> = {
  user: 'User',
  project: 'Project',
  invoice: 'Invoice',
  transaction: 'Transaction',
  bank_account: 'Bank Account',
  session: 'Session',
  student: 'Student',
  receipt: 'Receipt',
}

interface AuditPageProps {
  initialLogs: AuditLogEntry[]
}

export default function AdminAuditPage({ initialLogs }: AuditPageProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  // Filters
  const [entityFilter, setEntityFilter] = useState<AuditEntity | ''>('')
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('')
  const [userSearch, setUserSearch] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  const fetchLogs = useCallback(async (loadMore = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (entityFilter) params.append('entity', entityFilter)
      if (actionFilter) params.append('action', actionFilter)
      if (userSearch) params.append('userId', userSearch)
      if (dateRange) {
        params.append('fromDate', dateRange[0].toISOString())
        params.append('toDate', dateRange[1].toISOString())
      }

      params.append('limit', '50')
      if (loadMore && logs.length > 0) {
        params.append('offset', String(logs.length))
      }

      const response = await fetch(`/api/admin/audit-logs?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch logs')
      }

      const data = await response.json()

      if (loadMore) {
        setLogs((prev) => [...prev, ...data.logs])
      } else {
        setLogs(data.logs)
      }
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setLoading(false)
    }
  }, [entityFilter, actionFilter, userSearch, dateRange, logs.length])

  const handleSearch = useCallback(() => {
    fetchLogs(false)
  }, [fetchLogs])

  const handleLoadMore = useCallback(() => {
    fetchLogs(true)
  }, [fetchLogs])

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: any) => {
        if (!timestamp) return '-'
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
        return d.toLocaleString()
      },
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: AuditAction) => (
        <Tag color={ACTION_COLORS[action]} icon={ACTION_ICONS[action]}>
          {action.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Entity',
      key: 'entity',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{ENTITY_LABELS[record.entity] || record.entity}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.entityId}
          </Text>
        </Space>
      ),
    },
    {
      title: 'User',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.userEmail}</Text>
          <Tag size="small">{record.userRole}</Tag>
        </Space>
      ),
    },
    {
      title: 'Changes',
      key: 'changes',
      render: (_, record) => {
        if (!record.changes?.length) {
          return record.action === 'create' ? (
            <Text type="secondary">New record created</Text>
          ) : record.action === 'delete' ? (
            <Text type="secondary">Record deleted</Text>
          ) : (
            <Text type="secondary">No changes recorded</Text>
          )
        }

        return (
          <Collapse ghost size="small">
            <Panel
              header={`${record.changes.length} field(s) changed`}
              key="1"
            >
              <Descriptions size="small" column={1} bordered>
                {record.changes.map((change, idx) => (
                  <Descriptions.Item key={idx} label={change.field}>
                    <div>
                      <Text delete type="secondary">
                        {formatValue(change.oldValue)}
                      </Text>
                      <br />
                      <Text>{formatValue(change.newValue)}</Text>
                    </div>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Panel>
          </Collapse>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Audit Log</Title>

      {!RBAC_ENABLED && (
        <Card style={{ marginBottom: 16, background: '#fffbe6', borderColor: '#ffe58f' }}>
          <Text>
            <strong>Note:</strong> RBAC enforcement is disabled, but audit logging is active.
          </Text>
        </Card>
      )}

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            placeholder="Entity Type"
            allowClear
            style={{ width: 150 }}
            value={entityFilter || undefined}
            onChange={(value: AuditEntity | undefined) => setEntityFilter(value || '')}
          >
            <Option value="user">User</Option>
            <Option value="project">Project</Option>
            <Option value="invoice">Invoice</Option>
            <Option value="transaction">Transaction</Option>
            <Option value="bank_account">Bank Account</Option>
            <Option value="session">Session</Option>
            <Option value="student">Student</Option>
          </Select>

          <Select
            placeholder="Action"
            allowClear
            style={{ width: 120 }}
            value={actionFilter || undefined}
            onChange={(value: AuditAction | undefined) => setActionFilter(value || '')}
          >
            <Option value="create">Create</Option>
            <Option value="read">Read</Option>
            <Option value="update">Update</Option>
            <Option value="delete">Delete</Option>
          </Select>

          <Input
            placeholder="User ID"
            prefix={<SearchOutlined />}
            value={userSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserSearch(e.target.value)}
            style={{ width: 200 }}
          />

          <RangePicker
            value={dateRange}
            onChange={(dates: [dayjs.Dayjs, dayjs.Dayjs] | null) => setDateRange(dates)}
          />

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={loading}
          >
            Search
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setEntityFilter('')
              setActionFilter('')
              setUserSearch('')
              setDateRange(null)
              fetchLogs(false)
            }}
          >
            Reset
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1000 }}
        />

        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button onClick={handleLoadMore} loading={loading}>
              Load More
            </Button>
          </div>
        )}

        {logs.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Text type="secondary">No audit logs found</Text>
          </div>
        )}
      </Card>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)'
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

export const getServerSideProps: GetServerSideProps<AuditPageProps> = async (ctx) => {
  const session = await getSession(ctx)

  if (!session?.user) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    }
  }

  // Fetch initial logs server-side
  try {
    const baseUrl = process.env.NEXTAUTH_URL || `http://${ctx.req.headers.host}`
    const response = await fetch(`${baseUrl}/api/admin/audit-logs?limit=50`, {
      headers: {
        cookie: ctx.req.headers.cookie || '',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch logs')
    }

    const data = await response.json()

    return {
      props: {
        initialLogs: data.logs || [],
      },
    }
  } catch (error) {
    console.error('[admin/audit] SSR error:', error)
    return {
      props: {
        initialLogs: [],
      },
    }
  }
}
