/**
 * Bank Transactions Tab Component
 *
 * Displays and manages bank transactions for evidence-based payment tracking.
 * Supports manual entry and CSV import.
 */

import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  Table,
  Button,
  Space,
  Tag,
  Tooltip,
  Empty,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Upload,
  Alert,
  Descriptions,
  Row,
  Col,
  Card,
  Statistic,
  App as AntdApp,
} from "antd"
import {
  PlusOutlined,
  UploadOutlined,
  LinkOutlined,
  DeleteOutlined,
  EyeOutlined,
  BankOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  FilterOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import type { UploadFile } from "antd/es/upload/interface"
import { Resizable, ResizeCallbackData } from "react-resizable"
import dayjs from "dayjs"
import MatchInvoiceModal from "./MatchInvoiceModal"
import {
  parseBankAccountId,
  getPaymentMethodDisplay,
  formatAmountWithSign,
  ACCOUNT_TYPE_COLORS,
} from "@/lib/accounting/bankAccountUtils"

// ============================================================================
// Types
// ============================================================================

interface BankTransaction {
  id: string
  transactionDate: any
  amount: number
  isDebit?: boolean
  currency: string
  bankAccountId: string
  paymentMethod: string
  referenceNumber?: string
  payerName: string
  payerReference?: string
  displayName?: string
  originalDescription?: string
  accountCode?: string
  status: "unmatched" | "matched" | "partial" | "categorized"
  matchedInvoices?: {
    invoiceNumber: string
    projectId: string
    year: string
    amount: number
  }[]
  source: "manual" | "csv_import"
  importBatch?: {
    filename: string
    importedAt: any
  }
  subsidiaryId: string
  memo?: string
  createdAt: any
}

interface TransactionStats {
  totalTransactions: number
  totalAmount: number
  unmatchedCount: number
  unmatchedAmount: number
  matchedCount: number
  matchedAmount: number
  partialCount: number
  partialAmount: number
}

interface BankAccountInfo {
  id: string
  displayName: string
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
    if (typeof dateValue._seconds === "number") {
      return dayjs.unix(dateValue._seconds).format("DD MMM YYYY")
    }
    if (typeof dateValue.seconds === "number") {
      return dayjs.unix(dateValue.seconds).format("DD MMM YYYY")
    }
    const parsed = dayjs(dateValue)
    if (parsed.isValid()) {
      return parsed.format("DD MMM YYYY")
    }
  } catch {
    // Ignore
  }
  return "-"
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "matched":
      return "success"
    case "partial":
      return "warning"
    case "categorized":
      return "processing"
    case "unmatched":
      return "default"
    default:
      return "default"
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "matched":
      return <CheckCircleOutlined />
    case "partial":
      return <SyncOutlined />
    case "categorized":
      return <BankOutlined />
    case "unmatched":
      return <ExclamationCircleOutlined />
    default:
      return null
  }
}

// ============================================================================
// Resizable Title Component
// ============================================================================

interface ResizableTitleProps {
  width: number
  onResize: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
  onDoubleClick?: () => void
  children?: React.ReactNode
  [key: string]: any
}

const ResizableTitle: React.FC<ResizableTitleProps> = ({
  onResize,
  onDoubleClick,
  width,
  ...restProps
}) => {
  if (!width) {
    return <th {...restProps} />
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation()
            onDoubleClick?.()
          }}
          style={{
            position: "absolute",
            right: -5,
            bottom: 0,
            width: 10,
            height: "100%",
            cursor: "col-resize",
            zIndex: 1,
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  )
}

// ============================================================================
// Transaction Form Modal
// ============================================================================

