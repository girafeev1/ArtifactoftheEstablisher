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
  App as AntdApp,
} from "antd"
import {
  SearchOutlined,
  LinkOutlined,
  DollarOutlined,
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

interface OutstandingInvoice {
  invoiceNumber: string
  projectId: string
  year: string
  clientName: string
  invoiceDate: string
  dueDate: string
  amount: number
  amountPaid: number
  amountDue: number
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
    if (typeof dateValue._seconds === "number") {
      return dayjs.unix(dateValue._seconds).format("DD MMM YYYY")
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
  subsidiaryId,
}) => {
  const { message } = AntdApp.useApp()

  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Track amounts to match for each invoice
  const [matchAmounts, setMatchAmounts] = useState<Record<string, number>>({})

  // Calculate totals
  const totalMatched = Object.values(matchAmounts).reduce((sum, amt) => sum + (amt || 0), 0)
  const remaining = (transaction?.amount || 0) - totalMatched

  // Fetch outstanding invoices
  const fetchInvoices = useCallback(async () => {
    if (!transaction) return

    setLoading(true)
    try {
      // Fetch AR aging data which contains outstanding invoices
      const response = await fetch("/api/accounting/reports?report=ar-aging", {
        credentials: "include",
      })
      const json = await response.json()

      if (json.error) {
        throw new Error(json.error)
      }

      // Transform AR aging data to our format
      const outstanding: OutstandingInvoice[] = (json.data?.invoices || []).map((inv: any) => ({
        invoiceNumber: inv.invoiceNumber,
        projectId: inv.projectId,
        year: inv.year || dayjs(inv.invoiceDate).format("YYYY"),
        clientName: inv.clientName,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        amount: inv.amount,
        amountPaid: inv.amountPaid || 0,
        amountDue: inv.amount - (inv.amountPaid || 0),
      }))

      setInvoices(outstanding)
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

  // Filter invoices by search term
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      inv.invoiceNumber.toLowerCase().includes(term) ||
      inv.clientName.toLowerCase().includes(term)
    )
  })

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
  const handleAutoFill = (invoice: OutstandingInvoice) => {
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
  const columns: ColumnsType<OutstandingInvoice> = [
    {
      title: "Invoice",
      dataIndex: "invoiceNumber",
      key: "invoiceNumber",
      width: 150,
      render: (num: string) => <strong>#{num}</strong>,
    },
    {
      title: "Client",
      dataIndex: "clientName",
      key: "clientName",
      ellipsis: true,
    },
    {
      title: "Due",
      dataIndex: "amountDue",
      key: "amountDue",
      width: 130,
      align: "right",
      render: (amount: number) => formatCurrency(amount),
    },
    {
      title: "Match Amount",
      key: "matchAmount",
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <InputNumber
            size="small"
            min={0}
            max={record.amountDue}
            precision={2}
            value={matchAmounts[record.invoiceNumber] || null}
            onChange={(val) => handleAmountChange(record.invoiceNumber, val)}
            style={{ width: 100 }}
            placeholder="0.00"
          />
          <Button
            size="small"
            type="link"
            onClick={() => handleAutoFill(record)}
            disabled={remaining <= 0}
          >
            Auto
          </Button>
        </Space>
      ),
    },
  ]

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
      width={800}
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
        placeholder="Search by invoice number or client name..."
        prefix={<SearchOutlined />}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />

      {/* Invoice Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Spin />
        </div>
      ) : (
        <Table
          dataSource={filteredInvoices}
          columns={columns}
          rowKey="invoiceNumber"
          size="small"
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No outstanding invoices found"
              />
            ),
          }}
          rowClassName={(record) =>
            matchAmounts[record.invoiceNumber] > 0 ? "ant-table-row-selected" : ""
          }
        />
      )}
    </Modal>
  )
}

export default MatchInvoiceModal
