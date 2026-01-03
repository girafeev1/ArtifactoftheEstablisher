/**
 * Documents Tab Component
 *
 * Main tab for viewing and managing documents (receipts, invoice PDFs, contracts, etc.)
 * Supports upload, filtering, matching to transactions, and document management.
 */

import React, { useState, useEffect, useCallback } from "react"
import {
  Table,
  Button,
  Space,
  Tag,
  Tooltip,
  Empty,
  Modal,
  Upload,
  Alert,
  Row,
  Col,
  Card,
  Statistic,
  Select,
  Input,
  Image,
  Dropdown,
  App as AntdApp,
} from "antd"
import {
  UploadOutlined,
  InboxOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  LinkOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  MoreOutlined,
  FilterOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import type { UploadFile, RcFile, UploadChangeParam } from "antd/es/upload/interface"
import type { ItemType } from "antd/es/menu/interface"
import dayjs from "dayjs"
import type { Document, DocumentType, DocumentStatus } from "../../lib/accounting/types"

const { Dragger } = Upload

// ============================================================================
// Types
// ============================================================================

interface DocumentWithUrl extends Document {
  downloadUrl?: string | null
}

interface DocumentStats {
  total: number
  inbox: number
  matched: number
  orphaned: number
  byType: Record<DocumentType, number>
}

// ============================================================================
// Helper Functions
// ============================================================================

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

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getStatusColor = (status: DocumentStatus): string => {
  switch (status) {
    case "matched":
      return "success"
    case "inbox":
      return "processing"
    case "orphaned":
      return "warning"
    default:
      return "default"
  }
}

const getStatusIcon = (status: DocumentStatus) => {
  switch (status) {
    case "matched":
      return <CheckCircleOutlined />
    case "inbox":
      return <ClockCircleOutlined />
    case "orphaned":
      return <QuestionCircleOutlined />
    default:
      return null
  }
}

const getTypeIcon = (type: DocumentType) => {
  switch (type) {
    case "receipt":
      return <FileImageOutlined style={{ color: "#52c41a" }} />
    case "invoice_pdf":
      return <FilePdfOutlined style={{ color: "#1890ff" }} />
    case "contract":
      return <FileTextOutlined style={{ color: "#722ed1" }} />
    case "quote":
      return <FileTextOutlined style={{ color: "#fa8c16" }} />
    case "other":
      return <FileTextOutlined style={{ color: "#8c8c8c" }} />
    default:
      return <FileTextOutlined />
  }
}

const getTypeLabel = (type: DocumentType): string => {
  switch (type) {
    case "receipt":
      return "Receipt"
    case "invoice_pdf":
      return "Invoice PDF"
    case "contract":
      return "Contract"
    case "quote":
      return "Quote"
    case "other":
      return "Other"
    default:
      return type
  }
}

const isImageFile = (mimeType: string): boolean => {
  return mimeType.startsWith("image/")
}

// ============================================================================
// Document Card Component
// ============================================================================

interface DocumentCardProps {
  document: DocumentWithUrl
  onView: (doc: DocumentWithUrl) => void
  onDownload: (doc: DocumentWithUrl) => void
  onMatch: (doc: DocumentWithUrl) => void
  onDelete: (doc: DocumentWithUrl) => void
}

const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onView,
  onDownload,
  onMatch,
  onDelete,
}) => {
  const menuItems: ItemType[] = [
    {
      key: "view",
      icon: <EyeOutlined />,
      label: "View",
      onClick: () => onView(document),
    },
    {
      key: "download",
      icon: <DownloadOutlined />,
      label: "Download",
      onClick: () => onDownload(document),
    },
    ...(document.status !== "matched"
      ? [
          {
            key: "match",
            icon: <LinkOutlined />,
            label: "Match to Transaction",
            onClick: () => onMatch(document),
          },
        ]
      : []),
    { type: "divider" as const },
    {
      key: "delete",
      icon: <DeleteOutlined />,
      label: "Delete",
      danger: true,
      onClick: () => onDelete(document),
    },
  ]

  return (
    <Card
      hoverable
      size="small"
      style={{ width: "100%", marginBottom: 12 }}
      bodyStyle={{ padding: 12 }}
    >
      <Row gutter={12} align="middle">
        {/* Thumbnail / Icon */}
        <Col flex="60px">
          {isImageFile(document.mimeType) && document.downloadUrl ? (
            <Image
              src={document.downloadUrl}
              alt={document.originalFilename}
              width={50}
              height={50}
              style={{ objectFit: "cover", borderRadius: 4 }}
              preview={false}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            />
          ) : (
            <div
              style={{
                width: 50,
                height: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f5f5f5",
                borderRadius: 4,
                fontSize: 24,
              }}
            >
              {getTypeIcon(document.type)}
            </div>
          )}
        </Col>

        {/* Document Info */}
        <Col flex="auto">
          <div style={{ fontWeight: 500, marginBottom: 4 }}>
            <Tooltip title={document.originalFilename}>
              <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                {document.originalFilename}
              </span>
            </Tooltip>
          </div>
          <Space size="small">
            <Tag color={getStatusColor(document.status)} icon={getStatusIcon(document.status)}>
              {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
            </Tag>
            <Tag>{getTypeLabel(document.type)}</Tag>
            <span style={{ fontSize: 12, color: "#8c8c8c" }}>
              {formatFileSize(document.fileSize)}
            </span>
          </Space>
          <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 4 }}>
            Uploaded {formatDate(document.uploadedAt)}
            {document.transactionId && (
              <span style={{ marginLeft: 8, color: "#52c41a" }}>
                <LinkOutlined /> Linked
              </span>
            )}
          </div>
        </Col>

        {/* Actions */}
        <Col flex="40px">
          <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Col>
      </Row>
    </Card>
  )
}

