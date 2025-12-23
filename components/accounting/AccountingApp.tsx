/**
 * Accounting App - General Ledger & Reports
 * Main component for the Accounting tab
 */

import React, { useState, useEffect, useCallback, useMemo } from "react"
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
  Tabs,
  Tag,
  Tooltip,
  Divider,
  Empty,
  App as AntdApp,
  Grid,
  Descriptions,
  Switch,
  Modal,
  Form,
  Input,
} from "antd"
import {
  ReloadOutlined,
  DollarOutlined,
  BookOutlined,
  FileTextOutlined,
  BankOutlined,
  BarChartOutlined,
  PieChartOutlined,
  TableOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
  PlusOutlined,
  FilterOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import type { DataProvider, BaseRecord, GetListResponse } from "@refinedev/core"
import dayjs from "dayjs"

import AppShell from "../layout/AppShell"

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ============================================================================
// Types
// ============================================================================

interface Account {
  code: string
  name: string
  type: "asset" | "liability" | "equity" | "revenue" | "expense"
  normalBalance: "debit" | "credit"
  linkedBankAccount?: string
  active: boolean
  isSystem: boolean
  createdAt: any
}

interface JournalLine {
  accountCode: string
  debit: number
  credit: number
  memo?: string
}

interface JournalEntry {
  id: string
  postingDate: any
  description: string
  status: "posted" | "void"
  source: {
    type: "invoice" | "manual" | "migration"
    path?: string
    event?: "ISSUED" | "PAID" | "ADJUSTMENT" | "VOID"
  }
  lines: JournalLine[]
  createdAt: any
  createdBy: string
}

interface TrialBalanceRow {
  accountCode: string
  accountName: string
  accountType: string
  debit: number
  credit: number
}

interface ProfitAndLossData {
  startDate: string
  endDate: string
  basis: string
  revenue: { accountCode: string; accountName: string; amount: number }[]
  expenses: { accountCode: string; accountName: string; amount: number }[]
  totalRevenue: number
  totalExpenses: number
  netIncome: number
}

interface BalanceSheetData {
  asOf: string
  basis: string
  assets: { accountCode: string; accountName: string; balance: number }[]
  liabilities: { accountCode: string; accountName: string; balance: number }[]
  equity: { accountCode: string; accountName: string; balance: number }[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
}

interface ARAgingRow {
  invoiceNumber: string
  projectId: string
  clientName: string
  invoiceDate: string
  dueDate: string
  amount: number
  daysOutstanding: number
  bucket: string
}

type AccountingBasis = "accrual" | "cash"

interface AccountingSettings {
  defaultBasis: AccountingBasis
  currency: string
  fiscalYearStartMonth: number
}

// Subsidiary type for multi-subsidiary support
interface SubsidiaryInfo {
  id: string
  abbr: string
  name: string
}

// Helper to format subsidiary selection display
const formatSubsidiarySelection = (
  selected: string[],
  availableSubsidiaries: SubsidiaryInfo[]
): { label: string; tooltip?: string } => {
  if (selected.length === 0 || selected.includes("all")) {
    const allNames = availableSubsidiaries.map((s) => s.name).join(", ")
    return { label: "All", tooltip: allNames || undefined }
  }
  if (selected.length <= 2) {
    const names = availableSubsidiaries
      .filter((s) => selected.includes(s.id))
      .map((s) => s.abbr)
      .join(", ")
    return { label: names || "Filter" }
  }
  const allNames = availableSubsidiaries
    .filter((s) => selected.includes(s.id))
    .map((s) => s.name)
    .join(", ")
  return { label: `${selected.length} subsidiaries`, tooltip: allNames }
}

// ============================================================================
// Data Provider
// ============================================================================

const accountingDataProvider: DataProvider = {
  getApiUrl: () => "/api",

  getList: async <TData extends BaseRecord = BaseRecord>({
    resource,
  }): Promise<GetListResponse<TData>> => {
    if (resource === "accounts") {
      const response = await fetch("/api/accounting/accounts", {
        credentials: "include",
      })
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      return {
        data: (data.accounts || []) as TData[],
        total: data.accounts?.length || 0,
      }
    }

    if (resource === "journals") {
      const response = await fetch("/api/accounting/journals", {
        credentials: "include",
      })
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      return {
        data: (data.entries || []) as TData[],
        total: data.entries?.length || 0,
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

const formatDate = (dateValue: any) => {
  if (!dateValue) return "-"

  try {
    // Firestore Timestamp with _seconds (serialized JSON)
    if (typeof dateValue._seconds === "number") {
      return dayjs.unix(dateValue._seconds).format("DD MMM YYYY")
    }
    // Firestore Timestamp with seconds (alternative format)
    if (typeof dateValue.seconds === "number") {
      return dayjs.unix(dateValue.seconds).format("DD MMM YYYY")
    }
    // Firestore Timestamp object with toDate()
    if (typeof dateValue.toDate === "function") {
      return dayjs(dateValue.toDate()).format("DD MMM YYYY")
    }
    // Object with toMillis (Firestore Timestamp)
    if (typeof dateValue.toMillis === "function") {
      return dayjs(dateValue.toMillis()).format("DD MMM YYYY")
    }
    // ISO string or Date object
    const parsed = dayjs(dateValue)
    if (parsed.isValid()) {
      return parsed.format("DD MMM YYYY")
    }
  } catch (e) {
    console.warn("[formatDate] Failed to parse date:", dateValue, e)
  }

  return "-"
}

const getAccountTypeColor = (type: string) => {
  switch (type) {
    case "asset":
      return "blue"
    case "liability":
      return "orange"
    case "equity":
      return "purple"
    case "revenue":
      return "green"
    case "expense":
      return "red"
    default:
      return "default"
  }
}

// Format journal entry description with styled segments
const formatDescription = (description: string, event?: string): React.ReactNode => {
  if (!description) return "-"

  const parts: React.ReactNode[] = []
  let key = 0

  // Tokenize the description to handle styling
  // Invoice number patterns (various formats)
  const invoicePattern = /\b(\d{4}-\d{3}-\d{4}(?:-?[a-z]+)?|INV-[\w-]+)\b/gi
  // Client name patterns: "to <client>" or "from <client>" at end of string
  const clientPattern = /\b(?:to|from)\s+(.+?)$/i

  // Extract client name if present
  const clientMatch = description.match(clientPattern)
  const clientName = clientMatch ? clientMatch[1].trim() : null

  // Find invoice numbers
  const invoiceMatches: { match: string; index: number }[] = []
  let match
  const invoiceRegex = new RegExp(invoicePattern.source, "gi")
  while ((match = invoiceRegex.exec(description)) !== null) {
    invoiceMatches.push({ match: match[0], index: match.index })
  }

  // Determine if this is a payment or issued entry
  const isPaid = event === "PAID" || /payment received/i.test(description)
  const isIssued = event === "ISSUED" || /^issued invoice/i.test(description) || /issued/i.test(description)
  // Client name color based on entry type
  const clientColor = isPaid ? "#52c41a" : isIssued ? "#1890ff" : undefined

  // Process the description piece by piece
  let currentIndex = 0

  // Helper to style text between currentIndex and targetIndex
  const processText = (text: string) => {
    // Check for action keywords
    // Style "Payment received" in green
    const paidMatch = text.match(/^(Payment received)/i)
    if (paidMatch && isPaid) {
      parts.push(
        <span key={key++} style={{ color: "#52c41a" }}>
          {paidMatch[0]}
        </span>
      )
      text = text.slice(paidMatch[0].length)
    }

    // Style "issued" anywhere in text in blue
    const issuedPattern = /\b(issued)\b/gi
    let issuedMatch
    const issuedRegex = new RegExp(issuedPattern.source, "gi")
    let lastEnd = 0
    const segments: React.ReactNode[] = []

    while ((issuedMatch = issuedRegex.exec(text)) !== null) {
      if (issuedMatch.index > lastEnd) {
        segments.push(<span key={key++}>{text.slice(lastEnd, issuedMatch.index)}</span>)
      }
      segments.push(
        <span key={key++} style={{ color: "#1890ff" }}>
          {issuedMatch[0]}
        </span>
      )
      lastEnd = issuedMatch.index + issuedMatch[0].length
    }

    if (segments.length > 0) {
      if (lastEnd < text.length) {
        segments.push(<span key={key++}>{text.slice(lastEnd)}</span>)
      }
      parts.push(...segments)
    } else if (text) {
      parts.push(<span key={key++}>{text}</span>)
    }
  }

  // Build styled output
  invoiceMatches.forEach((inv, i) => {
    // Text before this invoice number
    const beforeText = description.slice(currentIndex, inv.index)

    // Check if beforeText contains client name
    if (clientName && beforeText.includes(clientName)) {
      const clientIdx = beforeText.indexOf(clientName)
      processText(beforeText.slice(0, clientIdx))
      parts.push(
        <span key={key++} style={{ color: clientColor }}>
          {clientName}
        </span>
      )
      processText(beforeText.slice(clientIdx + clientName.length))
    } else {
      processText(beforeText)
    }

    // Style invoice number: bold with # prefix
    const displayInv = inv.match.startsWith("#") ? inv.match : `#${inv.match}`
    parts.push(
      <span key={key++} style={{ fontWeight: "bold" }}>
        {displayInv}
      </span>
    )

    currentIndex = inv.index + inv.match.length
  })

  // Handle remaining text after last invoice number
  const remainingText = description.slice(currentIndex)
  if (remainingText) {
    // Check if remaining text contains client name (likely "to/from ClientName")
    if (clientName && remainingText.includes(clientName)) {
      const clientIdx = remainingText.indexOf(clientName)
      processText(remainingText.slice(0, clientIdx))
      parts.push(
        <span key={key++} style={{ color: clientColor }}>
          {clientName}
        </span>
      )
      const afterClient = remainingText.slice(clientIdx + clientName.length)
      if (afterClient) {
        processText(afterClient)
      }
    } else {
      processText(remainingText)
    }
  }

  return parts.length > 0 ? <>{parts}</> : description
}

// ============================================================================
// Chart of Accounts Component
// ============================================================================

interface EditableAccountRow extends Account {
  isEditing?: boolean
}

const ACCOUNT_TYPE_OPTIONS = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
]

const ChartOfAccounts: React.FC<{
  accounts: Account[]
  loading: boolean
  onUpdateAccount: (code: string, updates: Partial<Account>) => Promise<void>
  onRefresh: () => void
  bankAccountNames?: Record<string, string>
}> = ({ accounts, loading, onUpdateAccount, onRefresh, bankAccountNames = {} }) => {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Account>>({})
  const [saving, setSaving] = useState(false)
  const { message } = AntdApp.useApp()

  const isEditing = (record: Account) => record.code === editingKey

  const handleEdit = (record: Account) => {
    setEditingKey(record.code)
    setEditValues({
      name: record.name,
      type: record.type,
      active: record.active,
    })
  }

  const handleCancel = () => {
    setEditingKey(null)
    setEditValues({})
  }

  const handleSave = async (code: string) => {
    try {
      setSaving(true)
      await onUpdateAccount(code, editValues)
      message.success("Account updated successfully")
      setEditingKey(null)
      setEditValues({})
      onRefresh()
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update account")
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<Account> = [
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      width: 100,
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      ellipsis: false,
      render: (name: string, record: Account) => {
        if (isEditing(record)) {
          return (
            <input
              type="text"
              value={editValues.name || ""}
              onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
              style={{
                width: "100%",
                padding: "4px 8px",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
              }}
            />
          )
        }
        // Use dynamic bank account name if available, otherwise fall back to stored name
        const displayName = record.linkedBankAccount && bankAccountNames[record.linkedBankAccount]
          ? bankAccountNames[record.linkedBankAccount]
          : name
        // Append linked bank tag if present (aligned right)
        if (record.linkedBankAccount) {
          return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{displayName}</span>
              <Tag icon={<BankOutlined />} style={{ marginLeft: 8, flexShrink: 0 }}>
                {record.linkedBankAccount}
              </Tag>
            </div>
          )
        }
        return displayName
      },
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 140,
      render: (type: string, record: Account) => {
        if (isEditing(record)) {
          return (
            <Select
              value={editValues.type}
              onChange={(value) => setEditValues({ ...editValues, type: value })}
              options={ACCOUNT_TYPE_OPTIONS}
              size="small"
              style={{ width: "100%" }}
            />
          )
        }
        return (
          <Tag color={getAccountTypeColor(type)}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Tag>
        )
      },
      filters: [
        { text: "Asset", value: "asset" },
        { text: "Liability", value: "liability" },
        { text: "Equity", value: "equity" },
        { text: "Revenue", value: "revenue" },
        { text: "Expense", value: "expense" },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "Normal Balance",
      dataIndex: "normalBalance",
      key: "normalBalance",
      width: 130,
      render: (balance: string) => (
        <Tag color={balance === "debit" ? "cyan" : "magenta"}>
          {balance.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "active",
      key: "active",
      width: 100,
      render: (active: boolean, record: Account) => {
        if (isEditing(record)) {
          return (
            <Switch
              checked={editValues.active}
              onChange={(checked) => setEditValues({ ...editValues, active: checked })}
              checkedChildren="Active"
              unCheckedChildren="Inactive"
              size="small"
            />
          )
        }
        return active ? (
          <Tag icon={<CheckCircleOutlined />} color="success">Active</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">Inactive</Tag>
        )
      },
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_, record: Account) => {
        if (isEditing(record)) {
          return (
            <Space size="small">
              <Button
                type="primary"
                size="small"
                onClick={() => handleSave(record.code)}
                loading={saving}
              >
                Save
              </Button>
              <Button size="small" onClick={handleCancel}>
                Cancel
              </Button>
            </Space>
          )
        }
        return (
          <Button
            type="link"
            size="small"
            onClick={() => handleEdit(record)}
            disabled={editingKey !== null}
          >
            Edit
          </Button>
        )
      },
    },
  ]

  return (
    <Table
      dataSource={accounts}
      columns={columns}
      rowKey="code"
      loading={loading}
      pagination={false}
      scroll={{ x: 900 }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No accounts found"
          />
        ),
      }}
    />
  )
}

// ============================================================================
// Add Account Modal Component
// ============================================================================

// Code ranges by account type
const CODE_RANGES: Record<string, { min: number; max: number; label: string }> = {
  asset: { min: 1000, max: 1999, label: "Assets (1000-1999)" },
  liability: { min: 2000, max: 2999, label: "Liabilities (2000-2999)" },
  equity: { min: 3000, max: 3999, label: "Equity (3000-3999)" },
  revenue: { min: 4000, max: 4999, label: "Revenue (4000-4999)" },
  expense: { min: 5000, max: 5999, label: "Expenses (5000-5999)" },
}

const getNextAvailableCode = (accounts: Account[], type: string): string => {
  const range = CODE_RANGES[type]
  if (!range) return ""

  const usedCodes = new Set(
    accounts
      .filter((a) => a.type === type)
      .map((a) => parseInt(a.code, 10))
      .filter((code) => !isNaN(code))
  )

  for (let code = range.min; code <= range.max; code++) {
    if (!usedCodes.has(code)) {
      return code.toString()
    }
  }

  return "" // No available codes
}

const AddAccountModal: React.FC<{
  open: boolean
  onClose: () => void
  accounts: Account[]
  onCreateAccount: (account: { code: string; name: string; type: string }) => Promise<void>
  onRefresh: () => void
}> = ({ open, onClose, accounts, onCreateAccount, onRefresh }) => {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const { message } = AntdApp.useApp()

  useEffect(() => {
    if (open) {
      form.resetFields()
      setSelectedType(null)
    }
  }, [open, form])

  const handleTypeChange = (type: string) => {
    setSelectedType(type)
    const suggestedCode = getNextAvailableCode(accounts, type)
    form.setFieldsValue({ code: suggestedCode })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await onCreateAccount(values)
      message.success("Account created successfully")
      onClose()
      onRefresh()
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const codeRange = selectedType ? CODE_RANGES[selectedType] : null

  return (
    <Modal
      title={
        <Space>
          <PlusOutlined />
          <span>Add New Account</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSubmit}>
          Create Account
        </Button>,
      ]}
      width={500}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="type"
          label="Account Type"
          rules={[{ required: true, message: "Please select an account type" }]}
          extra={codeRange ? `Code range: ${codeRange.label}` : undefined}
        >
          <Select
            placeholder="Select account type"
            options={ACCOUNT_TYPE_OPTIONS}
            onChange={handleTypeChange}
          />
        </Form.Item>

        <Form.Item
          name="code"
          label="Account Code"
          rules={[
            { required: true, message: "Please enter an account code" },
            {
              validator: (_, value) => {
                if (!value || !selectedType) return Promise.resolve()
                const range = CODE_RANGES[selectedType]
                const numValue = parseInt(value, 10)
                if (isNaN(numValue) || numValue < range.min || numValue > range.max) {
                  return Promise.reject(
                    new Error(`Code must be between ${range.min} and ${range.max} for ${selectedType} accounts`)
                  )
                }
                if (accounts.some((a) => a.code === value)) {
                  return Promise.reject(new Error("This code is already in use"))
                }
                return Promise.resolve()
              },
            },
          ]}
          extra="Auto-suggested based on account type"
        >
          <Input placeholder="e.g., 1000" disabled={!selectedType} />
        </Form.Item>

        <Form.Item
          name="name"
          label="Account Name"
          rules={[{ required: true, message: "Please enter an account name" }]}
        >
          <Input placeholder="e.g., Bank - HSBC Savings" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ============================================================================
// Journal Entries Component
// ============================================================================

const JournalEntriesTable: React.FC<{
  entries: JournalEntry[]
  loading: boolean
  onRefresh: () => void
}> = ({ entries, loading, onRefresh }) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])

  const columns: ColumnsType<JournalEntry> = [
    {
      title: "Date",
      dataIndex: "postingDate",
      key: "date",
      width: 120,
      render: (date) => formatDate(date),
      sorter: (a, b) => {
        const aTime = a.postingDate?._seconds || 0
        const bTime = b.postingDate?._seconds || 0
        return bTime - aTime
      },
      defaultSortOrder: "ascend",
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: false,
      render: (desc: string, record: JournalEntry) => formatDescription(desc, record.source.event),
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_, record) => {
        // If voided, show VOID tag
        if (record.status === "void") {
          return <Tag color="error">VOID</Tag>
        }
        // Otherwise show the event type (PAID/ISSUED) since posted is implied
        const event = record.source?.event
        if (event === "PAID") {
          return <Tag color="green">Paid</Tag>
        }
        if (event === "ISSUED") {
          return <Tag color="blue">Issued</Tag>
        }
        // Fallback for other events or no event
        return <Tag color="default">{event || "Posted"}</Tag>
      },
      filters: [
        { text: "Paid", value: "PAID" },
        { text: "Issued", value: "ISSUED" },
        { text: "Void", value: "void" },
      ],
      onFilter: (value, record) => {
        if (value === "void") return record.status === "void"
        return record.source?.event === value
      },
    },
    {
      title: "Total",
      key: "total",
      width: 130,
      align: "right",
      render: (_, record) => {
        const total = record.lines.reduce((sum, line) => sum + line.debit, 0)
        return <Text strong>{formatCurrency(total)}</Text>
      },
    },
  ]

  const expandedRowRender = (record: JournalEntry) => {
    const lineColumns: ColumnsType<JournalLine> = [
      {
        title: "Account",
        dataIndex: "accountCode",
        key: "accountCode",
        width: 100,
      },
      {
        title: "Memo",
        dataIndex: "memo",
        key: "memo",
        ellipsis: true,
      },
      {
        title: "Debit",
        dataIndex: "debit",
        key: "debit",
        width: 130,
        align: "right",
        render: (val: number) => (val > 0 ? formatCurrency(val) : "-"),
      },
      {
        title: "Credit",
        dataIndex: "credit",
        key: "credit",
        width: 130,
        align: "right",
        render: (val: number) => (val > 0 ? formatCurrency(val) : "-"),
      },
    ]

    return (
      <Table
        columns={lineColumns}
        dataSource={record.lines}
        rowKey={(_, index) => `${record.id}-line-${index}`}
        pagination={false}
        size="small"
        style={{ margin: "0 24px" }}
      />
    )
  }

  return (
    <Table
      dataSource={entries}
      columns={columns}
      rowKey="id"
      loading={loading}
      expandable={{
        expandedRowRender,
        expandedRowKeys,
        onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
      }}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      scroll={{ x: 900 }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No journal entries found"
          />
        ),
      }}
    />
  )
}