const TransactionFormModal: React.FC<{
  open: boolean
  onClose: () => void
  onSubmit: (values: any) => Promise<void>
  bankAccounts: BankAccountInfo[]
  subsidiaryId: string
}> = ({ open, onClose, onSubmit, bankAccounts, subsidiaryId }) => {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { message } = AntdApp.useApp()

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({
        transactionDate: dayjs(),
        currency: "HKD",
        paymentMethod: "bank_transfer",
      })
    }
  }, [open, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await onSubmit({
        ...values,
        transactionDate: values.transactionDate.toDate(),
        subsidiaryId,
        source: "manual",
      })
      message.success("Transaction created successfully")
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
          <PlusOutlined />
          <span>Add Bank Transaction</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSubmit}>
          Create Transaction
        </Button>,
      ]}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="transactionDate"
              label="Transaction Date"
              rules={[{ required: true, message: "Date is required" }]}
            >
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="bankAccountId"
              label="Bank Account"
              rules={[{ required: true, message: "Bank account is required" }]}
            >
              <Select
                placeholder="Select bank account"
                options={bankAccounts.map((acc) => ({
                  value: acc.id,
                  label: acc.displayName,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="amount"
              label="Amount"
              rules={[{ required: true, message: "Amount is required" }]}
            >
              <InputNumber
                style={{ width: "100%" }}
                min={0.01}
                precision={2}
                prefix="$"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="currency"
              label="Currency"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "HKD", label: "HKD" },
                  { value: "USD", label: "USD" },
                  { value: "CNY", label: "CNY" },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="payerName"
              label="Payer Name"
              rules={[{ required: true, message: "Payer name is required" }]}
            >
              <Input placeholder="Who made the payment" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="paymentMethod" label="Payment Method">
              <Select
                options={[
                  { value: "bank_transfer", label: "Bank Transfer" },
                  { value: "check", label: "Check" },
                  { value: "cash", label: "Cash" },
                  { value: "credit_card", label: "Credit Card" },
                  { value: "other", label: "Other" },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="referenceNumber" label="Reference Number">
              <Input placeholder="Bank reference or check number" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="payerReference" label="Payer Reference">
              <Input placeholder="Customer's reference" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="memo" label="Memo">
          <Input.TextArea rows={2} placeholder="Additional notes" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ============================================================================
// CSV Import Modal
// ============================================================================

const CSVImportModal: React.FC<{
  open: boolean
  onClose: () => void
  onImport: (csv: string, options: any) => Promise<any>
  bankAccounts: BankAccountInfo[]
  subsidiaryId: string
}> = ({ open, onClose, onImport, bankAccounts, subsidiaryId }) => {
  const [form] = Form.useForm()
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [preview, setPreview] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClaudeImport, setIsClaudeImport] = useState(true)
  const { message } = AntdApp.useApp()

  useEffect(() => {
    if (open) {
      form.resetFields()
      setFileContent(null)
      setFileName("")
      setPreview(null)
      setError(null)
      setIsClaudeImport(true)
      form.setFieldsValue({
        preset: "generic",
        defaultCurrency: "HKD",
      })
    }
  }, [open, form])

  const handleFileChange = (info: { file: UploadFile; fileList: UploadFile[] }) => {
    // Only process when file is added (not on remove or other status changes)
    if (info.fileList.length === 0) {
      setFileContent(null)
      setFileName("")
      setPreview(null)
      return
    }

    const file = info.file.originFileObj || (info.file as any)
    if (!file || !(file instanceof Blob)) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setFileContent(content)
      setFileName(info.file.name || "import.csv")
      setError(null)
      // Auto-preview
      handlePreview(content)
    }
    reader.onerror = () => {
      setError("Failed to read file")
    }
    reader.readAsText(file)
  }

  const handlePreview = async (content?: string) => {
    const csv = content || fileContent
    if (!csv) return

    try {
      const values = form.getFieldsValue()
      const usingClaudeImport = values.preset === "generic"

      // Check if bank account is selected (not required for Claude Import)
      if (!values.bankAccountId && !usingClaudeImport) {
        setError("Please select a bank account first")
        setPreview(null)
        return
      }

      const response = await fetch("/api/accounting/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          csv,
          bankAccountId: values.bankAccountId || "",
          subsidiaryId,
          preset: values.preset,
          defaultCurrency: values.defaultCurrency,
          preview: true,
        }),
      })

      const json = await response.json()
      if (json.error) {
        setError(json.error)
        setPreview(null)
      } else {
        setPreview(json)
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed")
    }
  }

  const handleImport = async () => {
    if (!fileContent) {
      message.error("Please select a CSV file first")
      return
    }

    try {
      const values = form.getFieldsValue()
      const usingClaudeImport = values.preset === "generic"

      // For non-Claude imports, validate bank account
      if (!usingClaudeImport && !values.bankAccountId) {
        message.error("Please select a bank account")
        return
      }

      setImporting(true)

      const result = await onImport(fileContent, {
        bankAccountId: values.bankAccountId || "",
        subsidiaryId,
        preset: values.preset,
        defaultCurrency: values.defaultCurrency,
        filename: fileName,
      })

      message.success(`Successfully imported ${result.created} transactions`)
      onClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <UploadOutlined />
          <span>Import Bank Statement (CSV)</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="preview"
          onClick={() => handlePreview()}
          disabled={!fileContent}
        >
          Preview
        </Button>,
        <Button
          key="import"
          type="primary"
          loading={importing}
          onClick={handleImport}
          disabled={!fileContent || !preview || !!error}
        >
          Import Transactions
        </Button>,
      ]}
      width={700}
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="preset" label="Import Format">
              <Select
                options={[
                  { value: "generic", label: "Claude Import (Generic CSV)" },
                ]}
                onChange={(value) => {
                  setIsClaudeImport(value === "generic")
                  handlePreview()
                }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="defaultCurrency" label="Currency">
              <Select
                options={[
                  { value: "HKD", label: "HKD" },
                  { value: "USD", label: "USD" },
                  { value: "CNY", label: "CNY" },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        {!isClaudeImport && (
          <Form.Item
            name="bankAccountId"
            label="Bank Account"
            rules={[{ required: true, message: "Select the bank account" }]}
            extra={bankAccounts.length === 0 ? "No bank accounts found in directory database" : undefined}
          >
            <Select
              placeholder="Which bank is this statement from?"
              options={bankAccounts.map((acc) => ({
                value: acc.id,
                label: acc.displayName,
              }))}
              notFoundContent="No bank accounts found"
              onChange={(bankAccountId) => {
                // Re-trigger preview when bank account changes
                if (fileContent && bankAccountId) {
                  setError(null)
                  // Use setTimeout to allow form state to update
                  setTimeout(() => handlePreview(), 0)
                }
              }}
            />
          </Form.Item>
        )}

        <Form.Item label="CSV File">
          <Upload
            accept=".csv"
            maxCount={1}
            beforeUpload={() => false}
            onChange={handleFileChange}
            showUploadList={true}
          >
            <Button icon={<UploadOutlined />}>Select CSV File</Button>
          </Upload>
        </Form.Item>

        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

        {preview && (
          <Card size="small" title="Preview">
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="Valid Rows">{preview.rowCount}</Descriptions.Item>
              <Descriptions.Item label="Columns">{preview.columnCount}</Descriptions.Item>
              <Descriptions.Item label="Transactions">{preview.preview?.length || 0}</Descriptions.Item>
            </Descriptions>
            {preview.preview?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong>Sample Transactions:</strong>
                {preview.preview.slice(0, 3).map((row: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, marginTop: 4 }}>
                    {formatDate({ _seconds: row.transactionDate?.getTime?.() / 1000 || row.transactionDate })} -
                    {" "}{row.description?.substring(0, 50)} -
                    {" "}{formatCurrency(row.amount)}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </Form>
    </Modal>
  )
}

// ============================================================================
// Transaction Details Modal
// ============================================================================

const TransactionDetailsModal: React.FC<{
  transaction: BankTransaction | null
  open: boolean
  onClose: () => void
  onMatch: (transactionId: string) => void
}> = ({ transaction, open, onClose, onMatch }) => {
  if (!transaction) return null

  return (
    <Modal
      title={
        <Space>
          <BankOutlined />
          <span>Transaction Details</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        transaction.status !== "matched" && (
          <Button
            key="match"
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => {
              onMatch(transaction.id)
              onClose()
            }}
          >
            Match to Invoice
          </Button>
        ),
      ]}
      width={600}
    >
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="Date" span={1}>
          {formatDate(transaction.transactionDate)}
        </Descriptions.Item>
        <Descriptions.Item label="Amount" span={1}>
          <strong style={{ color: transaction.isDebit ? "#cf1322" : "#389e0d" }}>
            {transaction.isDebit ? "-" : "+"}{formatCurrency(transaction.amount, transaction.currency)}
          </strong>
          <Tag style={{ marginLeft: 8 }}>{transaction.isDebit ? "Debit" : "Credit"}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Payer" span={2}>
          {transaction.payerName}
        </Descriptions.Item>
        <Descriptions.Item label="Bank Account" span={1}>
          {transaction.bankAccountId}
        </Descriptions.Item>
        <Descriptions.Item label="Payment Method" span={1}>
          {transaction.paymentMethod.replace("_", " ")}
        </Descriptions.Item>
        <Descriptions.Item label="Reference" span={1}>
          {transaction.referenceNumber || "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Payer Reference" span={1}>
          {transaction.payerReference || "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Status" span={1}>
          <Tag color={getStatusColor(transaction.status)} icon={getStatusIcon(transaction.status)}>
            {transaction.status.toUpperCase()}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Source" span={1}>
          <Tag>{transaction.source === "csv_import" ? "CSV Import" : "Manual Entry"}</Tag>
        </Descriptions.Item>
        {transaction.memo && (
          <Descriptions.Item label="Memo" span={2}>
            {transaction.memo}
          </Descriptions.Item>
        )}
        {transaction.matchedInvoices && transaction.matchedInvoices.length > 0 && (
          <Descriptions.Item label="Matched Invoices" span={2}>
            <Space direction="vertical" size="small">
              {transaction.matchedInvoices.map((inv, i) => (
                <div key={i}>
                  #{inv.invoiceNumber} - {formatCurrency(inv.amount)}
                </div>
              ))}
            </Space>
          </Descriptions.Item>
        )}
      </Descriptions>
    </Modal>
  )
}

// ============================================================================
// Main Component
// ============================================================================

interface BankTransactionsTabProps {
  subsidiaryId: string
}

const BankTransactionsTab: React.FC<BankTransactionsTabProps> = ({
  subsidiaryId,
}) => {
  const { message } = AntdApp.useApp()
  const tableRef = useRef<HTMLDivElement>(null)

  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [stats, setStats] = useState<TransactionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [bankAccounts, setBankAccounts] = useState<BankAccountInfo[]>([])

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [matchModalOpen, setMatchModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null)

  // Bank account filter for Balance column
  const [bankAccountFilter, setBankAccountFilter] = useState<string | null>(null)

  // Column widths
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    date: 100,
    payerPayee: 180,
    amount: 120,
    method: 80,
    status: 100,
    bank: 60,
    accountType: 80,
    balance: 110,
    actions: 120,
  })

  const handleResize = (key: string) =>
    (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
      setColumnWidths((prev) => ({ ...prev, [key]: size.width }))
    }

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [transRes, statsRes, bankRes] = await Promise.all([
        fetch(`/api/accounting/transactions?subsidiaryId=${subsidiaryId}&limit=100`, {
          credentials: "include",
        }),
        fetch(`/api/accounting/transactions?stats=true&subsidiaryId=${subsidiaryId}`, {
          credentials: "include",
        }),
        fetch("/api/accounting/bank-accounts", { credentials: "include" }),
      ])

      const transJson = await transRes.json()
      const statsJson = await statsRes.json()
      const bankJson = await bankRes.json()

      if (transJson.transactions) {
        setTransactions(transJson.transactions)
      }
      if (statsJson.stats) {
        setStats(statsJson.stats)
      }
      if (bankJson.bankAccounts) {
        const accounts: BankAccountInfo[] = Object.entries(bankJson.bankAccounts).map(
          ([id, info]: [string, any]) => ({
            id,
            displayName: info.displayName,
          })
        )
        setBankAccounts(accounts)
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load transactions")
    } finally {
      setLoading(false)
    }
  }, [subsidiaryId, message])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Create transaction
  const handleCreateTransaction = async (values: any) => {
    const response = await fetch("/api/accounting/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(values),
    })
    const json = await response.json()
    if (json.error) throw new Error(json.error)
    await fetchData()
  }

  // Import CSV
  const handleImportCSV = async (csv: string, options: any) => {
    const response = await fetch("/api/accounting/transactions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ csv, ...options }),
    })
    const json = await response.json()
    if (json.error) throw new Error(json.error)
    await fetchData()
    return json
  }

  // Delete transaction
  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: "Delete Transaction",
      content: "Are you sure you want to delete this transaction? This cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const response = await fetch(`/api/accounting/transactions/${id}`, {
            method: "DELETE",
            credentials: "include",
          })
          if (!response.ok) {
            const json = await response.json()
            throw new Error(json.error || "Delete failed")
          }
          message.success("Transaction deleted")
          await fetchData()
        } catch (err) {
          message.error(err instanceof Error ? err.message : "Delete failed")
        }
      },
    })
  }

  // Handle opening match modal
  const handleOpenMatchModal = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction)
    setMatchModalOpen(true)
  }

  // Handle match submission
  const handleMatchSubmit = async (
    transactionId: string,
    invoices: { invoiceNumber: string; projectId: string; year: string; amount: number }[]
  ) => {
    const response = await fetch(`/api/accounting/transactions/${transactionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "match", invoices }),
    })
    const json = await response.json()
    if (json.error) throw new Error(json.error)
    await fetchData()
  }

  // Get unique bank accounts for filter dropdown
  const uniqueBankAccountIds = [...new Set(transactions.map((t) => t.bankAccountId))]

  // Calculate running balance for filtered transactions
  const getRunningBalance = (index: number, filteredTxs: BankTransaction[]) => {
    // Sort by date ascending for balance calculation
    const sorted = [...filteredTxs].sort((a, b) => {
      const aTime = a.transactionDate?._seconds || a.transactionDate?.seconds || 0
      const bTime = b.transactionDate?._seconds || b.transactionDate?.seconds || 0
      return aTime - bTime
    })
    let balance = 0
    for (let i = 0; i <= index; i++) {
      const tx = sorted[i]
      balance += tx.isDebit ? -tx.amount : tx.amount
    }
    return balance
  }

  // Filter transactions by bank account for balance calculation
  const filteredForBalance = bankAccountFilter
    ? transactions.filter((t) => t.bankAccountId === bankAccountFilter)
    : transactions

  // Table columns
  const columns: ColumnsType<BankTransaction> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      key: "date",
      width: columnWidths.date,
      render: formatDate,
      sorter: (a, b) => {
        const aTime = a.transactionDate?._seconds || a.transactionDate?.seconds || 0
        const bTime = b.transactionDate?._seconds || b.transactionDate?.seconds || 0
        return aTime - bTime
      },
      defaultSortOrder: "ascend",
      onHeaderCell: () => ({
        width: columnWidths.date,
        onResize: handleResize("date"),
      }),
    },
    {
      title: "Payer/Payee",
      dataIndex: "payerName",
      key: "payerPayee",
      width: columnWidths.payerPayee,
      ellipsis: true,
      render: (payerName: string, record: BankTransaction) => (
        <Tooltip title={record.originalDescription || record.memo || payerName}>
          <span>{record.displayName || payerName}</span>
        </Tooltip>
      ),
      onHeaderCell: () => ({
        width: columnWidths.payerPayee,
        onResize: handleResize("payerPayee"),
      }),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: columnWidths.amount,
      align: "right",
      render: (amount: number, record: BankTransaction) => {
        const { display, color } = formatAmountWithSign(amount, record.isDebit ?? false, record.currency)
        return <strong style={{ color }}>{display}</strong>
      },
      sorter: (a, b) => {
        const aVal = a.isDebit ? -a.amount : a.amount
        const bVal = b.isDebit ? -b.amount : b.amount
        return aVal - bVal
      },
      onHeaderCell: () => ({
        width: columnWidths.amount,
        onResize: handleResize("amount"),
      }),
    },
    {
      title: "Method",
      dataIndex: "paymentMethod",
      key: "method",
      width: columnWidths.method,
      render: (method: string, record: BankTransaction) => (
        <Tag>{getPaymentMethodDisplay(method, record.originalDescription || record.memo)}</Tag>
      ),
      filters: [
        { text: "Transfer", value: "bank_transfer" },
        { text: "Cheque", value: "check" },
        { text: "Cash", value: "cash" },
        { text: "Card", value: "credit_card" },
        { text: "Other", value: "other" },
      ],
      onFilter: (value, record) => record.paymentMethod === value,
      onHeaderCell: () => ({
        width: columnWidths.method,
        onResize: handleResize("method"),
      }),
    },
    {
      title: "Bank",
      key: "bank",
      width: columnWidths.bank,
      render: (_, record: BankTransaction) => {
        const parsed = parseBankAccountId(record.bankAccountId)
        return (
          <Tooltip title={parsed.bankFullName}>
            <span>{parsed.bankAbbr}</span>
          </Tooltip>
        )
      },
      filters: uniqueBankAccountIds.map((id) => {
        const parsed = parseBankAccountId(id)
        return { text: parsed.bankAbbr, value: parsed.bank }
      }).filter((v, i, a) => a.findIndex(t => t.value === v.value) === i),
      onFilter: (value, record) => parseBankAccountId(record.bankAccountId).bank === value,
      onHeaderCell: () => ({
        width: columnWidths.bank,
        onResize: handleResize("bank"),
      }),
    },
    {
      title: "Account",
      key: "accountType",
      width: columnWidths.accountType,
      render: (_, record: BankTransaction) => {
        const parsed = parseBankAccountId(record.bankAccountId)
        return (
          <Tag color={ACCOUNT_TYPE_COLORS[parsed.accountType] || "default"}>
            {parsed.accountTypeLabel}
          </Tag>
        )
      },
      filters: [
        { text: "Savings", value: "S" },
        { text: "Current", value: "C" },
      ],
      onFilter: (value, record) => parseBankAccountId(record.bankAccountId).accountType === value,
      onHeaderCell: () => ({
        width: columnWidths.accountType,
        onResize: handleResize("accountType"),
      }),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: columnWidths.status,
      render: (status: string) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
      filters: [
        { text: "Unmatched", value: "unmatched" },
        { text: "Matched", value: "matched" },
        { text: "Partial", value: "partial" },
        { text: "Categorized", value: "categorized" },
      ],
      onFilter: (value, record) => record.status === value,
      onHeaderCell: () => ({
        width: columnWidths.status,
        onResize: handleResize("status"),
      }),
    },
    // Balance column - only show when filtered to single bank account
    ...(bankAccountFilter
      ? [
          {
            title: "Balance",
            key: "balance",
            width: columnWidths.balance,
            align: "right" as const,
            render: (_: any, record: BankTransaction, index: number) => {
              const balance = getRunningBalance(index, filteredForBalance)
              return (
                <span style={{ color: balance >= 0 ? "#389e0d" : "#cf1322" }}>
                  {formatCurrency(Math.abs(balance), record.currency)}
                </span>
              )
            },
            onHeaderCell: () => ({
              width: columnWidths.balance,
              onResize: handleResize("balance"),
            }),
          },
        ]
      : []),
    {
      title: "Actions",
      key: "actions",
      width: columnWidths.actions,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedTransaction(record)
                setDetailsModalOpen(true)
              }}
            />
          </Tooltip>
          {record.status !== "matched" && (
            <Tooltip title="Match to Invoice">
              <Button
                type="text"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => handleOpenMatchModal(record)}
              />
            </Tooltip>
          )}
          {record.status === "unmatched" && (
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
      onHeaderCell: () => ({
        width: columnWidths.actions,
        onResize: handleResize("actions"),
      }),
    },
  ]

  return (
    <div>
      {/* Stats */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Total Transactions"
                value={stats.totalTransactions}
                suffix={`/ ${formatCurrency(stats.totalAmount)}`}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Unmatched"
                value={stats.unmatchedCount}
                valueStyle={{ color: "#faad14" }}
                suffix={`/ ${formatCurrency(stats.unmatchedAmount)}`}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Matched"
                value={stats.matchedCount}
                valueStyle={{ color: "#52c41a" }}
                suffix={`/ ${formatCurrency(stats.matchedAmount)}`}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Partial"
                value={stats.partialCount}
                valueStyle={{ color: "#1890ff" }}
                suffix={`/ ${formatCurrency(stats.partialAmount)}`}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Actions */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Space>
          <FilterOutlined style={{ color: "#8c8c8c" }} />
          <Select
            placeholder="Filter by Bank Account"
            allowClear
            style={{ width: 200 }}
            value={bankAccountFilter}
            onChange={(value) => setBankAccountFilter(value || null)}
            options={[
              { value: null, label: "All Bank Accounts" },
              ...uniqueBankAccountIds.map((id) => {
                const parsed = parseBankAccountId(id)
                return {
                  value: id,
                  label: `${parsed.bankAbbr} ${parsed.accountTypeLabel}`,
                }
              }),
            ]}
          />
          {bankAccountFilter && (
            <Tag color="blue">Balance column enabled</Tag>
          )}
        </Space>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
            Import CSV
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
            Add Transaction
          </Button>
        </Space>
      </div>

      {/* Table */}
      <div ref={tableRef} className="accounting-table">
        <Table
          dataSource={transactions}
          columns={columns}
          components={{
            header: {
              cell: ResizableTitle,
            },
          }}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No transactions yet"
              >
                <Space>
                  <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
                    Import CSV
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
                    Add Transaction
                  </Button>
                </Space>
              </Empty>
            ),
          }}
        />
      </div>

      {/* Modals */}
      <TransactionFormModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleCreateTransaction}
        bankAccounts={bankAccounts}
        subsidiaryId={subsidiaryId}
      />

      <CSVImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportCSV}
        bankAccounts={bankAccounts}
        subsidiaryId={subsidiaryId}
      />

      <TransactionDetailsModal
        transaction={selectedTransaction}
        open={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false)
          setSelectedTransaction(null)
        }}
        onMatch={(id) => {
          const tx = transactions.find((t) => t.id === id)
          if (tx) handleOpenMatchModal(tx)
        }}
      />

      <MatchInvoiceModal
        open={matchModalOpen}
        transaction={selectedTransaction}
        onClose={() => {
          setMatchModalOpen(false)
          setSelectedTransaction(null)
        }}
        onMatch={handleMatchSubmit}
        subsidiaryId={subsidiaryId}
      />
    </div>
  )
}

export default BankTransactionsTab