// ============================================================================
// Upload Modal Component
// ============================================================================

interface UploadModalProps {
  open: boolean
  onClose: () => void
  onUpload: (file: File, options: { type: DocumentType; referenceNumber?: string; memo?: string }) => Promise<void>
  subsidiaryId: string
}

const UploadModal: React.FC<UploadModalProps> = ({
  open,
  onClose,
  onUpload,
  subsidiaryId,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [documentType, setDocumentType] = useState<DocumentType>("receipt")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [memo, setMemo] = useState("")
  const { message } = AntdApp.useApp()

  useEffect(() => {
    if (open) {
      setFileList([])
      setDocumentType("receipt")
      setReferenceNumber("")
      setMemo("")
    }
  }, [open])

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.error("Please select a file to upload")
      return
    }

    const file = fileList[0].originFileObj as File
    if (!file) {
      message.error("Invalid file")
      return
    }

    setUploading(true)
    try {
      await onUpload(file, {
        type: documentType,
        referenceNumber: referenceNumber || undefined,
        memo: memo || undefined,
      })
      message.success("Document uploaded successfully")
      onClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const beforeUpload = (file: RcFile) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/heic", "application/pdf"]
    if (!allowedTypes.includes(file.type)) {
      message.error("Only JPG, PNG, HEIC, and PDF files are allowed")
      return Upload.LIST_IGNORE
    }
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      message.error("File must be smaller than 10MB")
      return Upload.LIST_IGNORE
    }
    return false // Prevent auto upload
  }

  return (
    <Modal
      title="Upload Document"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="upload"
          type="primary"
          loading={uploading}
          onClick={handleUpload}
          disabled={fileList.length === 0}
        >
          Upload
        </Button>,
      ]}
      width={500}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Dragger
          fileList={fileList}
          onChange={(info: UploadChangeParam<UploadFile>) => setFileList(info.fileList.slice(-1))}
          beforeUpload={beforeUpload}
          maxCount={1}
          accept=".jpg,.jpeg,.png,.heic,.pdf"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Click or drag file to upload</p>
          <p className="ant-upload-hint">JPG, PNG, HEIC, or PDF (max 10MB)</p>
        </Dragger>

        <div>
          <div style={{ marginBottom: 8 }}>Document Type</div>
          <Select
            style={{ width: "100%" }}
            value={documentType}
            onChange={setDocumentType}
            options={[
              { value: "receipt", label: "Receipt" },
              { value: "invoice_pdf", label: "Invoice PDF" },
              { value: "contract", label: "Contract" },
              { value: "quote", label: "Quote" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>Reference Number (optional)</div>
          <Input
            value={referenceNumber}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferenceNumber(e.target.value)}
            placeholder="For auto-matching to transactions"
          />
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>Memo (optional)</div>
          <Input.TextArea
            value={memo}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMemo(e.target.value)}
            placeholder="Additional notes"
            rows={2}
          />
        </div>
      </Space>
    </Modal>
  )
}

// ============================================================================
// Match Document Modal Component
// ============================================================================

