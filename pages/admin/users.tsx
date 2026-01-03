/**
 * Admin Users Page
 *
 * Manage user accounts, approve pending users, and assign roles.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import {
  Table,
  Card,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Select,
  message,
  Typography,
  Statistic,
  Row,
  Col,
  Input,
  Tooltip,
  Badge,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

import { RBAC_ENABLED } from '../../lib/rbac/config'
import {
  ROLE_LABELS,
  ROLE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../../lib/rbac/types'
import type { UserProfile, UserRole, UserStatus } from '../../lib/rbac/types'

const { Title, Text } = Typography
const { Option } = Select

interface UsersPageProps {
  initialUsers: UserProfile[]
  initialCounts: Record<UserStatus, number>
}

export default function AdminUsersPage({ initialUsers, initialCounts }: UsersPageProps) {
  const [users, setUsers] = useState<UserProfile[]>(initialUsers)
  const [counts, setCounts] = useState<Record<UserStatus, number>>(initialCounts)
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all')
  const [approveModalVisible, setApproveModalVisible] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [form] = Form.useForm()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      setUsers(data.users)
      setCounts(data.counts)
    } catch (error) {
      message.error('Failed to load users')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    // Don't fetch on mount since we have initial data
    // Only fetch when filter changes
  }, [])

  const handleApprove = useCallback((user: UserProfile) => {
    setSelectedUser(user)
    form.setFieldsValue({ role: 'viewer' })
    setApproveModalVisible(true)
  }, [form])

  const handleApproveSubmit = useCallback(async () => {
    if (!selectedUser) return

    try {
      const values = await form.validateFields()
      const response = await fetch(`/api/admin/users/${selectedUser.uid}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: values.role }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve user')
      }

      message.success(`${selectedUser.displayName || selectedUser.email} approved as ${ROLE_LABELS[values.role as UserRole]}`)
      setApproveModalVisible(false)
      setSelectedUser(null)
      fetchUsers()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to approve user')
    }
  }, [selectedUser, form, fetchUsers])

  const handleSuspend = useCallback(async (user: UserProfile) => {
    Modal.confirm({
      title: 'Suspend User',
      content: `Are you sure you want to suspend ${user.displayName || user.email}?`,
      okText: 'Suspend',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await fetch(`/api/admin/users/${user.uid}`, {
            method: 'DELETE',
          })

          if (!response.ok) {
            throw new Error('Failed to suspend user')
          }

          message.success('User suspended')
          fetchUsers()
        } catch (error) {
          message.error('Failed to suspend user')
        }
      },
    })
  }, [fetchUsers])

  const handleReactivate = useCallback(async (user: UserProfile) => {
    try {
      const response = await fetch(`/api/admin/users/${user.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })

      if (!response.ok) {
        throw new Error('Failed to reactivate user')
      }

      message.success('User reactivated')
      fetchUsers()
    } catch (error) {
      message.error('Failed to reactivate user')
    }
  }, [fetchUsers])

  const filteredUsers = users.filter((user) => {
    if (searchText) {
      const search = searchText.toLowerCase()
      const matchesSearch =
        user.email?.toLowerCase().includes(search) ||
        user.displayName?.toLowerCase().includes(search)
      if (!matchesSearch) return false
    }
    return true
  })

  const columns: ColumnsType<UserProfile> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <Space>
          {record.photoURL ? (
            <img
              src={record.photoURL}
              alt=""
              style={{ width: 32, height: 32, borderRadius: '50%' }}
            />
          ) : (
            <UserOutlined style={{ fontSize: 24, color: '#ccc' }} />
          )}
          <div>
            <div>{record.displayName || 'No name'}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole) => (
        <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
      ),
      filters: [
        { text: 'Pending', value: 'pending' },
        { text: 'Admin', value: 'admin' },
        { text: 'Accounting', value: 'accounting' },
        { text: 'Projects', value: 'projects' },
        { text: 'Viewer', value: 'viewer' },
        { text: 'Vendor', value: 'vendor' },
      ],
      onFilter: (value, record) => record.role === value,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: UserStatus) => (
        <Badge
          status={status === 'active' ? 'success' : status === 'pending' ? 'warning' : 'error'}
          text={STATUS_LABELS[status]}
        />
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: any) => {
        if (!date) return '-'
        const d = date.toDate ? date.toDate() : new Date(date)
        return d.toLocaleDateString()
      },
      sorter: (a, b) => {
        const dateA = a.createdAt ? (a.createdAt as any).toDate?.() || new Date(a.createdAt as any) : new Date(0)
        const dateB = b.createdAt ? (b.createdAt as any).toDate?.() || new Date(b.createdAt as any) : new Date(0)
        return dateA.getTime() - dateB.getTime()
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Tooltip title="Approve">
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record)}
              >
                Approve
              </Button>
            </Tooltip>
          )}
          {record.status === 'active' && record.role !== 'admin' && (
            <Tooltip title="Suspend">
              <Button
                danger
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => handleSuspend(record)}
              >
                Suspend
              </Button>
            </Tooltip>
          )}
          {record.status === 'suspended' && (
            <Button
              size="small"
              onClick={() => handleReactivate(record)}
            >
              Reactivate
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>User Management</Title>

      {!RBAC_ENABLED && (
        <Card style={{ marginBottom: 16, background: '#fffbe6', borderColor: '#ffe58f' }}>
          <Text>
            <strong>Note:</strong> RBAC enforcement is currently disabled.
            Users can be managed but access restrictions are not enforced.
          </Text>
        </Card>
      )}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pending Approval"
              value={counts.pending || 0}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Users"
              value={counts.active || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Suspended"
              value={counts.suspended || 0}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={(counts.pending || 0) + (counts.active || 0) + (counts.suspended || 0)}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="Search by name or email"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          <Select
            value={statusFilter}
            onChange={(value: UserStatus | 'all') => {
              setStatusFilter(value)
              // Will trigger fetch on next render if needed
            }}
            style={{ width: 150 }}
          >
            <Option value="all">All Status</Option>
            <Option value="pending">Pending</Option>
            <Option value="active">Active</Option>
            <Option value="suspended">Suspended</Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchUsers}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="uid"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="Approve User"
        open={approveModalVisible}
        onOk={handleApproveSubmit}
        onCancel={() => {
          setApproveModalVisible(false)
          setSelectedUser(null)
        }}
        okText="Approve"
      >
        {selectedUser && (
          <div style={{ marginBottom: 16 }}>
            <Text>
              Approving: <strong>{selectedUser.displayName || selectedUser.email}</strong>
            </Text>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            name="role"
            label="Assign Role"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select>
              <Option value="viewer">Viewer (Read-only)</Option>
              <Option value="projects">Projects (Project management)</Option>
              <Option value="accounting">Accounting (Finance access)</Option>
              <Option value="admin">Admin (Full access)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<UsersPageProps> = async (ctx) => {
  const session = await getSession(ctx)

  if (!session?.user) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    }
  }

  // Fetch initial data server-side
  try {
    const baseUrl = process.env.NEXTAUTH_URL || `http://${ctx.req.headers.host}`
    const response = await fetch(`${baseUrl}/api/admin/users`, {
      headers: {
        cookie: ctx.req.headers.cookie || '',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch users')
    }

    const data = await response.json()

    return {
      props: {
        initialUsers: data.users || [],
        initialCounts: data.counts || { pending: 0, active: 0, suspended: 0 },
      },
    }
  } catch (error) {
    console.error('[admin/users] SSR error:', error)
    return {
      props: {
        initialUsers: [],
        initialCounts: { pending: 0, active: 0, suspended: 0 },
      },
    }
  }
}
