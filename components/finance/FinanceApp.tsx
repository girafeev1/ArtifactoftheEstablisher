/**
 * Finance App - OCBC Banking Integration
 * Main component for the Finance tab
 */

import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Card,
  Table,
  Button,
  Select,
  DatePicker,
  Space,
  Statistic,
  Row,
  Col,
  Typography,
  Spin,
  Alert,
  Modal,
  Form,
  Input,
  InputNumber,
  Tag,
  Tooltip,
  Divider,
  Empty,
  App as AntdApp,
  Grid,
} from "antd"
import {
  ReloadOutlined,
  BankOutlined,
  SendOutlined,
  DownloadOutlined,
  PlusOutlined,
  LinkOutlined,
  DisconnectOutlined,
  SwapOutlined,
  UserOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import type { DataProvider, BaseRecord, GetListResponse } from "@refinedev/core"
import { useTable } from "@refinedev/antd"
import dayjs from "dayjs"

import AppShell from "../layout/AppShell"
import type {
  OCBCAccount,
  OCBCTransaction,
  OCBCBeneficiary,
  TransferType,
} from "../../lib/ocbc/types"

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ============================================================================
// Types
// ============================================================================

interface FinanceContentProps {}

interface TransferFormValues {
  fromAccountNo: string
  transferType: TransferType
  toAccountNo?: string
  beneficiaryId?: string
  fpsProxyType?: "MOBILE" | "EMAIL" | "FPSID"
  fpsProxyValue?: string
  amount: number
  currency: string
  reference?: string
  narrative?: string
}

// ============================================================================
// Data Provider
// ============================================================================

const financeDataProvider: DataProvider = {
  getApiUrl: () => "/api",

  getList: async <TData extends BaseRecord = BaseRecord>({
    resource,
  }): Promise<GetListResponse<TData>> => {
    if (resource === "ocbc-accounts") {
      const response = await fetch("/api/ocbc/accounts", {
        credentials: "include",
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch accounts")
      }
      return {
        data: (data.data || []) as TData[],
        total: data.data?.length || 0,
      }
    }

    if (resource === "ocbc-beneficiaries") {
      const response = await fetch("/api/ocbc/beneficiaries", {
        credentials: "include",
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch beneficiaries")
      }
      return {
        data: (data.data || []) as TData[],
        total: data.data?.length || 0,
      }
    }

    return { data: [], total: 0 }
  },

  getOne: () => Promise.reject(new Error("Not implemented")),
  getMany: () => Promise.reject(new Error("Not implemented")),
  create: () => Promise.reject(new Error("Not implemented")),
  update: () => Promise.reject(new Error("Not implemented")),
  deleteOne: () => Promise.reject(new Error("Not implemented")),
  deleteMany: () => Promise.reject(new Error("Not implemented")),
  updateMany: () => Promise.reject(new Error("Not implemented")),
  createMany: () => Promise.reject(new Error("Not implemented")),
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number, currency: string = "HKD") => {
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

const formatDate = (dateStr: string) => {
  return dayjs(dateStr).format("DD MMM YYYY")
}

// ============================================================================
// Account Summary Card Component
// ============================================================================

const AccountSummaryCard: React.FC<{
  account: OCBCAccount
  isSelected: boolean
  onSelect: () => void
}> = ({ account, isSelected, onSelect }) => {
  return (
    <Card
      hoverable
      onClick={onSelect}
      style={{
        borderColor: isSelected ? "#1890ff" : undefined,
        borderWidth: isSelected ? 2 : 1,
      }}
    >
      <Statistic
        title={
          <Space>
            <BankOutlined />
            <span>{account.accountType || "Account"}</span>
          </Space>
        }
        value={account.availableBalance}
        precision={2}
        prefix={account.currency}
        suffix={
          <Text type="secondary" style={{ fontSize: 14 }}>
            Available
          </Text>
        }
      />
      <Divider style={{ margin: "12px 0" }} />
      <Space direction="vertical" size={0}>
        <Text type="secondary">Account No: {account.accountNo}</Text>
        <Text type="secondary">
          Ledger Balance: {formatCurrency(account.balance, account.currency)}
        </Text>
      </Space>
    </Card>
  )
}

// ============================================================================
// Transaction Table Component
// ============================================================================

const TransactionTable: React.FC<{
  accountNo: string
  dateRange?: [string, string]
}> = ({ accountNo, dateRange }) => {
  const [transactions, setTransactions] = useState<OCBCTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    if (!accountNo) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ accountNo })
      if (dateRange) {
        params.set("startDate", dateRange[0])
        params.set("endDate", dateRange[1])
      }

      const response = await fetch(`/api/ocbc/transactions?${params}`, {
        credentials: "include",
      })
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch transactions")
      }

      setTransactions(data.data?.transactions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [accountNo, dateRange])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const columns: ColumnsType<OCBCTransaction> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      key: "date",
      width: 120,
      render: (date) => formatDate(date),
      sorter: (a, b) =>
        dayjs(a.transactionDate).unix() - dayjs(b.transactionDate).unix(),
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Reference",
      dataIndex: "reference",
      key: "reference",
      width: 150,
      ellipsis: true,
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 80,
      render: (type: string) => (
        <Tag color={type === "credit" ? "green" : "red"}>
          {type === "credit" ? "CR" : "DR"}
        </Tag>
      ),
      filters: [
        { text: "Credit", value: "credit" },
        { text: "Debit", value: "debit" },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 150,
      align: "right",
      render: (amount, record) => (
        <Text type={record.type === "credit" ? "success" : "danger"}>
          {record.type === "credit" ? "+" : "-"}
          {formatCurrency(Math.abs(amount), record.currency)}
        </Text>
      ),
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: "Balance",
      dataIndex: "runningBalance",
      key: "balance",
      width: 150,
      align: "right",
      render: (balance, record) =>
        balance !== undefined
          ? formatCurrency(balance, record.currency)
          : "-",
    },
  ]

  if (error) {
    return <Alert type="error" message={error} showIcon />
  }

  return (
    <Table
      dataSource={transactions}
      columns={columns}
      rowKey="transactionId"
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      scroll={{ x: 800 }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No transactions found"
          />
        ),
      }}
    />
  )
}