interface MatchDocumentModalProps {
  open: boolean
  document: DocumentWithUrl | null
  onClose: () => void
  onMatch: (documentId: string, transactionId: string) => Promise<void>
  subsidiaryId: string
}

interface Transaction {
  id: string
  transactionDate: any
  amount: number
  isDebit: boolean
  payerName: string
  displayName?: string
  status: string
  bankAccountId: string
}

const MatchDocumentModal: React.FC<MatchDocumentModalProps> = ({
  open,
  document,
  onClose,
  onMatch,
  subsidiaryId,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const { message } = AntdApp.useApp()

  useEffect(() => {
    if (open && document) {
      fetchUnmatchedTransactions()
      setSelectedId(null)
      setSearch("")
    }
  }, [open, document])

  const fetchUnmatchedTransactions = async () => {
    setLoading(true)
    try {
      const subParam = subsidiaryId && subsidiaryId !== "all" ? `&subsidiaryId=${subsidiaryId}` : ""
      const response = await fetch(`/api/accounting/transactions?status=unmatched${subParam}`, {
        credentials: "include",
      })
      const json = await response.json()
      if (json.transactions) {
        setTransactions(json.transactions)
      }
    } catch (err) {
      message.error("Failed to load transactions")
    } finally {
      setLoading(false)
    }
  }

  const handleMatch = async () => {
    if (!document || !selectedId) return

    setMatching(true)
    try {
      await onMatch(document.id!, selectedId)
      message.success("Document matched to transaction")
      onClose()
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Match failed")
    } finally {
      setMatching(false)
    }
  }

  const filteredTransactions = transactions.filter((tx) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      (tx.displayName || tx.payerName || "").toLowerCase().includes(searchLower) ||
      tx.id.toLowerCase().includes(searchLower)
    )
  })

  const columns: ColumnsType<Transaction> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      key: "date",
      width: 100,
      render: formatDate,
    },
    {
      title: "Payer/Payee",
      key: "payer",
      render: (_, record) => record.displayName || record.payerName,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      align: "right",
      render: (amount: number, record) => (
        <span style={{ color: record.isDebit ? "#cf1322" : "#389e0d" }}>
          {record.isDebit ? "-" : "+"}HK${amount.toLocaleString()}
        </span>
      ),
    },
  ]

  return (
    <Modal
      title="Match Document to Transaction"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="match"
          type="primary"
          loading={matching}
          onClick={handleMatch}
          disabled={!selectedId}
        >
          Match
        </Button>,
      ]}
      width={600}
    >
      {document && (
        <div style={{ marginBottom: 16 }}>
          <Card size="small">
            <Space>
              {getTypeIcon(document.type)}
              <span>{document.originalFilename}</span>
              <Tag>{getTypeLabel(document.type)}</Tag>
            </Space>
          </Card>
        </div>
      )}

      <Input
        placeholder="Search transactions..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      <Table<Transaction>
        dataSource={filteredTransactions}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 5 }}
        rowSelection={{
          type: "radio",
          selectedRowKeys: selectedId ? [selectedId] : [],
          onChange: (keys: React.Key[]) => setSelectedId(keys[0] as string),
        }}
        onRow={(record: Transaction) => ({
          onClick: () => setSelectedId(record.id),
          style: { cursor: "pointer" },
        })}
        locale={{
          emptyText: <Empty description="No unmatched transactions" />,
        }}
      />
    </Modal>
  )
}

// ============================================================================
// Main Component
// ============================================================================