// ============================================================================
// Trial Balance Component
// ============================================================================

const TrialBalanceReport: React.FC<{
  basis: AccountingBasis
}> = ({ basis }) => {
  const [data, setData] = useState<TrialBalanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/accounting/reports?report=trial-balance&basis=${basis}`,
        { credentials: "include" }
      )
      const json = await response.json()
      if (json.error) throw new Error(json.error)
      setData(json.data?.rows || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report")
    } finally {
      setLoading(false)
    }
  }, [basis])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => ({
        debit: acc.debit + row.debit,
        credit: acc.credit + row.credit,
      }),
      { debit: 0, credit: 0 }
    )
  }, [data])

  const columns: ColumnsType<TrialBalanceRow> = [
    {
      title: "Account",
      dataIndex: "accountCode",
      key: "accountCode",
      width: 100,
    },
    {
      title: "Name",
      dataIndex: "accountName",
      key: "accountName",
      ellipsis: true,
    },
    {
      title: "Type",
      dataIndex: "accountType",
      key: "accountType",
      width: 120,
      render: (type: string) => (
        <Tag color={getAccountTypeColor(type)}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Tag>
      ),
    },
    {
      title: "Debit",
      dataIndex: "debit",
      key: "debit",
      width: 150,
      align: "right",
      render: (val: number) => (val > 0 ? formatCurrency(val) : "-"),
    },
    {
      title: "Credit",
      dataIndex: "credit",
      key: "credit",
      width: 150,
      align: "right",
      render: (val: number) => (val > 0 ? formatCurrency(val) : "-"),
    },
  ]

  if (error) {
    return <Alert type="error" message={error} showIcon />
  }

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Total Debits"
              value={totals.debit}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Total Credits"
              value={totals.credit}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Balance Check"
              value={isBalanced ? "Balanced" : "Out of Balance"}
              valueStyle={{ color: isBalanced ? "#52c41a" : "#ff4d4f" }}
              prefix={isBalanced ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="accountCode"
        loading={loading}
        pagination={false}
        scroll={{ x: 700 }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}>
                <Text strong>TOTAL</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <Text strong>{formatCurrency(totals.debit)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <Text strong>{formatCurrency(totals.credit)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  )
}

// ============================================================================
// Profit & Loss Component
// ============================================================================

const ProfitAndLossReport: React.FC<{
  basis: AccountingBasis
  dateRange: [dayjs.Dayjs, dayjs.Dayjs] | null
}> = ({ basis, dateRange }) => {
  const [data, setData] = useState<ProfitAndLossData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    if (!dateRange) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        report: "profit-and-loss",
        basis,
        startDate: dateRange[0].format("YYYY-MM-DD"),
        endDate: dateRange[1].format("YYYY-MM-DD"),
      })
      const response = await fetch(`/api/accounting/reports?${params}`, {
        credentials: "include",
      })
      const json = await response.json()
      if (json.error) throw new Error(json.error)
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report")
    } finally {
      setLoading(false)
    }
  }, [basis, dateRange])

  useEffect(() => {
    if (dateRange) fetchReport()
  }, [fetchReport, dateRange])

  if (!dateRange) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Select a date range to generate the report"
      />
    )
  }

  if (error) {
    return <Alert type="error" message={error} showIcon />
  }

  if (loading) {
    return <Spin />
  }

  if (!data) {
    return null
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Total Revenue"
              value={data.totalRevenue}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Total Expenses"
              value={data.totalExpenses}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#ff4d4f" }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Net Income"
              value={data.netIncome}
              precision={2}
              prefix="$"
              valueStyle={{ color: data.netIncome >= 0 ? "#52c41a" : "#ff4d4f" }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Revenue" size="small" style={{ marginBottom: 16 }}>
        <Table
          dataSource={data.revenue}
          columns={[
            { title: "Account", dataIndex: "accountCode", width: 100 },
            { title: "Name", dataIndex: "accountName" },
            {
              title: "Amount",
              dataIndex: "amount",
              align: "right",
              render: (val: number) => formatCurrency(val),
            },
          ]}
          rowKey="accountCode"
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <Text strong>Total Revenue</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <Text strong>{formatCurrency(data.totalRevenue)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>

      <Card title="Expenses" size="small">
        <Table
          dataSource={data.expenses}
          columns={[
            { title: "Account", dataIndex: "accountCode", width: 100 },
            { title: "Name", dataIndex: "accountName" },
            {
              title: "Amount",
              dataIndex: "amount",
              align: "right",
              render: (val: number) => formatCurrency(val),
            },
          ]}
          rowKey="accountCode"
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <Text strong>Total Expenses</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <Text strong>{formatCurrency(data.totalExpenses)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </div>
  )
}

// ============================================================================
// Balance Sheet Component
// ============================================================================

const BalanceSheetReport: React.FC<{
  basis: AccountingBasis
}> = ({ basis }) => {
  const [data, setData] = useState<BalanceSheetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/accounting/reports?report=balance-sheet&basis=${basis}`,
        { credentials: "include" }
      )
      const json = await response.json()
      if (json.error) throw new Error(json.error)
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report")
    } finally {
      setLoading(false)
    }
  }, [basis])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  if (error) {
    return <Alert type="error" message={error} showIcon />
  }

  if (loading) {
    return <Spin />
  }

  if (!data) {
    return null
  }

  const renderSection = (
    title: string,
    items: { accountCode: string; accountName: string; balance: number }[],
    total: number,
    color: string
  ) => (
    <Card title={title} size="small" style={{ marginBottom: 16 }}>
      <Table
        dataSource={items}
        columns={[
          { title: "Account", dataIndex: "accountCode", width: 100 },
          { title: "Name", dataIndex: "accountName" },
          {
            title: "Balance",
            dataIndex: "balance",
            align: "right",
            render: (val: number) => formatCurrency(val),
          },
        ]}
        rowKey="accountCode"
        pagination={false}
        size="small"
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={2}>
              <Text strong>Total {title}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
              <Text strong style={{ color }}>{formatCurrency(total)}</Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </Card>
  )

  const isBalanced =
    Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)) < 0.01

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Assets"
              value={data.totalAssets}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Liabilities"
              value={data.totalLiabilities}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Equity"
              value={data.totalEquity}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Balance Check"
              value={isBalanced ? "Balanced" : "Unbalanced"}
              valueStyle={{ color: isBalanced ? "#52c41a" : "#ff4d4f" }}
              prefix={isBalanced ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {renderSection("Assets", data.assets, data.totalAssets, "#1890ff")}
      {renderSection("Liabilities", data.liabilities, data.totalLiabilities, "#fa8c16")}
      {renderSection("Equity", data.equity, data.totalEquity, "#722ed1")}
    </div>
  )
}