// ============================================================================
// Transfer Modal Component
// ============================================================================

const TransferModal: React.FC<{
  open: boolean
  onClose: () => void
  accounts: OCBCAccount[]
  beneficiaries: OCBCBeneficiary[]
  onSuccess: () => void
}> = ({ open, onClose, accounts, beneficiaries, onSuccess }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { message } = AntdApp.useApp()

  const transferType = Form.useWatch("transferType", form)

  const handleSubmit = async (values: TransferFormValues) => {
    setLoading(true)
    try {
      const response = await fetch("/api/ocbc/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      })
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Transfer failed")
      }

      message.success("Transfer initiated successfully")
      form.resetFields()
      onClose()
      onSuccess()
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Transfer failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <SendOutlined />
          <span>New Transfer</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          currency: "HKD",
          transferType: "FPS",
        }}
      >
        <Form.Item
          name="fromAccountNo"
          label="From Account"
          rules={[{ required: true, message: "Please select an account" }]}
        >
          <Select placeholder="Select account">
            {accounts.map((acc) => (
              <Select.Option key={acc.accountNo} value={acc.accountNo}>
                {acc.accountNo} - {acc.accountType} ({formatCurrency(acc.availableBalance, acc.currency)})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="transferType"
          label="Transfer Type"
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value="FPS">FPS (Instant)</Select.Option>
            <Select.Option value="CHATS">CHATS (Same Day)</Select.Option>
            <Select.Option value="INTERNAL">Internal Transfer</Select.Option>
          </Select>
        </Form.Item>

        {transferType === "FPS" && (
          <>
            <Form.Item name="beneficiaryId" label="Beneficiary">
              <Select placeholder="Select beneficiary or enter details below" allowClear>
                {beneficiaries.map((b) => (
                  <Select.Option key={b.beneficiaryId} value={b.beneficiaryId}>
                    {b.beneficiaryName} ({b.nickname || b.accountNo || b.fpsProxyValue})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="Or FPS Proxy" style={{ marginBottom: 0 }}>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item name="fpsProxyType" noStyle>
                  <Select style={{ width: 120 }} placeholder="Type">
                    <Select.Option value="MOBILE">Mobile</Select.Option>
                    <Select.Option value="EMAIL">Email</Select.Option>
                    <Select.Option value="FPSID">FPS ID</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="fpsProxyValue" noStyle>
                  <Input style={{ width: "calc(100% - 120px)" }} placeholder="Enter proxy value" />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
          </>
        )}

        {(transferType === "CHATS" || transferType === "INTERNAL") && (
          <Form.Item
            name="toAccountNo"
            label="To Account"
            rules={[{ required: true, message: "Please enter destination account" }]}
          >
            <Input placeholder="Enter account number" />
          </Form.Item>
        )}

        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              name="amount"
              label="Amount"
              rules={[
                { required: true, message: "Please enter amount" },
                { type: "number", min: 0.01, message: "Amount must be greater than 0" },
              ]}
            >
              <InputNumber
                style={{ width: "100%" }}
                precision={2}
                min={0.01}
                placeholder="0.00"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="HKD">HKD</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
                <Select.Option value="CNY">CNY</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="reference" label="Reference">
          <Input placeholder="Payment reference" maxLength={35} />
        </Form.Item>

        <Form.Item name="narrative" label="Remarks">
          <Input.TextArea rows={2} placeholder="Additional remarks" maxLength={140} />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SendOutlined />}>
              Send Transfer
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ============================================================================
// Main Finance Content Component
// ============================================================================

const FinanceContent: React.FC<FinanceContentProps> = () => {
  const screens = Grid.useBreakpoint()
  const { message } = AntdApp.useApp()

  // State
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [accounts, setAccounts] = useState<OCBCAccount[]>([])
  const [beneficiaries, setBeneficiaries] = useState<OCBCBeneficiary[]>([])
  const [selectedAccountNo, setSelectedAccountNo] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<[string, string] | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)

  // Handle URL query params for OAuth callback
  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const ocbcConnected = params.get('ocbc_connected')
    const oauthError = params.get('error')

    if (ocbcConnected === 'true') {
      message.success('Successfully connected to OCBC!')
      // Clean up URL
      window.history.replaceState(null, '', '/finance')
    }

    if (oauthError) {
      message.error(`OCBC connection failed: ${oauthError}`)
      // Clean up URL
      window.history.replaceState(null, '', '/finance')
    }
  }, [message])

  // Check OCBC connection status
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch("/api/ocbc/auth?action=status", {
        credentials: "include",
      })
      const data = await response.json()
      setIsConnected(data.data?.connected || false)
      return data.data?.connected || false
    } catch {
      setIsConnected(false)
      return false
    }
  }, [])

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/ocbc/accounts", {
        credentials: "include",
      })
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch accounts")
      }

      setAccounts(data.data || [])
      if (data.data?.length > 0 && !selectedAccountNo) {
        setSelectedAccountNo(data.data[0].accountNo)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [selectedAccountNo])

  // Fetch beneficiaries
  const fetchBeneficiaries = useCallback(async () => {
    try {
      const response = await fetch("/api/ocbc/beneficiaries", {
        credentials: "include",
      })
      const data = await response.json()
      if (data.success) {
        setBeneficiaries(data.data || [])
      }
    } catch {
      // Ignore beneficiary fetch errors
    }
  }, [])

  // Initial load
  useEffect(() => {
    const init = async () => {
      const connected = await checkConnection()
      if (connected) {
        await Promise.all([fetchAccounts(), fetchBeneficiaries()])
      } else {
        setLoading(false)
      }
    }
    init()
  }, [checkConnection, fetchAccounts, fetchBeneficiaries])

  // Handle OCBC connection
  const handleConnect = async () => {
    try {
      const response = await fetch("/api/ocbc/auth", {
        credentials: "include",
      })
      const data = await response.json()
      if (data.data?.authUrl) {
        window.location.href = data.data.authUrl
      }
    } catch (err) {
      message.error("Failed to initiate OCBC connection")
    }
  }

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await fetch("/api/ocbc/auth", {
        method: "DELETE",
        credentials: "include",
      })
      setIsConnected(false)
      setAccounts([])
      setBeneficiaries([])
      setSelectedAccountNo(null)
      message.success("Disconnected from OCBC")
    } catch {
      message.error("Failed to disconnect")
    }
  }

  // Handle refresh
  const handleRefresh = async () => {
    await Promise.all([fetchAccounts(), fetchBeneficiaries()])
    message.success("Data refreshed")
  }

  // If not connected, show connection prompt
  if (isConnected === false) {
    return (
      <div style={{ padding: screens.md ? "32px 24px" : "16px" }}>
        <Card>
          <Empty
            image={<BankOutlined style={{ fontSize: 64, color: "#ccc" }} />}
            description={
              <Space direction="vertical" align="center">
                <Title level={4}>Connect to OCBC</Title>
                <Text type="secondary">
                  Connect your OCBC corporate account to view balances, transactions, and make transfers.
                </Text>
              </Space>
            }
          >
            <Button type="primary" icon={<LinkOutlined />} size="large" onClick={handleConnect}>
              Connect OCBC Account
            </Button>
          </Empty>
        </Card>
      </div>
    )
  }

  // Loading state
  if (loading || isConnected === null) {
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Loading finance data...</Text>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div style={{ padding: screens.md ? "32px 24px" : "16px" }}>
        <Alert
          type="error"
          message="Failed to load finance data"
          description={error}
          showIcon
          action={
            <Button onClick={handleRefresh}>Retry</Button>
          }
        />
      </div>
    )
  }

  const selectedAccount = accounts.find((a) => a.accountNo === selectedAccountNo)

  return (
    <div style={{ padding: screens.md ? "32px 24px" : "16px" }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <BankOutlined style={{ marginRight: 12 }} />
            Finance
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => setTransferModalOpen(true)}
            >
              New Transfer
            </Button>
            <Tooltip title="Disconnect OCBC">
              <Button
                icon={<DisconnectOutlined />}
                danger
                onClick={handleDisconnect}
              />
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {/* Account Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {accounts.map((account) => (
          <Col key={account.accountNo} xs={24} sm={12} lg={8} xl={6}>
            <AccountSummaryCard
              account={account}
              isSelected={account.accountNo === selectedAccountNo}
              onSelect={() => setSelectedAccountNo(account.accountNo)}
            />
          </Col>
        ))}
      </Row>

      {/* Transactions Section */}
      {selectedAccount && (
        <Card
          title={
            <Space>
              <SwapOutlined />
              <span>Transactions - {selectedAccount.accountNo}</span>
            </Space>
          }
          extra={
            <Space>
              <RangePicker
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([
                      dates[0].format("YYYY-MM-DD"),
                      dates[1].format("YYYY-MM-DD"),
                    ])
                  } else {
                    setDateRange(undefined)
                  }
                }}
                style={{ width: 250 }}
              />
              <Button icon={<DownloadOutlined />}>Export</Button>
            </Space>
          }
        >
          <TransactionTable
            accountNo={selectedAccountNo!}
            dateRange={dateRange}
          />
        </Card>
      )}

      {/* Transfer Modal */}
      <TransferModal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        accounts={accounts}
        beneficiaries={beneficiaries}
        onSuccess={handleRefresh}
      />
    </div>
  )
}

// ============================================================================
// App Shell Wrapper
// ============================================================================

const ALLOWED_MENU_KEYS = ["dashboard", "client-directory", "projects", "finance", "accounting", "coaching-sessions", "tools"] as const

const FinanceApp: React.FC = () => {
  return (
    <AppShell
      dataProvider={financeDataProvider}
      resources={[
        { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
        {
          name: "client-directory",
          list: "/client-accounts",
          meta: { label: "Client Accounts" },
        },
        {
          name: "projects",
          list: "/projects",
          meta: { label: "Projects" },
        },
        {
          name: "finance",
          list: "/finance",
          meta: { label: "Finance" },
        },
        {
          name: "accounting",
          list: "/accounting",
          meta: { label: "Accounting" },
        },
        {
          name: "coaching-sessions",
          list: "/coaching-sessions",
          meta: { label: "Coaching Sessions" },
        },
        {
          name: "tools",
          list: "/tools",
          meta: { label: "Tools" },
        },
      ]}
      allowedMenuKeys={ALLOWED_MENU_KEYS}
    >
      <FinanceContent />
    </AppShell>
  )
}

export default FinanceApp
