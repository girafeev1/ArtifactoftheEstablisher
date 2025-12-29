/**
 * Match Invoice Modal Component
 *
 * Allows matching a bank transaction to one or more invoices.
 * Supports partial matching and multiple invoice matching.
 */

import React, { useState, useEffect, useCallback } from "react"
import {
  Modal,
  Table,
  Button,
  Space,
  Tag,
  InputNumber,
  Alert,
  Descriptions,
  Input,
  Empty,
  Spin,
  Divider,
  App as AntdApp,
} from "antd"
import {
  SearchOutlined,
  LinkOutlined,
  DollarOutlined,
  StarOutlined,
  ClockCircleOutlined,
  EllipsisOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import dayjs from "dayjs"

// ============================================================================
// Types
// ============================================================================

interface BankTransaction {
  id: string
  transactionDate: any
  amount: number
  currency: string
  payerName: string
  status: string
}

interface MatchableInvoice {
  invoiceNumber: string
  projectId: string
  year: string
  // Project display fields
  presenter?: string
  workType?: string
  projectTitle?: string
  projectNature?: string
  companyName: string
  // Invoice fields
  amount: number
  amountDue: number
  invoiceDate: string | null
  paidOn: string | null
  paymentStatus: string
  invoicePath: string
}

interface MatchedInvoice {
  invoiceNumber: string
  projectId: string
  year: string
  amount: number
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
    // Firestore Admin SDK format
    if (typeof dateValue._seconds === "number") {
      return dayjs.unix(dateValue._seconds).format("DD MMM YYYY")
    }
    // Firestore Client SDK format (when serialized to JSON)
    if (typeof dateValue.seconds === "number") {
      return dayjs.unix(dateValue.seconds).format("DD MMM YYYY")
    }
    // Firestore Timestamp with toDate() method
    if (typeof dateValue.toDate === "function") {
      return dayjs(dateValue.toDate()).format("DD MMM YYYY")
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

/**
 * Convert any date value to a dayjs object
 */
const toDayjs = (dateValue: any): dayjs.Dayjs | null => {
  if (!dateValue) return null
  try {
    // Firestore Admin SDK format
    if (typeof dateValue._seconds === "number") {
      return dayjs.unix(dateValue._seconds)
    }
    // Firestore Client SDK format (when serialized to JSON)
    if (typeof dateValue.seconds === "number") {
      return dayjs.unix(dateValue.seconds)
    }
    // Firestore Timestamp with toDate() method
    if (typeof dateValue.toDate === "function") {
      return dayjs(dateValue.toDate())
    }
    const parsed = dayjs(dateValue)
    if (parsed.isValid()) {
      return parsed
    }
  } catch {
    // Ignore
  }
  return null
}

/**
 * Calculate the number of days between two dates
 */
const getDaysDifference = (date1: dayjs.Dayjs | null, date2: dayjs.Dayjs | null): number | null => {
  if (!date1 || !date2) return null
  return Math.abs(date1.diff(date2, "day"))
}

/**
 * Check if a date is within a certain number of days of another date
 */
const isWithinDays = (date1: dayjs.Dayjs | null, date2: dayjs.Dayjs | null, days: number): boolean => {
  const diff = getDaysDifference(date1, date2)
  return diff !== null && diff <= days
}

// ============================================================================
// Main Component
// ============================================================================

interface MatchInvoiceModalProps {
  open: boolean
  transaction: BankTransaction | null
  onClose: () => void
  onMatch: (transactionId: string, invoices: MatchedInvoice[]) => Promise<void>
  subsidiaryId: string
}

const MatchInvoiceModal: React.FC<MatchInvoiceModalProps> = ({
  open,
  transaction,
  onClose,
  onMatch,
}) => {
  const { message } = AntdApp.useApp()

  const [invoices, setInvoices] = useState<MatchableInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Track amounts to match for each invoice
  const [matchAmounts, setMatchAmounts] = useState<Record<string, number>>({})

  // Calculate totals
  const totalMatched = Object.values(matchAmounts).reduce((sum, amt) => sum + (amt || 0), 0)
  const remaining = (transaction?.amount || 0) - totalMatched

  // Fetch matchable invoices
  const fetchInvoices = useCallback(async () => {
    if (!transaction) return

    setLoading(true)
    try {
      const response = await fetch("/api/accounting/matchable-invoices", {
        credentials: "include",
      })
      const json = await response.json()

      if (json.error) {
        throw new Error(json.error)
      }

      // Show all invoices - the UI will handle categorization
      // Outstanding invoices (amountDue > 0) can be matched
      // Cleared invoices with paidOn are shown for reference/suggestion
      setInvoices(json.invoices || [])
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load invoices")
    } finally {
      setLoading(false)
    }
  }, [transaction, message])

  useEffect(() => {
    if (open && transaction) {
      fetchInvoices()
      setMatchAmounts({})
      setSearchTerm("")
    }
  }, [open, transaction, fetchInvoices])

  // Transaction date for smart matching
  const transactionDate = transaction ? toDayjs(transaction.transactionDate) : null
  const transactionAmount = transaction?.amount || 0

  // Extended invoice type with computed fields
  type EnhancedInvoice = MatchableInvoice & {
    isSuggested: boolean
    isRecentWithAmountMatch: boolean
    amountDiff: number
    category: "suggested" | "recent" | "other"
  }

  // Filter and categorize invoices
  const { suggestedInvoices, recentInvoices, otherInvoices } = (() => {
    // First, apply search filter
    const filtered = invoices.filter((inv) => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        inv.invoiceNumber.toLowerCase().includes(term) ||
        inv.companyName.toLowerCase().includes(term) ||
        (inv.projectTitle || "").toLowerCase().includes(term) ||
        (inv.presenter || "").toLowerCase().includes(term)
      )
    })

    // Enhance with computed fields
    const enhanced: EnhancedInvoice[] = filtered.map((inv) => {
      // Check if paidOn date is within ±3 days of transaction date
      const paidOnDate = inv.paidOn ? toDayjs(inv.paidOn) : null
      const isSuggested = inv.paidOn ? isWithinDays(transactionDate, paidOnDate, 3) : false

      // Calculate amount difference for sorting
      const amountDiff = Math.abs(inv.amountDue - transactionAmount)

      return {
        ...inv,
        isSuggested,
        isRecentWithAmountMatch: false, // Will be set later
        amountDiff,
        category: "other" as const,
      }
    })

    // Separate suggested invoices (paidOn within ±3 days)
    const suggested = enhanced.filter((inv) => inv.isSuggested)
    suggested.forEach((inv) => { inv.category = "suggested" })

    // For non-suggested, find outstanding invoices (amountDue > 0)
    const outstanding = enhanced.filter((inv) => !inv.isSuggested && inv.amountDue > 0)

    // Sort outstanding by invoice date (most recent first), then by amount match
    const sortedOutstanding = [...outstanding].sort((a, b) => {
      const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0
      const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0
      // Primary: most recent first
      if (dateB !== dateA) return dateB - dateA
      // Secondary: closest amount match
      return a.amountDiff - b.amountDiff
    })

    // If no suggested invoices, mark top 3 outstanding as recent
    let recent: EnhancedInvoice[] = []
    let other: EnhancedInvoice[] = []

    if (suggested.length === 0 && sortedOutstanding.length > 0) {
      // Get the 10 most recent invoices, then sort by amount match, take top 3
      const recentCandidates = sortedOutstanding.slice(0, 10)
      recentCandidates.sort((a, b) => a.amountDiff - b.amountDiff)

      recent = recentCandidates.slice(0, 3)
      recent.forEach((inv) => {
        inv.isRecentWithAmountMatch = true
        inv.category = "recent"
      })

      // The rest of outstanding are "other"
      const recentIds = new Set(recent.map((r) => r.invoiceNumber))
      other = sortedOutstanding.filter((inv) => !recentIds.has(inv.invoiceNumber))
    } else {
      other = sortedOutstanding
    }

    // Also include paid invoices (without paidOn suggestion) at the very end for reference
    const paidInvoices = enhanced.filter(
      (inv) => !inv.isSuggested && inv.amountDue === 0
    ).sort((a, b) => {
      const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0
      const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0
      return dateB - dateA
    })

    return {
      suggestedInvoices: suggested,
      recentInvoices: recent,
      otherInvoices: [...other, ...paidInvoices],
    }
  })()

  // Handle amount change for an invoice
  const handleAmountChange = (invoiceNumber: string, amount: number | null) => {
    setMatchAmounts((prev) => {
      if (amount === null || amount <= 0) {
        const { [invoiceNumber]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [invoiceNumber]: amount }
    })
  }

  // Auto-fill remaining amount
  const handleAutoFill = (invoice: MatchableInvoice) => {
    const maxAmount = Math.min(remaining, invoice.amountDue)
    if (maxAmount > 0) {
      handleAmountChange(invoice.invoiceNumber, maxAmount)
    }
  }

  // Submit match
  const handleSubmit = async () => {
    if (!transaction) return

    const matchedInvoices: MatchedInvoice[] = Object.entries(matchAmounts)
      .filter(([, amount]) => amount > 0)
      .map(([invoiceNumber, amount]) => {
        const invoice = invoices.find((inv) => inv.invoiceNumber === invoiceNumber)
        return {
          invoiceNumber,
          projectId: invoice?.projectId || "",
          year: invoice?.year || "",
          amount,
        }
      })

    if (matchedInvoices.length === 0) {
      message.warning("Please select at least one invoice to match")
      return
    }

    if (totalMatched > transaction.amount) {
      message.warning("Total matched amount exceeds transaction amount")
      return
    }

    try {
      setSubmitting(true)
      await onMatch(transaction.id, matchedInvoices)
      message.success("Transaction matched successfully")
      onClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to match transaction")
    } finally {
      setSubmitting(false)
    }
  }

  // Table columns
  const columns: ColumnsType<EnhancedInvoice> = [
    {
      title: "Invoice",
      dataIndex: "invoiceNumber",
      key: "invoiceNumber",
      width: 160,
      render: (num: string, record: EnhancedInvoice) => (
        <div>
          {(record.isSuggested || record.isRecentWithAmountMatch) && (
            <div style={{ marginBottom: 4 }}>
              {record.isSuggested && (
                <Tag color="gold" icon={<StarOutlined />}>
                  Suggested
                </Tag>
              )}
              {record.isRecentWithAmountMatch && !record.isSuggested && (
                <Tag color="blue" icon={<ClockCircleOutlined />}>
                  Recent
                </Tag>
              )}
            </div>
          )}
          <strong>#{num}</strong>
        </div>
      ),
    },
    {
      title: "Project",
      key: "project",
      ellipsis: false,
      render: (_, record: EnhancedInvoice) => (
        <div style={{ lineHeight: 1.4 }}>
          {(record.presenter || record.workType) && (
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>
              {record.presenter || record.workType}
            </div>
          )}
          {record.projectTitle && (
            <div style={{ fontWeight: 500 }}>
              {record.projectTitle}
            </div>
          )}
          {record.projectNature && (
            <div style={{ fontSize: 12, color: "#595959" }}>
              {record.projectNature}
            </div>
          )}
          {!record.projectTitle && !record.presenter && !record.projectNature && (
            <div>{record.companyName}</div>
          )}
        </div>
      ),
    },
    {
      title: "Due",
      dataIndex: "amountDue",
      key: "amountDue",
      width: 110,
      align: "right",
      render: (amount: number, record: EnhancedInvoice) => (
        <div>
          <div>{formatCurrency(amount)}</div>
          {record.amountDiff < transactionAmount * 0.1 && record.amountDue > 0 && (
            <div style={{ fontSize: 11, color: "#52c41a" }}>
              ~match
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Match Amount",
      key: "matchAmount",
      width: 170,
      render: (_, record) => (
        <Space size="small">
          <InputNumber
            size="small"
            min={0}
            max={record.amountDue}
            precision={2}
            value={matchAmounts[record.invoiceNumber] || null}
            onChange={(val) => handleAmountChange(record.invoiceNumber, val)}
            style={{ width: 90 }}
            placeholder="0.00"
          />
          <Button
            size="small"
            type="link"
            onClick={() => handleAutoFill(record)}
            disabled={remaining <= 0 || record.amountDue <= 0}
          >
            Auto
          </Button>
        </Space>
      ),
    },
  ]

  // Combine data with divider logic
  const tableData: EnhancedInvoice[] = [
    ...suggestedInvoices,
    ...recentInvoices,
    ...otherInvoices,
  ]

  // Find the index where "other" invoices start (for divider)
  const dividerIndex = suggestedInvoices.length + recentInvoices.length

  if (!transaction) return null

  return (
    <Modal
      title={
        <Space>
          <LinkOutlined />
          <span>Match Transaction to Invoice</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={750}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="match"
          type="primary"
          loading={submitting}
          onClick={handleSubmit}
          disabled={totalMatched <= 0}
        >
          Match Transaction
        </Button>,
      ]}
    >
      {/* Transaction Summary */}
      <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Date">
          {formatDate(transaction.transactionDate)}
        </Descriptions.Item>
        <Descriptions.Item label="Payer">{transaction.payerName}</Descriptions.Item>
        <Descriptions.Item label="Amount">
          <strong style={{ color: "#52c41a" }}>
            {formatCurrency(transaction.amount, transaction.currency)}
          </strong>
        </Descriptions.Item>
      </Descriptions>

      {/* Matching Summary */}
      <Alert
        type={remaining < 0 ? "error" : remaining === 0 ? "success" : "info"}
        message={
          <Space size="large">
            <span>
              <DollarOutlined /> Total Matched: <strong>{formatCurrency(totalMatched)}</strong>
            </span>
            <span>
              Remaining: <strong>{formatCurrency(remaining)}</strong>
            </span>
            {remaining < 0 && <Tag color="error">Over-allocated!</Tag>}
            {remaining === 0 && <Tag color="success">Fully matched</Tag>}
          </Space>
        }
        style={{ marginBottom: 16 }}
      />

      {/* Search */}
      <Input
        placeholder="Search by invoice number, project title, or presenter..."
        prefix={<SearchOutlined />}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: 8 }}
        allowClear
      />

      {/* Suggested matches hint */}
      {suggestedInvoices.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 12, color: "#d48806" }}>
          <StarOutlined style={{ marginRight: 4 }} />
          {suggestedInvoices.length} invoice(s) with paidOn date within 3 days of transaction
        </div>
      )}

      {/* Recent matches hint (fallback when no paidOn matches) */}
      {suggestedInvoices.length === 0 && recentInvoices.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 12, color: "#1890ff" }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          No paidOn date matches. Showing {recentInvoices.length} recent invoice(s) with closest amounts
        </div>
      )}

      {/* Styling */}
      <style jsx global>{`
        .suggested-row {
          background-color: #fffbe6 !important;
        }
        .suggested-row:hover > td {
          background-color: #fff1b8 !important;
        }
        .recent-row {
          background-color: #e6f7ff !important;
        }
        .recent-row:hover > td {
          background-color: #bae7ff !important;
        }
        .divider-row td {
          padding: 4px 8px !important;
          background-color: #fafafa !important;
          border-bottom: none !important;
        }
      `}</style>

      {/* Invoice Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Spin />
        </div>
      ) : (
        <>
          <Table
            dataSource={tableData}
            columns={columns}
            rowKey="invoiceNumber"
            size="small"
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No matchable invoices found"
                />
              ),
            }}
            rowClassName={(record: EnhancedInvoice, index: number) => {
              const classes: string[] = []
              if (matchAmounts[record.invoiceNumber] > 0) classes.push("ant-table-row-selected")
              if (record.isSuggested) classes.push("suggested-row")
              else if (record.isRecentWithAmountMatch) classes.push("recent-row")
              return classes.join(" ")
            }}
            components={{
              body: {
                row: (props: any) => {
                  const { children, className, ...restProps } = props
                  const rowIndex = props["data-row-key"]
                    ? tableData.findIndex((d) => d.invoiceNumber === props["data-row-key"])
                    : -1

                  // Insert divider row before "other" invoices
                  if (rowIndex === dividerIndex && dividerIndex > 0 && otherInvoices.length > 0) {
                    return (
                      <>
                        <tr>
                          <td colSpan={4} style={{
                            textAlign: "center",
                            padding: "8px 0",
                            background: "#fafafa",
                            borderTop: "1px solid #f0f0f0",
                            borderBottom: "1px solid #f0f0f0",
                          }}>
                            <EllipsisOutlined style={{
                              fontSize: 16,
                              color: "#bfbfbf",
                              transform: "rotate(90deg)",
                              display: "inline-block",
                            }} />
                            <span style={{
                              marginLeft: 8,
                              fontSize: 12,
                              color: "#8c8c8c"
                            }}>
                              Other invoices
                            </span>
                          </td>
                        </tr>
                        <tr className={className} {...restProps}>
                          {children}
                        </tr>
                      </>
                    )
                  }

                  return (
                    <tr className={className} {...restProps}>
                      {children}
                    </tr>
                  )
                },
              },
            }}
          />
        </>
      )}
    </Modal>
  )
}

export default MatchInvoiceModal