// ============================================================================
// AR Aging Component
// ============================================================================

const ARAgingReport: React.FC = () => {
  const [data, setData] = useState<ARAgingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/accounting/reports?report=ar-aging", {
        credentials: "include",
      })
      const json = await response.json()
      if (json.error) throw new Error(json.error)
      setData(json.data?.invoices || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const bucketSummary = useMemo(() => {
    const buckets: Record<string, number> = {}
    data.forEach((row) => {
      buckets[row.bucket] = (buckets[row.bucket] || 0) + row.amount
    })
    return buckets
  }, [data])

  const totalAR = useMemo(
    () => data.reduce((sum, row) => sum + row.amount, 0),
    [data]
  )

  const columns: ColumnsType<ARAgingRow> = [
    {
      title: "Invoice",
      dataIndex: "invoiceNumber",
      key: "invoiceNumber",
      width: 130,
    },
    {
      title: "Client",
      dataIndex: "clientName",
      key: "clientName",
      ellipsis: true,
    },
    {
      title: "Invoice Date",
      dataIndex: "invoiceDate",
      key: "invoiceDate",
      width: 120,
      render: (val) => (val ? dayjs(val).format("DD MMM YYYY") : "-"),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 130,
      align: "right",
      render: (val: number) => formatCurrency(val),
    },
    {
      title: "Days Out",
      dataIndex: "daysOutstanding",
      key: "daysOutstanding",
      width: 100,
      align: "center",
    },
    {
      title: "Bucket",
      dataIndex: "bucket",
      key: "bucket",
      width: 120,
      render: (bucket: string) => {
        let color = "default"
        if (bucket === "Current") color = "green"
        else if (bucket === "1-30 Days") color = "blue"
        else if (bucket === "31-60 Days") color = "orange"
        else if (bucket === "61-90 Days") color = "volcano"
        else if (bucket === "90+ Days") color = "red"
        return <Tag color={color}>{bucket}</Tag>
      },
      filters: [
        { text: "Current", value: "Current" },
        { text: "1-30 Days", value: "1-30 Days" },
        { text: "31-60 Days", value: "31-60 Days" },
        { text: "61-90 Days", value: "61-90 Days" },
        { text: "90+ Days", value: "90+ Days" },
      ],
      onFilter: (value, record) => record.bucket === value,
    },
  ]

  if (error) {
    return <Alert type="error" message={error} showIcon />
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total AR"
              value={totalAR}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        {Object.entries(bucketSummary).map(([bucket, amount]) => (
          <Col span={6} key={bucket}>
            <Card size="small">
              <Statistic
                title={bucket}
                value={amount}
                precision={2}
                prefix="$"
              />
            </Card>
          </Col>
        ))}
      </Row>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="invoiceNumber"
        loading={loading}
        pagination={false}
        scroll={{ x: 800 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No outstanding invoices"
            />
          ),
        }}
      />
    </div>
  )
}

