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
  Segmented,
  Popover,
  Collapse,
  Spin,
  Progress,
  Image,
  App as AntdApp,
} from "antd"
import {
  PlusOutlined,
  UploadOutlined,
  LinkOutlined,
  BankOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  FilterOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  DisconnectOutlined,
  FileTextOutlined,
  AccountBookOutlined,
  CloudOutlined,
  PaperClipOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
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
} from "../../lib/accounting/bankAccountUtils"
import type { GCPTransactionEvidence } from "../../lib/gcpBilling/types"

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
  // Credit stats (isDebit === false, incoming payments)
  creditCount: number
  creditAmount: number
  unmatchedCreditCount: number
  unmatchedCreditAmount: number
  matchedCreditCount: number
  matchedCreditAmount: number
  partialCreditCount: number
  partialCreditAmount: number

  // Debit stats (isDebit === true, outgoing payments)
  debitCount: number
  debitAmount: number
  unmatchedDebitCount: number
  unmatchedDebitAmount: number
  matchedDebitCount: number
  matchedDebitAmount: number
  partialDebitCount: number
  partialDebitAmount: number

  // Net amount (credits - debits)
  netAmount: number
}

interface BankAccountInfo {
  id: string
  displayName: string
  bankName: string  // Raw bank name from Firestore for abbreviation
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
      return <LinkOutlined />
    case "partial":
      return <SyncOutlined />
    case "categorized":
      return <BankOutlined />
    case "unmatched":
      return <DisconnectOutlined />
    default:
      return null
  }
}

// ============================================================================
// Marquee Text Component - scrolls on hover when text overflows
// ============================================================================

interface MarqueeTextProps {
  text: string
  suffix?: React.ReactNode
  style?: React.CSSProperties
}