interface DocumentsTabProps {
  subsidiaryId: string
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ subsidiaryId }) => {
  const { message, modal } = AntdApp.useApp()

  const [documents, setDocuments] = useState<DocumentWithUrl[]>([])
  const [stats, setStats] = useState<DocumentStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all")
  const [searchText, setSearchText] = useState("")

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [matchModalOpen, setMatchModalOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithUrl | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (subsidiaryId && subsidiaryId !== "all") {
        params.set("subsidiaryId", subsidiaryId)
      }
      if (typeFilter !== "all") {
        params.set("type", typeFilter)
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter)
      }

      const response = await fetch(`/api/accounting/receipts?${params.toString()}`, {
        credentials: "include",
      })
      const json = await response.json()

      if (json.receipts) {
        setDocuments(json.receipts)
      }
      if (json.stats) {
        setStats(json.stats)
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load documents")
    } finally {
      setLoading(false)
    }
  }, [subsidiaryId, typeFilter, statusFilter, message])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Upload handler
  const handleUpload = async (
    file: File,
    options: { type: DocumentType; referenceNumber?: string; memo?: string }
  ) => {
    // Convert file to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove data URL prefix
        const base64Data = result.split(",")[1]
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const response = await fetch("/api/accounting/receipts/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        file: base64,
        filename: file.name,
        mimeType: file.type,
        subsidiaryId,
        referenceNumber: options.referenceNumber,
        memo: options.memo,
        linkMethod: "inbox",
      }),
    })

    const json = await response.json()
    if (json.error) throw new Error(json.error)

    await fetchDocuments()
  }

  // Match handler
  const handleMatch = async (documentId: string, transactionId: string) => {
    const response = await fetch(`/api/accounting/receipts/${documentId}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ transactionId }),
    })
    const json = await response.json()
    if (json.error) throw new Error(json.error)
    await fetchDocuments()
  }

  // View handler
  const handleView = (doc: DocumentWithUrl) => {
    if (doc.downloadUrl) {
      setPreviewUrl(doc.downloadUrl)
      setPreviewVisible(true)
    } else {
      message.warning("Document URL not available")
    }
  }

  // Download handler
  const handleDownload = (doc: DocumentWithUrl) => {
    if (doc.downloadUrl) {
      window.open(doc.downloadUrl, "_blank")
    } else {
      message.warning("Download URL not available")
    }
  }

  // Delete handler
  const handleDelete = (doc: DocumentWithUrl) => {
    modal.confirm({
      title: "Delete Document",
      content: `Are you sure you want to delete "${doc.originalFilename}"? This action cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const response = await fetch(`/api/accounting/receipts/${doc.id}`, {
            method: "DELETE",
            credentials: "include",
          })
          const json = await response.json()
          if (json.error) throw new Error(json.error)
          message.success("Document deleted")
          await fetchDocuments()
        } catch (err) {
          message.error(err instanceof Error ? err.message : "Delete failed")
        }
      },
    })
  }

  // Open match modal
  const handleOpenMatchModal = (doc: DocumentWithUrl) => {
    setSelectedDocument(doc)
    setMatchModalOpen(true)
  }

  // Filter documents by search text
  const filteredDocuments = documents.filter((doc) => {
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      doc.originalFilename.toLowerCase().includes(searchLower) ||
      (doc.memo || "").toLowerCase().includes(searchLower) ||
      (doc.referenceNumber || "").toLowerCase().includes(searchLower)
    )
  })

  return (
    <div>
      {/* Stats */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="Total Documents" value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Inbox"
                value={stats.inbox}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Matched"
                value={stats.matched}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Orphaned"
                value={stats.orphaned}
                valueStyle={{ color: "#faad14" }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters and Actions */}
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col flex="auto">
          <Space>
            <FilterOutlined style={{ color: "#8c8c8c" }} />
            <Select
              style={{ width: 140 }}
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "all", label: "All Types" },
                { value: "receipt", label: "Receipts" },
                { value: "invoice_pdf", label: "Invoice PDFs" },
                { value: "contract", label: "Contracts" },
                { value: "quote", label: "Quotes" },
                { value: "other", label: "Other" },
              ]}
            />
            <Select
              style={{ width: 140 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Status" },
                { value: "inbox", label: "Inbox" },
                { value: "matched", label: "Matched" },
                { value: "orphaned", label: "Orphaned" },
              ]}
            />
            <Input
              placeholder="Search documents..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
          </Space>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setUploadModalOpen(true)}
          >
            Upload Document
          </Button>
        </Col>
      </Row>

      {/* Document List */}
      {loading ? (
        <Card loading style={{ minHeight: 200 }} />
      ) : filteredDocuments.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            documents.length === 0
              ? "No documents yet"
              : "No documents match your filters"
          }
        >
          {documents.length === 0 && (
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalOpen(true)}
            >
              Upload Document
            </Button>
          )}
        </Empty>
      ) : (
        <div>
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onView={handleView}
              onDownload={handleDownload}
              onMatch={handleOpenMatchModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
        subsidiaryId={subsidiaryId}
      />

      <MatchDocumentModal
        open={matchModalOpen}
        document={selectedDocument}
        onClose={() => {
          setMatchModalOpen(false)
          setSelectedDocument(null)
        }}
        onMatch={handleMatch}
        subsidiaryId={subsidiaryId}
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
    </div>
  )
}

export default DocumentsTab