// ============================================================================
// Settings Modal Component
// ============================================================================

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

const CURRENCY_OPTIONS = [
  { value: "HKD", label: "HKD - Hong Kong Dollar" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "JPY", label: "JPY - Japanese Yen" },
]

const SettingsModal: React.FC<{
  open: boolean
  onClose: () => void
  settings: AccountingSettings | null
  onSave: (settings: AccountingSettings) => Promise<void>
}> = ({ open, onClose, settings, onSave }) => {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { message } = AntdApp.useApp()

  useEffect(() => {
    if (open && settings) {
      form.setFieldsValue(settings)
    }
  }, [open, settings, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await onSave(values)
      message.success("Settings saved successfully")
      onClose()
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          <span>Accounting Settings</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSubmit}>
          Save Settings
        </Button>,
      ]}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={settings || { defaultBasis: "accrual", currency: "HKD", fiscalYearStartMonth: 4 }}
      >
        <Form.Item
          name="defaultBasis"
          label="Default Accounting Basis"
          tooltip="Accrual basis records revenue when earned; Cash basis records when payment is received"
          rules={[{ required: true, message: "Please select a basis" }]}
        >
          <Select
            options={[
              { value: "accrual", label: "Accrual Basis" },
              { value: "cash", label: "Cash Basis" },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="currency"
          label="Default Currency"
          rules={[{ required: true, message: "Please select a currency" }]}
        >
          <Select options={CURRENCY_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="fiscalYearStartMonth"
          label="Fiscal Year Start Month"
          tooltip="Hong Kong tax year starts in April (month 4)"
          rules={[{ required: true, message: "Please select a month" }]}
        >
          <Select options={MONTH_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ============================================================================
// Main Accounting Content Component
// ============================================================================

const AccountingContent: React.FC = () => {
  const screens = Grid.useBreakpoint()
  const { message } = AntdApp.useApp()

  const [activeTab, setActiveTab] = useState("coa")
  const [basis, setBasis] = useState<AccountingBasis>("accrual")
  const [accounts, setAccounts] = useState<Account[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false)
  const [settings, setSettings] = useState<AccountingSettings | null>(null)
  // Subsidiary filter - default to all (will be set after fetch)
  const [selectedSubsidiaries, setSelectedSubsidiaries] = useState<string[]>([])
  const [availableSubsidiaries, setAvailableSubsidiaries] = useState<SubsidiaryInfo[]>([])
  // Bank account display names for COA (dynamically fetched)
  const [bankAccountNames, setBankAccountNames] = useState<Record<string, string>>({})

  // Compute subsidiary display
  const subsidiaryDisplay = useMemo(
    () => formatSubsidiarySelection(selectedSubsidiaries, availableSubsidiaries),
    [selectedSubsidiaries, availableSubsidiaries]
  )

  const [pnlDateRange, setPnlDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(() => {
    // Default to current fiscal year (April to now)
    const now = dayjs()
    const fiscalYearStart = now.month() >= 3
      ? now.startOf("year").add(3, "month")
      : now.startOf("year").subtract(9, "month")
    return [fiscalYearStart, now]
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [accountsRes, journalsRes, settingsRes, subsidiariesRes] = await Promise.all([
        fetch("/api/accounting/accounts", { credentials: "include" }),
        fetch("/api/accounting/journals?limit=100", { credentials: "include" }),
        fetch("/api/accounting/settings", { credentials: "include" }),
        fetch("/api/accounting/subsidiaries", { credentials: "include" }),
      ])

      const accountsJson = await accountsRes.json()
      const journalsJson = await journalsRes.json()
      const settingsJson = await settingsRes.json()
      const subsidiariesJson = await subsidiariesRes.json()

      if (accountsJson.error) throw new Error(accountsJson.error)
      if (journalsJson.error) throw new Error(journalsJson.error)

      const fetchedAccounts = accountsJson.accounts || []
      setAccounts(fetchedAccounts)

      // Fetch bank account display names for linked accounts
      const linkedBankIds = fetchedAccounts
        .filter((acc: Account) => acc.linkedBankAccount)
        .map((acc: Account) => acc.linkedBankAccount)
        .filter(Boolean)

      if (linkedBankIds.length > 0) {
        try {
          const bankRes = await fetch(
            `/api/accounting/bank-accounts?ids=${encodeURIComponent(linkedBankIds.join(","))}`,
            { credentials: "include" }
          )
          const bankJson = await bankRes.json()
          if (bankJson.bankAccounts) {
            const names: Record<string, string> = {}
            for (const [id, info] of Object.entries(bankJson.bankAccounts)) {
              const bankInfo = info as { displayName: string }
              names[id] = bankInfo.displayName
            }
            setBankAccountNames(names)
          }
        } catch (bankErr) {
          console.warn("[AccountingApp] Failed to fetch bank account names:", bankErr)
        }
      }
      setJournalEntries(journalsJson.entries || [])

      // Set subsidiaries - default to first one if available
      const subs = subsidiariesJson.subsidiaries || []
      setAvailableSubsidiaries(subs)
      if (subs.length > 0 && selectedSubsidiaries.length === 0) {
        // Default to first subsidiary (usually ERL)
        setSelectedSubsidiaries([subs[0].id])
      }

      // Set settings and update basis from settings
      if (settingsJson.settings) {
        setSettings(settingsJson.settings)
        setBasis(settingsJson.settings.defaultBasis || "accrual")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [selectedSubsidiaries.length])

  const saveSettings = useCallback(async (newSettings: AccountingSettings) => {
    const response = await fetch("/api/accounting/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(newSettings),
    })
    const json = await response.json()
    if (json.error) throw new Error(json.error)
    setSettings(json.settings)
    setBasis(json.settings.defaultBasis || "accrual")
  }, [])

  const updateAccount = useCallback(async (code: string, updates: Partial<Account>) => {
    const response = await fetch(`/api/accounting/accounts?code=${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    })
    const json = await response.json()
    if (json.error) throw new Error(json.error)
    return json.account
  }, [])

  const createAccount = useCallback(async (account: { code: string; name: string; type: string }) => {
    const response = await fetch("/api/accounting/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(account),
    })
    const json = await response.json()
    if (json.error) throw new Error(json.error)
    return json.account
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = async () => {
    await fetchData()
    message.success("Data refreshed")
  }

  if (error) {
    return (
      <div style={{ padding: screens.md ? "32px 24px" : "16px" }}>
        <Alert
          type="error"
          message="Failed to load accounting data"
          description={error}
          showIcon
          action={<Button onClick={handleRefresh}>Retry</Button>}
        />
      </div>
    )
  }

  const tabItems = [
    {
      key: "coa",
      label: (
        <span>
          <BookOutlined style={{ marginRight: 8 }} />
          Chart of Accounts
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddAccountModalOpen(true)}
            >
              Add Account
            </Button>
          </div>
          <ChartOfAccounts
            accounts={accounts}
            loading={loading}
            onUpdateAccount={updateAccount}
            onRefresh={handleRefresh}
            bankAccountNames={bankAccountNames}
          />
          <AddAccountModal
            open={addAccountModalOpen}
            onClose={() => setAddAccountModalOpen(false)}
            accounts={accounts}
            onCreateAccount={createAccount}
            onRefresh={handleRefresh}
          />
        </div>
      ),
    },
    {
      key: "journals",
      label: (
        <span>
          <FileTextOutlined style={{ marginRight: 8 }} />
          Journal Entries
        </span>
      ),
      children: (
        <JournalEntriesTable
          entries={journalEntries}
          loading={loading}
          onRefresh={handleRefresh}
        />
      ),
    },
    {
      key: "trial-balance",
      label: (
        <span>
          <TableOutlined style={{ marginRight: 8 }} />
          Trial Balance
        </span>
      ),
      children: <TrialBalanceReport basis={basis} />,
    },
    {
      key: "pnl",
      label: (
        <span>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Profit & Loss
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text>Date Range:</Text>
              <RangePicker
                value={pnlDateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setPnlDateRange([dates[0], dates[1]])
                  }
                }}
              />
            </Space>
          </div>
          <ProfitAndLossReport basis={basis} dateRange={pnlDateRange} />
        </div>
      ),
    },
    {
      key: "balance-sheet",
      label: (
        <span>
          <PieChartOutlined style={{ marginRight: 8 }} />
          Balance Sheet
        </span>
      ),
      children: <BalanceSheetReport basis={basis} />,
    },
    {
      key: "ar-aging",
      label: (
        <span>
          <DollarOutlined style={{ marginRight: 8 }} />
          AR Aging
        </span>
      ),
      children: <ARAgingReport />,
    },
  ]

  return (
    <div style={{ padding: screens.md ? "32px 24px" : "16px" }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <DollarOutlined style={{ marginRight: 12 }} />
            Accounting
          </Title>
        </Col>
        <Col>
          <Space>
            {/* Subsidiary Filter - ERL only for now */}
            <Tooltip title="Multi-subsidiary filtering coming soon">
              <Select
                value={selectedSubsidiaries[0] || "erl"}
                onChange={(value) => {
                  setSelectedSubsidiaries([value])
                }}
                style={{ minWidth: 140 }}
                options={[
                  { value: "all", label: "All Subsidiaries" },
                  ...availableSubsidiaries.map((s) => ({
                    value: s.id,
                    label: `${s.abbr} - ${s.name}`,
                  })),
                ]}
                loading={loading && availableSubsidiaries.length === 0}
                suffixIcon={<FilterOutlined />}
              />
            </Tooltip>
            <Divider type="vertical" />
            <Text>Basis:</Text>
            <Select
              value={basis}
              onChange={(value) => setBasis(value)}
              style={{ width: 120 }}
              options={[
                { label: "Accrual", value: "accrual" },
                { label: "Cash", value: "cash" },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              Refresh
            </Button>
            <Tooltip title="Settings">
              <Button
                icon={<SettingOutlined />}
                onClick={() => setSettingsModalOpen(true)}
              />
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {/* Settings Modal */}
      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSave={saveSettings}
      />

      {/* Stats Summary */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Accounts"
              value={accounts.length}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Journal Entries"
              value={journalEntries.length}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Posted Entries"
              value={journalEntries.filter((e) => e.status === "posted").length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  )
}

// ============================================================================
// App Shell Wrapper
// ============================================================================

const ALLOWED_MENU_KEYS = [
  "dashboard",
  "client-directory",
  "projects",
  "finance",
  "accounting",
  "coaching-sessions",
  "tools",
] as const

const AccountingApp: React.FC = () => {
  return (
    <AppShell
      dataProvider={accountingDataProvider}
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
      <AccountingContent />
    </AppShell>
  )
}

export default AccountingApp