const MarqueeText: React.FC<MarqueeTextProps> = ({ text, suffix, style }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [animationDuration, setAnimationDuration] = useState(5)

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const isOver = textRef.current.scrollWidth > containerRef.current.clientWidth
        setIsOverflowing(isOver)
        // Calculate animation duration based on text length (longer text = longer duration)
        if (isOver) {
          const overflow = textRef.current.scrollWidth - containerRef.current.clientWidth
          setAnimationDuration(Math.max(3, Math.min(10, overflow / 30)))
        }
      }
    }
    checkOverflow()
    window.addEventListener("resize", checkOverflow)
    return () => window.removeEventListener("resize", checkOverflow)
  }, [text])

  return (
    <div
      ref={containerRef}
      style={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        position: "relative",
        ...style,
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <span
        ref={textRef}
        style={{
          display: "inline-block",
          animation: isOverflowing && isHovering
            ? `marqueeScroll ${animationDuration}s linear infinite`
            : "none",
          paddingRight: isOverflowing && isHovering ? "50px" : 0,
        }}
      >
        {text}
        {suffix}
      </span>
      <style jsx global>{`
        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
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
      axis="x"
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
                onChange={(value: string) => {
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
              onChange={(bankAccountId: string) => {
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
// GCP Evidence Helper
// ============================================================================

/**
 * Check if a transaction might be a GCP/Google Cloud charge
 */
const isGCPRelatedTransaction = (tx: BankTransaction): boolean => {
  if (!tx.isDebit) return false // Only check debit transactions (payments out)

  const searchText = [
    tx.payerName,
    tx.displayName,
    tx.originalDescription,
    tx.memo,
  ].filter(Boolean).join(' ').toLowerCase()

  return (
    searchText.includes('google') ||
    searchText.includes('gcp') ||
    searchText.includes('cloud platform') ||
    searchText.includes('goog ')
  )
}

/**
 * Get match confidence color
 */
const getConfidenceColor = (confidence: 'high' | 'medium' | 'low'): string => {
  switch (confidence) {
    case 'high': return '#52c41a'
    case 'medium': return '#faad14'
    case 'low': return '#ff4d4f'
    default: return '#8c8c8c'
  }
}

/**
 * Get match confidence percentage
 */
const getConfidencePercent = (confidence: 'high' | 'medium' | 'low'): number => {
  switch (confidence) {
    case 'high': return 95
    case 'medium': return 70
    case 'low': return 40
    default: return 0
  }
}

// ============================================================================
// GCP Evidence Panel Component
// ============================================================================

interface GCPEvidencePanelProps {
  transaction: BankTransaction
}

const GCPEvidencePanel: React.FC<GCPEvidencePanelProps> = ({ transaction }) => {
  const [evidence, setEvidence] = useState<GCPTransactionEvidence | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    if (!transaction || !isGCPRelatedTransaction(transaction)) {
      setEvidence(null)
      return
    }

    const fetchEvidence = async () => {
      setLoading(true)
      setError(null)

      try {
        // Format date for API
        let txDate: string
        if (transaction.transactionDate?._seconds) {
          txDate = dayjs.unix(transaction.transactionDate._seconds).format('YYYY-MM-DD')
        } else if (transaction.transactionDate?.seconds) {
          txDate = dayjs.unix(transaction.transactionDate.seconds).format('YYYY-MM-DD')
        } else {
          txDate = dayjs(transaction.transactionDate).format('YYYY-MM-DD')
        }

        const params = new URLSearchParams({
          transactionId: transaction.id,
          transactionDate: txDate,
          amount: String(transaction.amount),
        })

        const response = await fetch(`/api/gcp-billing/evidence?${params.toString()}`, {
          credentials: 'include',
        })

        const json = await response.json()

        setConfigured(json.configured)

        if (!json.success) {
          setError(json.error || 'Failed to fetch GCP billing evidence')
          return
        }

        setEvidence(json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch evidence')
      } finally {
        setLoading(false)
      }
    }

    fetchEvidence()
  }, [transaction?.id])

  // Don't render if not a GCP-related transaction
  if (!isGCPRelatedTransaction(transaction)) {
    return null
  }

  // Not configured - show info message
  if (!configured) {
    return (
      <Collapse
        size="small"
        style={{ marginTop: 16 }}
        items={[{
          key: 'gcp',
          label: (
            <Space>
              <CloudOutlined style={{ color: '#4285f4' }} />
              <span>GCP Billing Evidence</span>
              <Tag color="default">Not Configured</Tag>
            </Space>
          ),
          children: (
            <Alert
              type="info"
              message="GCP Billing Not Configured"
              description="To see GCP billing evidence, configure GCP_BILLING_PROJECT_ID and GCP_BILLING_DATASET_ID in your environment variables."
              showIcon
            />
          ),
        }]}
      />
    )
  }

  return (
    <Collapse
      size="small"
      style={{ marginTop: 16 }}
      defaultActiveKey={evidence ? ['gcp'] : []}
      items={[{
        key: 'gcp',
        label: (
          <Space>
            <CloudOutlined style={{ color: '#4285f4' }} />
            <span>GCP Billing Evidence</span>
            {loading && <Spin size="small" />}
            {evidence && (
              <Tag color={getConfidenceColor(evidence.matchConfidence)}>
                {evidence.matchConfidence.toUpperCase()} MATCH
              </Tag>
            )}
            {error && <Tag color="error">Error</Tag>}
            {!loading && !evidence && !error && <Tag>No Match</Tag>}
          </Space>
        ),
        children: (
          <div>
            {loading && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin tip="Searching GCP billing data..." />
              </div>
            )}

            {error && (
              <Alert type="error" message={error} />
            )}

            {!loading && !evidence && !error && (
              <Alert
                type="info"
                message="No Matching GCP Billing Data"
                description="Could not find GCP billing data matching this transaction. The charge may be from a different billing period or billing account."
              />
            )}

            {evidence && (
              <div>
                {/* Match Summary */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Card size="small" bodyStyle={{ padding: '12px' }}>
                      <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>Invoice Month</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {evidence.invoiceMonth.slice(0, 4)}-{evidence.invoiceMonth.slice(4)}
                      </div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" bodyStyle={{ padding: '12px' }}>
                      <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>Matched Cost</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#cf1322' }}>
                        {formatCurrency(evidence.matchedCost, 'USD')}
                      </div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" bodyStyle={{ padding: '12px' }}>
                      <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>Match Confidence</div>
                      <Progress
                        percent={getConfidencePercent(evidence.matchConfidence)}
                        size="small"
                        status={evidence.matchConfidence === 'low' ? 'exception' : 'active'}
                        strokeColor={getConfidenceColor(evidence.matchConfidence)}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Billing Period */}
                <div style={{ marginBottom: 12, fontSize: 12, color: '#8c8c8c' }}>
                  Billing Period: {evidence.billingPeriod.start} to {evidence.billingPeriod.end}
                </div>

                {/* Service Breakdown */}
                {evidence.breakdown.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Cost Breakdown by Service</div>
                    <Table
                      size="small"
                      dataSource={evidence.breakdown}
                      rowKey={(r: { service: string; project: string }) => `${r.service}-${r.project}`}
                      pagination={false}
                      columns={[
                        {
                          title: 'Service',
                          dataIndex: 'service',
                          key: 'service',
                          render: (text: string) => (
                            <span style={{ fontWeight: 500 }}>{text}</span>
                          ),
                        },
                        {
                          title: 'Project',
                          dataIndex: 'project',
                          key: 'project',
                          render: (text: string) => (
                            <span style={{ color: '#8c8c8c' }}>{text}</span>
                          ),
                        },
                        {
                          title: 'Cost',
                          dataIndex: 'cost',
                          key: 'cost',
                          align: 'right',
                          render: (cost: number) => (
                            <span style={{ color: '#cf1322' }}>
                              {formatCurrency(cost, 'USD')}
                            </span>
                          ),
                        },
                      ]}
                    />
                  </div>
                )}

                {/* Query timestamp */}
                <div style={{ marginTop: 12, fontSize: 11, color: '#bfbfbf', textAlign: 'right' }}>
                  Data fetched: {dayjs(evidence.queryTimestamp).format('DD MMM YYYY HH:mm')}
                </div>
              </div>
            )}
          </div>
        ),
      }]}
    />
  )
}

// ============================================================================
// Attachments Panel Component
// ============================================================================

interface AttachmentDoc {
  id: string
  type: string
  storagePath: string
  originalFilename: string
  mimeType: string
  fileSize: number
  status: string
  uploadedAt: any
  downloadUrl?: string
}

interface AttachmentsPanelProps {
  transaction: BankTransaction
  onRefresh?: () => void
}

const AttachmentsPanel: React.FC<AttachmentsPanelProps> = ({ transaction, onRefresh }) => {
  const [attachments, setAttachments] = useState<AttachmentDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const { message, modal } = AntdApp.useApp()

  useEffect(() => {
    if (!transaction?.id) {
      setAttachments([])
      return
    }

    const fetchAttachments = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/accounting/receipts?transactionId=${transaction.id}`, {
          credentials: "include",
        })
        const json = await response.json()
        if (json.receipts) {
          setAttachments(json.receipts)
        }
      } catch (err) {
        console.warn("Failed to fetch attachments:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchAttachments()
  }, [transaction?.id])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateValue: any): string => {
    if (!dateValue) return "-"
    try {
      if (typeof dateValue._seconds === "number") {
        return dayjs.unix(dateValue._seconds).format("DD MMM YYYY")
      }
      if (typeof dateValue.seconds === "number") {
        return dayjs.unix(dateValue.seconds).format("DD MMM YYYY")
      }
      const parsed = dayjs(dateValue)
      if (parsed.isValid()) return parsed.format("DD MMM YYYY")
    } catch {}
    return "-"
  }

  const isImageFile = (mimeType: string): boolean => mimeType?.startsWith("image/")

  const handleView = (doc: AttachmentDoc) => {
    if (doc.downloadUrl) {
      setPreviewUrl(doc.downloadUrl)
      setPreviewVisible(true)
    }
  }

  const handleDownload = (doc: AttachmentDoc) => {
    if (doc.downloadUrl) {
      window.open(doc.downloadUrl, "_blank")
    }
  }

  const handleUnlink = (doc: AttachmentDoc) => {
    modal.confirm({
      title: "Unlink Document",
      content: `Unlink "${doc.originalFilename}" from this transaction? The document will remain in the inbox.`,
      okText: "Unlink",
      onOk: async () => {
        try {
          const response = await fetch(`/api/accounting/receipts/${doc.id}/match`, {
            method: "DELETE",
            credentials: "include",
          })
          const json = await response.json()
          if (json.error) throw new Error(json.error)
          message.success("Document unlinked")
          // Refresh attachments
          setAttachments((prev) => prev.filter((d) => d.id !== doc.id))
          onRefresh?.()
        } catch (err) {
          message.error(err instanceof Error ? err.message : "Failed to unlink")
        }
      },
    })
  }

  const count = attachments.length

  return (
    <>
      <Collapse
        size="small"
        style={{ marginTop: 16 }}
        defaultActiveKey={count > 0 ? ["attachments"] : []}
        items={[
          {
            key: "attachments",
            label: (
              <Space>
                <PaperClipOutlined style={{ color: "#8c8c8c" }} />
                <span>Attachments</span>
                {loading && <Spin size="small" />}
                {!loading && <Tag>{count}</Tag>}
              </Space>
            ),
            children: (
              <div>
                {loading && (
                  <div style={{ textAlign: "center", padding: 16 }}>
                    <Spin size="small" />
                  </div>
                )}

                {!loading && attachments.length === 0 && (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No attachments"
                    style={{ margin: "16px 0" }}
                  />
                )}

                {!loading && attachments.length > 0 && (
                  <Space direction="vertical" style={{ width: "100%" }} size="small">
                    {attachments.map((doc) => (
                      <Card key={doc.id} size="small" bodyStyle={{ padding: 8 }}>
                        <Row gutter={8} align="middle">
                          <Col flex="40px">
                            {isImageFile(doc.mimeType) && doc.downloadUrl ? (
                              <Image
                                src={doc.downloadUrl}
                                alt={doc.originalFilename}
                                width={32}
                                height={32}
                                style={{ objectFit: "cover", borderRadius: 4 }}
                                preview={false}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: "#f5f5f5",
                                  borderRadius: 4,
                                  fontSize: 16,
                                }}
                              >
                                {doc.mimeType?.includes("pdf") ? (
                                  <FilePdfOutlined style={{ color: "#1890ff" }} />
                                ) : (
                                  <FileImageOutlined style={{ color: "#52c41a" }} />
                                )}
                              </div>
                            )}
                          </Col>
                          <Col flex="auto">
                            <Tooltip title={doc.originalFilename}>
                              <div
                                style={{
                                  fontWeight: 500,
                                  fontSize: 12,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: 200,
                                }}
                              >
                                {doc.originalFilename}
                              </div>
                            </Tooltip>
                            <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                              {formatFileSize(doc.fileSize)} • {formatDate(doc.uploadedAt)}
                            </div>
                          </Col>
                          <Col>
                            <Space size="small">
                              <Tooltip title="View">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EyeOutlined />}
                                  onClick={() => handleView(doc)}
                                  disabled={!doc.downloadUrl}
                                />
                              </Tooltip>
                              <Tooltip title="Download">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<DownloadOutlined />}
                                  onClick={() => handleDownload(doc)}
                                  disabled={!doc.downloadUrl}
                                />
                              </Tooltip>
                              <Tooltip title="Unlink">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<DisconnectOutlined />}
                                  onClick={() => handleUnlink(doc)}
                                  danger
                                />
                              </Tooltip>
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </Space>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Image Preview */}
      <Image
        style={{ display: "none" }}
        preview={{
          visible: previewVisible,
          src: previewUrl,
          onVisibleChange: (visible: boolean) => {
            setPreviewVisible(visible)
            if (!visible) setPreviewUrl("")
          },
        }}
      />
    </>
  )
}

// ============================================================================
// Transaction Details Modal
// ============================================================================

interface ProjectInfo {
  projectId: string
  year: string
  presenterWorkType?: string
  projectTitle?: string
  projectNature?: string
}

const TransactionDetailsModal: React.FC<{
  transaction: BankTransaction | null
  open: boolean
  onClose: () => void
  onMatch: (transactionId: string) => void
  onUnmatch: (transactionId: string) => void
  onAssignAccount: (transaction: BankTransaction) => void
  onUpdatePayer: (transactionId: string, displayName: string) => Promise<void>
  hasAccounts: boolean
}> = ({ transaction, open, onClose, onMatch, onUnmatch, onAssignAccount, onUpdatePayer, hasAccounts }) => {
  const [projectInfoMap, setProjectInfoMap] = useState<Record<string, ProjectInfo>>({})
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [editingPayer, setEditingPayer] = useState(false)
  const [payerValue, setPayerValue] = useState("")
  const [savingPayer, setSavingPayer] = useState(false)
  const { message } = AntdApp.useApp()

  // Fetch project info when modal opens with matched invoices
  useEffect(() => {
    if (!open || !transaction?.matchedInvoices?.length) {
      setProjectInfoMap({})
      return
    }

    const fetchProjectInfo = async () => {
      setLoadingProjects(true)
      const infoMap: Record<string, ProjectInfo> = {}

      for (const inv of transaction.matchedInvoices || []) {
        const key = `${inv.year}-${inv.projectId}`
        if (infoMap[key]) continue

        try {
          const res = await fetch(`/api/projects/by-id/${inv.projectId}?year=${inv.year}`, {
            credentials: "include",
          })
          if (res.ok) {
            const json = await res.json()
            // API returns { data: projectPayload, client, invoices }
            const project = json.data
            if (project) {
              infoMap[key] = {
                projectId: inv.projectId,
                year: inv.year,
                presenterWorkType: project.presenterWorkType || "",
                projectTitle: project.projectTitle || project.title || "",
                projectNature: project.projectNature || project.nature || "",
              }
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch project ${inv.projectId}:`, err)
        }
      }

      setProjectInfoMap(infoMap)
      setLoadingProjects(false)
    }

    fetchProjectInfo()
  }, [open, transaction?.id, transaction?.matchedInvoices])

  // Reset payer edit state when transaction changes
  useEffect(() => {
    if (transaction) {
      setPayerValue(transaction.displayName || transaction.payerName || "")
      setEditingPayer(false)
    }
  }, [transaction?.id])

  if (!transaction) return null

  const isMatched = transaction.status === "matched" || transaction.status === "partial"
  const canAssignAccount = !isMatched && transaction.status !== "categorized" && hasAccounts

  const handleSavePayer = async () => {
    if (!payerValue.trim()) {
      message.error("Payer name cannot be empty")
      return
    }
    setSavingPayer(true)
    try {
      await onUpdatePayer(transaction.id, payerValue.trim())
      message.success("Payer name updated")
      setEditingPayer(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update payer")
    } finally {
      setSavingPayer(false)
    }
  }

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
        canAssignAccount && (
          <Button
            key="assign"
            onClick={() => {
              onAssignAccount(transaction)
              onClose()
            }}
          >
            Assign GL Account
          </Button>
        ),
        !isMatched && (
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
        isMatched && (
          <Button
            key="unmatch"
            danger
            icon={<DisconnectOutlined />}
            onClick={() => {
              onUnmatch(transaction.id)
            }}
          >
            Unmatch
          </Button>
        ),
      ].filter(Boolean)}
      width={650}
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
          {editingPayer ? (
            <Space>
              <Input
                size="small"
                value={payerValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayerValue(e.target.value)}
                onPressEnter={handleSavePayer}
                style={{ width: 200 }}
                autoFocus
              />
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                onClick={handleSavePayer}
                loading={savingPayer}
                style={{ color: "#52c41a" }}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => {
                  setEditingPayer(false)
                  setPayerValue(transaction.displayName || transaction.payerName || "")
                }}
                style={{ color: "#ff4d4f" }}
              />
            </Space>
          ) : (
            <Space>
              <span>{transaction.displayName || transaction.payerName}</span>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => setEditingPayer(true)}
                style={{ opacity: 0.6 }}
              />
              {transaction.originalDescription && transaction.originalDescription !== (transaction.displayName || transaction.payerName) && (
                <Tooltip title={`Original: ${transaction.originalDescription}`}>
                  <span style={{ fontSize: 12, color: "#8c8c8c" }}>(edited)</span>
                </Tooltip>
              )}
            </Space>
          )}
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
            {(transaction.status === "matched" || transaction.status === "unmatched")
              ? null
              : transaction.status.toUpperCase()}
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
          <Descriptions.Item label="Relating Invoice" span={2}>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {transaction.matchedInvoices.map((inv, i) => {
                const projectKey = `${inv.year}-${inv.projectId}`
                const projectInfo = projectInfoMap[projectKey]
                return (
                  <Card
                    key={i}
                    size="small"
                    style={{ marginBottom: i < (transaction.matchedInvoices?.length || 0) - 1 ? 8 : 0 }}
                    bodyStyle={{ padding: "8px 12px" }}
                  >
                    <Row gutter={16}>
                      <Col span={10}>
                        <div style={{ marginBottom: 4 }}>
                          <a
                            href={`/projects/${inv.projectId}?year=${inv.year}&invoice=${inv.invoiceNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontWeight: 600, fontSize: 14 }}
                          >
                            #{inv.invoiceNumber}
                          </a>
                        </div>
                        <div style={{ color: "#52c41a", fontWeight: 500 }}>
                          {formatCurrency(inv.amount)}
                        </div>
                      </Col>
                      <Col span={14}>
                        {loadingProjects ? (
                          <span style={{ fontSize: 12, color: "#8c8c8c" }}>Loading...</span>
                        ) : projectInfo ? (
                          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                            <div style={{ color: "#1890ff", fontWeight: 500 }}>
                              {projectInfo.presenterWorkType || "-"}
                            </div>
                            <div style={{ color: "#262626" }}>{projectInfo.projectTitle || "-"}</div>
                            <div style={{ color: "#8c8c8c", fontStyle: "italic" }}>{projectInfo.projectNature || "-"}</div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                            Loading project info...
                          </div>
                        )}
                      </Col>
                    </Row>
                  </Card>
                )
              })}
            </Space>
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* GCP Billing Evidence Panel - shows for GCP-related transactions */}
      <GCPEvidencePanel transaction={transaction} />

      {/* Attachments Panel - shows linked documents/receipts */}
      <AttachmentsPanel transaction={transaction} />
    </Modal>
  )
}

// ============================================================================
// Main Component
// ============================================================================

interface AccountItem {
  code: string
  name: string
  type: string
}

interface BankTransactionsTabProps {
  subsidiaryId: string
  accounts?: AccountItem[]
}

const BankTransactionsTab: React.FC<BankTransactionsTabProps> = ({
  subsidiaryId,
  accounts = [],
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
  const [assignAccountModalOpen, setAssignAccountModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null)
  const [selectedAccountCode, setSelectedAccountCode] = useState<string | null>(null)
  const [assigningAccount, setAssigningAccount] = useState(false)
  const [actionPopoverOpen, setActionPopoverOpen] = useState<string | null>(null) // transaction ID

  // Bank account filter for Balance column
  const [bankAccountFilter, setBankAccountFilter] = useState<string | null>(null)

  // Stats view mode: show credits or debits
  const [statsViewMode, setStatsViewMode] = useState<"credits" | "debits">("credits")

  // Column widths - adjusted defaults to better match content
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    date: 95,
    payerPayee: 250,
    amount: 110,
    method: 75,
    status: 50,
    bank: 160,
    balance: 100,
    actions: 100,
  })

  const handleResize = (key: string) =>
    (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
      setColumnWidths((prev) => ({ ...prev, [key]: size.width }))
    }

  // Calculate optimal column width based on content
  const calculateOptimalWidth = useCallback((key: string): number => {
    const minWidths: Record<string, number> = {
      date: 85,
      payerPayee: 150,
      amount: 90,
      method: 60,
      status: 45,
      bank: 100,
      balance: 90,
      actions: 80,
    }
    const maxWidths: Record<string, number> = {
      date: 120,
      payerPayee: 400,
      amount: 140,
      method: 100,
      status: 60,
      bank: 200,
      balance: 130,
      actions: 120,
    }

    // Create a temporary element to measure text width
    const measureText = (text: string, fontSize: number = 14): number => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return 0
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
      return ctx.measureText(text).width
    }

    let maxContentWidth = minWidths[key] || 80

    // Measure header text
    const headerTexts: Record<string, string> = {
      date: "Date",
      payerPayee: "Payer/Payee",
      amount: "Amount",
      method: "Method",
      status: "Status",
      bank: "Bank Account",
      balance: "Balance",
      actions: "Actions",
    }
    const headerWidth = measureText(headerTexts[key] || "", 14) + 24 // padding
    maxContentWidth = Math.max(maxContentWidth, headerWidth)

    // Measure content based on column type
    transactions.forEach((tx) => {
      let text = ""
      switch (key) {
        case "date":
          text = tx.transactionDate ? "28 Dec 2024" : "" // Use sample format
          break
        case "payerPayee":
          text = tx.displayName || tx.payerName || ""
          break
        case "amount":
          text = `+HK$${tx.amount?.toLocaleString() || "0.00"}`
          break
        case "method":
          text = tx.paymentMethod || ""
          break
        case "bank":
          text = tx.bankAccountId || ""
          break
        case "balance":
          text = `HK$${(tx.amount || 0).toLocaleString()}`
          break
      }
      if (text) {
        const width = measureText(text, 14) + 32 // padding
        maxContentWidth = Math.max(maxContentWidth, width)
      }
    })

    // Clamp to min/max
    return Math.min(Math.max(maxContentWidth, minWidths[key] || 60), maxWidths[key] || 300)
  }, [transactions])

  // Auto-fit column width on double-click
  const handleAutoFit = useCallback((key: string) => {
    const optimalWidth = calculateOptimalWidth(key)
    setColumnWidths((prev) => ({ ...prev, [key]: optimalWidth }))
  }, [calculateOptimalWidth])

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Build query params - only add subsidiaryId if not "all"
      const subParam = subsidiaryId && subsidiaryId !== "all" ? `&subsidiaryId=${subsidiaryId}` : ""
      const [transRes, statsRes, bankRes] = await Promise.all([
        fetch(`/api/accounting/transactions?limit=100${subParam}`, {
          credentials: "include",
        }),
        fetch(`/api/accounting/transactions?stats=true${subParam}`, {
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
            bankName: info.bankName || '',  // Raw bank name for abbreviation
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

  // Handle unmatch
  const handleUnmatch = async (id: string) => {
    Modal.confirm({
      title: "Unmatch Transaction",
      content: (
        <div>
          <p>This will:</p>
          <ul>
            <li>Void the PAID journal entries</li>
            <li>Reset invoice status to &quot;Due&quot;</li>
            <li>Clear invoice payment details</li>
          </ul>
          <p>Are you sure you want to unmatch this transaction?</p>
        </div>
      ),
      okText: "Unmatch",
      okType: "danger",
      onOk: async () => {
        try {
          const response = await fetch(`/api/accounting/transactions/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action: "unmatch" }),
          })
          if (!response.ok) {
            const json = await response.json()
            throw new Error(json.error || "Unmatch failed")
          }
          message.success("Transaction unmatched and journal entries voided")
          await fetchData()
        } catch (err) {
          message.error(err instanceof Error ? err.message : "Unmatch failed")
        }
      },
    })
  }

  // Handle GL account assignment
  const handleAssignAccount = async () => {
    if (!selectedTransaction || !selectedAccountCode) return

    setAssigningAccount(true)
    try {
      const response = await fetch(`/api/accounting/transactions/${selectedTransaction.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "assign-account", accountCode: selectedAccountCode }),
      })
      const json = await response.json()
      if (json.error) throw new Error(json.error)
      message.success("Account assigned successfully")
      setAssignAccountModalOpen(false)
      setSelectedTransaction(null)
      setSelectedAccountCode(null)
      await fetchData()
    } catch (error: any) {
      message.error(error.message || "Failed to assign account")
    } finally {
      setAssigningAccount(false)
    }
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
      defaultSortOrder: "descend",
      onHeaderCell: () => ({
        width: columnWidths.date,
        onResize: handleResize("date"),
        onDoubleClick: () => handleAutoFit("date"),
      }),
    },
    {
      title: "Payer/Payee",
      dataIndex: "payerName",
      key: "payerPayee",
      width: columnWidths.payerPayee,
      render: (payerName: string, record: BankTransaction) => {
        const originalDesc = record.originalDescription || record.memo || payerName
        const displayText = record.displayName || payerName
        const wasEdited = originalDesc !== displayText && record.displayName

        const content = (
          <MarqueeText
            text={displayText}
            suffix={wasEdited ? <span style={{ fontSize: 12, color: "#8c8c8c" }}> (edited)</span> : undefined}
          />
        )

        return wasEdited ? (
          <Tooltip title={`Original: ${originalDesc}`}>
            {content}
          </Tooltip>
        ) : content
      },
      onHeaderCell: () => ({
        width: columnWidths.payerPayee,
        onResize: handleResize("payerPayee"),
        onDoubleClick: () => handleAutoFit("payerPayee"),
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
      // Sorting removed per user request - keep filter only
      filters: [
        { text: "Credit (+)", value: "credit" },
        { text: "Debit (-)", value: "debit" },
      ],
      onFilter: (value, record) => {
        if (value === "credit") return !record.isDebit // Credit = money in (not debit)
        if (value === "debit") return record.isDebit === true // Debit = money out
        return true
      },
      onHeaderCell: () => ({
        width: columnWidths.amount,
        onResize: handleResize("amount"),
        onDoubleClick: () => handleAutoFit("amount"),
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
        onDoubleClick: () => handleAutoFit("method"),
      }),
    },
    {
      title: "Bank Account",
      key: "bank",
      width: columnWidths.bank,
      render: (_, record: BankTransaction) => {
        const parsed = parseBankAccountId(record.bankAccountId)
        // Use raw bank name from Firestore for abbreviation
        const fetchedBank = bankAccounts.find(b => b.id === record.bankAccountId)
        const rawBankName = fetchedBank?.bankName || ''
        // Apply abbreviation rule: 4+ word parts = abbreviate, otherwise show as-is
        // Split by whitespace or hyphen to count word parts (e.g., "Oversea-Chinese" = 2 parts)
        const wordParts = rawBankName.split(/[\s-]+/).filter(Boolean)
        const displayBankName = rawBankName
          ? (wordParts.length >= 4
              ? wordParts.filter(w => w.length > 0 && w[0] === w[0].toUpperCase()).map(w => w[0]).join('')
              : rawBankName)
          : parsed.bankAbbr
        return (
          <Space size="small">
            <Tooltip title={rawBankName || parsed.bankFullName}>
              <span>{displayBankName}</span>
            </Tooltip>
            <Tag color={ACCOUNT_TYPE_COLORS[parsed.accountType] || "default"}>
              {parsed.accountTypeLabel}
            </Tag>
          </Space>
        )
      },
      filters: [
        ...uniqueBankAccountIds.map((id) => {
          const parsed = parseBankAccountId(id)
          const fetchedBank = bankAccounts.find(b => b.id === id)
          const rawBankName = fetchedBank?.bankName || ''
          const wordParts = rawBankName.split(/[\s-]+/).filter(Boolean)
          const displayName = rawBankName
            ? (wordParts.length >= 4
                ? wordParts.filter(w => w.length > 0 && w[0] === w[0].toUpperCase()).map(w => w[0]).join('')
                : rawBankName)
            : parsed.bankAbbr
          return { text: displayName, value: `bank:${parsed.bank}` }
        }).filter((v, i, a) => a.findIndex(t => t.value === v.value) === i),
        { text: "Savings", value: "type:S" },
        { text: "Current", value: "type:C" },
      ],
      onFilter: (value, record) => {
        const parsed = parseBankAccountId(record.bankAccountId)
        if (typeof value === "string" && value.startsWith("bank:")) {
          return parsed.bank === value.replace("bank:", "")
        }
        if (typeof value === "string" && value.startsWith("type:")) {
          return parsed.accountType === value.replace("type:", "")
        }
        return true
      },
      onHeaderCell: () => ({
        width: columnWidths.bank,
        onResize: handleResize("bank"),
        onDoubleClick: () => handleAutoFit("bank"),
      }),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: columnWidths.status,
      render: (status: string, record: BankTransaction) => {
        // For unmatched/partial transactions, make the tag clickable to show action choice
        const isClickable = status === "unmatched" || status === "partial"
        // Show only icon for matched/unmatched, text for other statuses
        const showIconOnly = status === "matched" || status === "unmatched"

        const actionContent = (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
            <Button
              type="text"
              icon={<FileTextOutlined />}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                setActionPopoverOpen(null)
                handleOpenMatchModal(record)
              }}
              style={{ justifyContent: "flex-start", textAlign: "left" }}
            >
              Match to Invoice
            </Button>
            <Button
              type="text"
              icon={<AccountBookOutlined />}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                setActionPopoverOpen(null)
                setSelectedTransaction(record)
                setSelectedAccountCode(record.accountCode || null)
                setAssignAccountModalOpen(true)
              }}
              style={{ justifyContent: "flex-start", textAlign: "left" }}
            >
              Assign GL Account
            </Button>
          </div>
        )

        const tag = (
          <Tag
            color={getStatusColor(status)}
            icon={getStatusIcon(status)}
            style={isClickable ? { cursor: "pointer" } : undefined}
            onClick={isClickable ? (e: React.MouseEvent) => {
              e.stopPropagation()
              setActionPopoverOpen(actionPopoverOpen === record.id ? null : record.id || null)
            } : undefined}
          >
            {showIconOnly ? null : status.charAt(0).toUpperCase() + status.slice(1)}
          </Tag>
        )

        if (isClickable) {
          return (
            <Popover
              content={actionContent}
              title="What would you like to do?"
              trigger="click"
              open={actionPopoverOpen === record.id}
              onOpenChange={(open: boolean) => setActionPopoverOpen(open ? record.id || null : null)}
              placement="bottomLeft"
            >
              {tag}
            </Popover>
          )
        }
        return tag
      },
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
        onDoubleClick: () => handleAutoFit("status"),
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
              onDoubleClick: () => handleAutoFit("balance"),
            }),
          },
        ]
      : []),
  ]

  return (
    <div>
      {/* Stats */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col flex="auto">
            <Row gutter={16}>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title={`Total ${statsViewMode === "credits" ? "Credits" : "Debits"}`}
                    value={statsViewMode === "credits" ? stats.creditCount : stats.debitCount}
                    suffix={`/ ${formatCurrency(statsViewMode === "credits" ? stats.creditAmount : stats.debitAmount)}`}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title={`Unmatched ${statsViewMode === "credits" ? "Credits" : "Debits"}`}
                    value={statsViewMode === "credits" ? stats.unmatchedCreditCount : stats.unmatchedDebitCount}
                    valueStyle={{ color: "#faad14" }}
                    suffix={`/ ${formatCurrency(statsViewMode === "credits" ? stats.unmatchedCreditAmount : stats.unmatchedDebitAmount)}`}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title={`Matched ${statsViewMode === "credits" ? "Credits" : "Debits"}`}
                    value={statsViewMode === "credits" ? stats.matchedCreditCount : stats.matchedDebitCount}
                    valueStyle={{ color: "#52c41a" }}
                    suffix={`/ ${formatCurrency(statsViewMode === "credits" ? stats.matchedCreditAmount : stats.matchedDebitAmount)}`}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title={`Partial ${statsViewMode === "credits" ? "Credits" : "Debits"}`}
                    value={statsViewMode === "credits" ? stats.partialCreditCount : stats.partialDebitCount}
                    valueStyle={{ color: "#1890ff" }}
                    suffix={`/ ${formatCurrency(statsViewMode === "credits" ? stats.partialCreditAmount : stats.partialDebitAmount)}`}
                  />
                </Card>
              </Col>
            </Row>
          </Col>
          <Col flex="180px">
            <Card size="small">
              <Statistic
                title="Net"
                value={stats.netAmount}
                precision={2}
                valueStyle={{ color: stats.netAmount >= 0 ? "#52c41a" : "#cf1322", whiteSpace: "nowrap" }}
                prefix={stats.netAmount >= 0 ? "+" : ""}
                formatter={(value: number | string | undefined) => formatCurrency(Number(value))}
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
            onChange={(value: string | null) => setBankAccountFilter(value || null)}
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
          <Segmented
            value={statsViewMode}
            onChange={(value: string | number) => setStatsViewMode(value as "credits" | "debits")}
            options={[
              { label: "Credits", value: "credits" },
              { label: "Debits", value: "debits" },
            ]}
          />
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
          onRow={(record: BankTransaction) => ({
            onClick: () => {
              setSelectedTransaction(record)
              setDetailsModalOpen(true)
            },
            style: { cursor: "pointer" },
            title: "Click to view transaction details",
          })}
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
        onUnmatch={(id) => {
          handleUnmatch(id)
          setDetailsModalOpen(false)
          setSelectedTransaction(null)
        }}
        onAssignAccount={(tx) => {
          setSelectedTransaction(tx)
          setSelectedAccountCode(tx.accountCode || null)
          setAssignAccountModalOpen(true)
        }}
        onUpdatePayer={async (transactionId, displayName) => {
          const transaction = transactions.find((t) => t.id === transactionId)
          const response = await fetch(`/api/accounting/transactions/${transactionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              displayName,
              originalDescription: transaction?.originalDescription || transaction?.payerName || transaction?.memo,
            }),
          })
          const json = await response.json()
          if (json.error) throw new Error(json.error)
          await fetchData()
        }}
        hasAccounts={accounts.length > 0}
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

      {/* Assign GL Account Modal */}
      <Modal
        title="Assign GL Account"
        open={assignAccountModalOpen}
        onCancel={() => {
          setAssignAccountModalOpen(false)
          setSelectedTransaction(null)
          setSelectedAccountCode(null)
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setAssignAccountModalOpen(false)
              setSelectedTransaction(null)
              setSelectedAccountCode(null)
            }}
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            disabled={!selectedAccountCode}
            loading={assigningAccount}
            onClick={handleAssignAccount}
          >
            Assign Account
          </Button>,
        ]}
        width={500}
      >
        {selectedTransaction && (
          <>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Transaction">
                {selectedTransaction.displayName || selectedTransaction.payerName || "Transaction"}
              </Descriptions.Item>
              <Descriptions.Item label="Amount">
                <strong style={{ color: selectedTransaction.isDebit ? "#cf1322" : "#389e0d" }}>
                  {selectedTransaction.isDebit ? "-" : "+"}
                  {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Date">
                {formatDate(selectedTransaction.transactionDate)}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 8 }}>
              <strong>Select GL Account:</strong>
            </div>
            <Select
              showSearch
              style={{ width: "100%" }}
              placeholder="Search for an account..."
              value={selectedAccountCode}
              onChange={(value: string | null) => setSelectedAccountCode(value)}
              optionFilterProp="label"
              options={accounts
                .filter((acc) => {
                  // Show expense accounts for debits (money going out)
                  // Show revenue accounts for credits (money coming in)
                  const code = parseInt(acc.code)
                  if (selectedTransaction.isDebit) {
                    // Debits: expenses (5000-5999), assets (1000-1999)
                    return (code >= 5000 && code < 6000) || (code >= 1000 && code < 2000)
                  } else {
                    // Credits: revenue (4000-4999), liabilities (2000-2999)
                    return (code >= 4000 && code < 5000) || (code >= 2000 && code < 3000)
                  }
                })
                .map((acc) => ({
                  value: acc.code,
                  label: `${acc.code} - ${acc.name}`,
                }))}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#8c8c8c" }}>
              {selectedTransaction.isDebit
                ? "Showing expense and asset accounts (money going out)"
                : "Showing revenue and liability accounts (money coming in)"}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default BankTransactionsTab
