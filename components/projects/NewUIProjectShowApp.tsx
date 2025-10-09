import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/router"
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  InputNumber,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd"
import type { ColumnsType } from "antd/es/table"
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons"

import type { ClientDirectoryRecord } from "../../lib/clientDirectory"
import type { ProjectRecord } from "../../lib/projectsDatabase"
import AppShell from "../new-ui/AppShell"
import {
  amountText,
  mergeLineWithRegion,
  normalizeClient,
  normalizeProject,
  paidDateText,
  paymentChipColor,
  paymentChipLabel,
  stringOrNA,
  type NormalizedClient,
  type NormalizedProject,
} from "./projectUtils"
import { projectsDataProvider } from "./NewUIProjectsApp"

const { Title, Text } = Typography

type ProjectShowResponse = {
  data?: ProjectRecord
  client?: ClientDirectoryRecord | null
}

type InvoiceItem = {
  key: string
  type: "item"
  name: string
  quantity: number
  unitPrice: number
  discount: number
}

type InvoiceTableRow = InvoiceItem | { key: string; type: "adder" }

type InvoiceItemField = keyof Pick<InvoiceItem, "name" | "quantity" | "unitPrice" | "discount">

const isAdderRow = (row: InvoiceTableRow): row is { key: string; type: "adder" } =>
  (row as { type?: string }).type === "adder"

const KARLA_FONT = "'Karla', sans-serif"

const descriptorWrapperStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 500,
  color: "#0f172a",
  fontSize: 16,
  lineHeight: 1.2,
  display: "flex",
  alignItems: "baseline",
  gap: 6,
}
const descriptorNumberStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 600,
  color: "#0f172a",
}
const descriptorSeparatorStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 500,
  color: "#94a3b8",
}
const descriptorDateStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 500,
  fontStyle: "italic" as const,
  color: "#64748b",
}
const projectTitleStyle = { fontFamily: KARLA_FONT, fontWeight: 700, margin: 0, color: "#0f172a" }
const projectNatureStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 500,
  fontStyle: "italic",
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.2,
}
const subsidiaryChipStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 600,
  borderRadius: 999,
  backgroundColor: "#e0f2fe",
  color: "#0c4a6e",
  border: "none",
  padding: "4px 14px",
  fontSize: 12,
  marginTop: 6,
  width: "fit-content" as const,
}
const companyNameStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 700,
  fontSize: 18,
  color: "#0f172a",
}
const addressLineStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 500,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.4,
}
const moduleLabelStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "uppercase" as const,
  color: "#94a3b8",
  fontSize: 12,
}
const moduleValueStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 600,
  color: "#0f172a",
  fontSize: 16,
}
const invoiceFallbackStyle = {
  ...moduleValueStyle,
  color: "#94a3b8",
  fontStyle: "italic" as const,
}
const itemsHeadingStyle = { fontFamily: KARLA_FONT, fontWeight: 700, margin: 0, color: "#0f172a" }
const itemsTableHeadingStyle = { fontFamily: KARLA_FONT, fontWeight: 600, color: "#1f2937" }
const itemsInputStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 500,
  color: "#0f172a",
}
const paymentPalette = {
  green: { backgroundColor: "#dcfce7", color: "#166534" },
  red: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  default: { backgroundColor: "#e2e8f0", color: "#1f2937" },
} as const
const paymentTagBaseStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 600,
  borderRadius: 999,
  border: "none",
  padding: "2px 16px",
  fontSize: 13,
}

const formatProjectDateYmd = (
  iso: string | null | undefined,
  fallback: string | null | undefined,
) => {
  const attemptFormat = (value: string | null | undefined) => {
    if (!value || value.trim().length === 0) {
      return null
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return null
    }
    const year = parsed.getFullYear()
    const month = `${parsed.getMonth() + 1}`.padStart(2, "0")
    const day = `${parsed.getDate()}`.padStart(2, "0")
    return `${year}/${month}/${day}`
  }

  return attemptFormat(iso) ?? attemptFormat(fallback) ?? "-"
}

const generateInvoiceFallback = (
  projectNumber: string | null | undefined,
  projectDateIso: string | null | undefined,
): string | null => {
  if (!projectNumber || projectNumber.trim().length === 0) {
    return null
  }
  if (!projectDateIso || projectDateIso.trim().length === 0) {
    return `${projectNumber}`
  }
  const parsed = new Date(projectDateIso)
  if (Number.isNaN(parsed.getTime())) {
    return `${projectNumber}`
  }
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0")
  const day = `${parsed.getDate()}`.padStart(2, "0")
  return `${projectNumber}-${month}${day}`
}

const ProjectsShowContent = () => {
  const router = useRouter()
  const { message } = AntdApp.useApp()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<NormalizedProject | null>(null)
  const [client, setClient] = useState<NormalizedClient | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const itemIdRef = useRef(0)

  const projectId = useMemo(() => {
    const raw = router.query.projectId
    if (Array.isArray(raw)) {
      return raw[0]
    }
    return raw
  }, [router.query.projectId])

  const handleBack = useCallback(() => {
    router.push("/dashboard/new-ui/projects")
  }, [router])

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") {
      return
    }

    const controller = new AbortController()
    const loadProject = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/projects/by-id/${encodeURIComponent(projectId)}`, {
          credentials: "include",
          signal: controller.signal,
        })

        const payload = (await response.json().catch(() => ({}))) as ProjectShowResponse & {
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load project")
        }

        if (!payload.data) {
          throw new Error("Project not found")
        }

        setProject(normalizeProject(payload.data))
        setClient(payload.client ? normalizeClient(payload.client) : null)
        setItems([])
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        const description =
          error instanceof Error ? error.message : "Unable to retrieve project details"
        message.error(description)
        setProject(null)
        setClient(null)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadProject()

    return () => {
      controller.abort()
    }
  }, [message, projectId, router.isReady])

  const handleAddItem = useCallback(() => {
    setItems((previous) => {
      const nextId = itemIdRef.current + 1
      itemIdRef.current = nextId
      return [
        ...previous,
        {
          key: `item-${nextId}`,
          type: "item" as const,
          name: "",
          quantity: 1,
          unitPrice: 0,
          discount: 0,
        },
      ]
    })
  }, [])

  const handleItemChange = useCallback(
    (key: string, field: InvoiceItemField, value: string | number) => {
      setItems((previous) =>
        previous.map((item) => {
          if (item.key !== key) {
            return item
          }
          if (field === "quantity" || field === "unitPrice" || field === "discount") {
            const numericValue =
              typeof value === "number" && !Number.isNaN(value)
                ? value
                : Number(value) || 0
            return {
              ...item,
              [field]: numericValue,
            }
          }
          return {
            ...item,
            [field]: typeof value === "string" ? value : `${value}`,
          }
        }),
      )
    },
    [],
  )

  const handleRemoveItem = useCallback((key: string) => {
    setItems((previous) => previous.filter((item) => item.key !== key))
  }, [])

  const itemsColumns: ColumnsType<InvoiceTableRow> = useMemo(
    () => [
      {
        key: "name",
        dataIndex: "name",
        title: <span style={itemsTableHeadingStyle}>Title</span>,
        onCell: (record) => (isAdderRow(record) ? { colSpan: 5, className: "invoice-add-row" } : {}),
        render: (_: string, record: InvoiceTableRow) => {
          if (isAdderRow(record)) {
            return (
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={handleAddItem}
                className="add-item-trigger"
              >
                Add new item
              </Button>
            )
          }
          return (
            <div className="item-title-cell">
              <Input
                value={record.name}
                placeholder="Item title"
                bordered={false}
                onChange={(event) => handleItemChange(record.key, "name", event.target.value)}
                style={{ ...itemsInputStyle, flex: 1 }}
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveItem(record.key)}
                className="remove-item-button"
              />
            </div>
          )
        },
      },
      {
        key: "unitPrice",
        dataIndex: "unitPrice",
        title: <span style={itemsTableHeadingStyle}>Unit Price</span>,
        width: 140,
        align: "right",
        onCell: (record) => (isAdderRow(record) ? { colSpan: 0 } : {}),
        render: (_: number, record: InvoiceTableRow) => {
          if (isAdderRow(record)) {
            return null
          }
          return (
            <InputNumber
              min={0}
              value={record.unitPrice}
              bordered={false}
              formatter={(value) => (value !== undefined ? `${value}` : "0")}
              onChange={(value) => handleItemChange(record.key, "unitPrice", value ?? 0)}
              style={{ ...itemsInputStyle, width: "100%" }}
            />
          )
        },
      },
      {
        key: "quantity",
        dataIndex: "quantity",
        title: <span style={itemsTableHeadingStyle}>Quantity</span>,
        width: 120,
        align: "right",
        onCell: (record) => (isAdderRow(record) ? { colSpan: 0 } : {}),
        render: (_: number, record: InvoiceTableRow) => {
          if (isAdderRow(record)) {
            return null
          }
          return (
            <InputNumber
              min={0}
              value={record.quantity}
              bordered={false}
              onChange={(value) => handleItemChange(record.key, "quantity", value ?? 0)}
              style={{ ...itemsInputStyle, width: "100%" }}
            />
          )
        },
      },
      {
        key: "discount",
        dataIndex: "discount",
        title: <span style={itemsTableHeadingStyle}>Discount</span>,
        width: 140,
        align: "right",
        onCell: (record) => (isAdderRow(record) ? { colSpan: 0 } : {}),
        render: (_: number, record: InvoiceTableRow) => {
          if (isAdderRow(record)) {
            return null
          }
          return (
            <InputNumber
              min={0}
              value={record.discount}
              bordered={false}
              formatter={(value) => (value !== undefined ? `${value}` : "0")}
              onChange={(value) => handleItemChange(record.key, "discount", value ?? 0)}
              style={{ ...itemsInputStyle, width: "100%" }}
            />
          )
        },
      },
      {
        key: "total",
        dataIndex: "total",
        title: <span style={itemsTableHeadingStyle}>Total Price</span>,
        align: "right",
        onCell: (record) => (isAdderRow(record) ? { colSpan: 0 } : {}),
        render: (_: unknown, record: InvoiceTableRow) => {
          if (isAdderRow(record)) {
            return null
          }
          const lineTotal = record.quantity * record.unitPrice - record.discount
          const safeTotal = lineTotal >= 0 ? lineTotal : 0
          return <span style={itemsInputStyle}>{amountText(safeTotal)}</span>
        },
      },
    ],
    [handleAddItem, handleItemChange, handleRemoveItem],
  )

  const tableData = useMemo<InvoiceTableRow[]>(
    () => [...items, { key: "add-row", type: "adder" as const }],
    [items],
  )

  const paidChipKey = paymentChipColor(project?.paid ?? null)
  const paidChipPalette = paymentPalette[paidChipKey] ?? paymentPalette.default
  const paidOnText = paidDateText(project?.paid ?? null, project?.onDateDisplay ?? null)

  const normalizedInvoice = project?.invoice?.trim() ?? ""
  const invoiceFallback = generateInvoiceFallback(
    project?.projectNumber ?? null,
    project?.projectDateIso ?? null,
  )
  const hasStoredInvoice = normalizedInvoice.length > 0
  const invoiceDisplay = hasStoredInvoice
    ? normalizedInvoice
    : invoiceFallback ?? "N/A"
  const invoiceStyle = hasStoredInvoice ? moduleValueStyle : invoiceFallbackStyle

  let statusIndex = 0
  if (hasStoredInvoice) {
    statusIndex = 1
  }
  if (project?.paid) {
    statusIndex = 2
  }

  const statusSteps = [
    { key: "saved", label: "Project Saved" },
    { key: "invoice", label: "Invoice Drafted" },
    { key: "payment", label: "Payment Received" },
  ]

  const itemsTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const lineTotal = item.quantity * item.unitPrice - item.discount
        const safeTotal = lineTotal >= 0 ? lineTotal : 0
        return sum + safeTotal
      }, 0),
    [items],
  )

  const resolvedAmount = items.length > 0 ? itemsTotal : project?.amount ?? null

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 16px",
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (!project) {
    return (
      <div
        style={{
          padding: "48px 16px",
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Space direction="vertical" align="center" size={24}>
          <Empty description="Project unavailable" />
          <Button type="primary" onClick={handleBack} icon={<ArrowLeftOutlined />}>
            Back to Projects
          </Button>
        </Space>
      </div>
    )
  }

  const descriptorNumber = stringOrNA(project.projectNumber)
  const descriptorDate = formatProjectDateYmd(project.projectDateIso, project.projectDateDisplay)
  const companyDisplay = client?.companyName ?? project.clientCompany
  const addressLine1 = client?.addressLine1 ?? null
  const addressLine2 = client?.addressLine2 ?? null
  const addressLine3 = mergeLineWithRegion(client?.addressLine3 ?? null, client?.region ?? null)
  const representativeDisplay = client?.representative ?? null

  return (
    <div
      style={{
        padding: "32px 24px",
        minHeight: "100%",
        background: "#f8fafc",
        fontFamily: KARLA_FONT,
      }}
    >
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        <div>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            style={{
              paddingLeft: 0,
              fontFamily: KARLA_FONT,
              fontWeight: 600,
              color: "#2563eb",
            }}
          >
            Back to Projects
          </Button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 320px" }}>
              <div style={descriptorWrapperStyle}>
                <span style={descriptorNumberStyle}>{descriptorNumber}</span>
                <span style={descriptorSeparatorStyle}>/</span>
                <span style={descriptorDateStyle}>{descriptorDate}</span>
              </div>
              <Title level={2} style={projectTitleStyle}>
                {stringOrNA(project.projectTitle)}
              </Title>
              <span style={projectNatureStyle}>{stringOrNA(project.projectNature)}</span>
              {project.subsidiary ? (
                <Tag style={subsidiaryChipStyle}>{stringOrNA(project.subsidiary)}</Tag>
              ) : null}
            </div>
            <Button
              type="default"
              icon={<EditOutlined />}
              style={{
                fontFamily: KARLA_FONT,
                fontWeight: 600,
                background: "#fff",
                borderColor: "#dbeafe",
                color: "#1d4ed8",
              }}
            >
              Edit
            </Button>
          </div>
          <div className="status-flow">
            {statusSteps.map((step, index) => {
              const isCurrent = statusIndex === index
              const isCompleted = statusIndex > index
              const classes = ["status-step"]
              if (index === 0) {
                classes.push("first")
              }
              if (index === statusSteps.length - 1) {
                classes.push("last")
              }
              if (isCurrent) {
                classes.push("current")
              } else if (isCompleted) {
                classes.push("completed")
              }
              return (
                <div key={step.key} className={classes.join(" ")}>
                  <span>{step.label}</span>
                </div>
              )
            })}
          </div>
        </div>
        <Card bordered={false} style={{ borderRadius: 18 }}>
          <Space direction="vertical" size={24} style={{ width: "100%" }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <Space direction="vertical" size={4}>
                  <Text style={companyNameStyle}>{stringOrNA(companyDisplay)}</Text>
                  {addressLine1 ? <Text style={addressLineStyle}>{addressLine1}</Text> : null}
                  {addressLine2 ? <Text style={addressLineStyle}>{addressLine2}</Text> : null}
                  {addressLine3 ? <Text style={addressLineStyle}>{addressLine3}</Text> : null}
                  {representativeDisplay ? (
                    <Text style={addressLineStyle}>{representativeDisplay}</Text>
                  ) : null}
                </Space>
              </Col>
              <Col
                xs={24}
                md={12}
                style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}
              >
                <Space
                  direction="vertical"
                  align="end"
                  size={16}
                  style={{ width: "100%", maxWidth: 280 }}
                >
                  <div style={{ textAlign: "right" }}>
                    <div style={moduleLabelStyle}>Invoice Number</div>
                    <div style={invoiceStyle}>{invoiceDisplay}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={moduleLabelStyle}>Amount</div>
                    <div style={{ ...moduleValueStyle, fontSize: 18 }}>
                      {amountText(resolvedAmount)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={moduleLabelStyle}>Payment Status</div>
                    <Tag
                      style={{
                        ...paymentTagBaseStyle,
                        backgroundColor: paidChipPalette.backgroundColor,
                        color: paidChipPalette.color,
                      }}
                    >
                      {paymentChipLabel(project.paid)}
                    </Tag>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={moduleLabelStyle}>Paid On</div>
                    <div style={moduleValueStyle}>{paidOnText}</div>
                  </div>
                </Space>
              </Col>
            </Row>
            <Divider style={{ margin: 0 }} />
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <Title level={4} style={itemsHeadingStyle}>
                  Items / Services
                </Title>
              </div>
              <Table<InvoiceTableRow>
                className="invoice-items-table"
                dataSource={tableData}
                columns={itemsColumns}
                pagination={false}
                locale={{ emptyText: null }}
                rowKey="key"
                rowClassName={(record) => (isAdderRow(record) ? "invoice-add-row" : "")}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={moduleLabelStyle}>Total</div>
                  <div style={{ ...moduleValueStyle, fontSize: 18 }}>
                    {amountText(resolvedAmount)}
                  </div>
                </div>
              </div>
            </div>
          </Space>
        </Card>
      </Space>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx>{`
        .status-flow {
          display: flex;
          flex-wrap: nowrap;
          font-family: 'Karla', sans-serif;
          font-weight: 600;
          overflow-x: auto;
        }

        .status-step {
          position: relative;
          padding: 10px 28px;
          background: #f1f5f9;
          color: #1e293b;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 150px;
          text-align: center;
          line-height: 1.2;
        }

        .status-step span {
          position: relative;
          z-index: 1;
          white-space: nowrap;
        }

        .status-step + .status-step {
          margin-left: -18px;
        }

        .status-step.first {
          border-radius: 999px 0 0 999px;
          padding-left: 32px;
        }

        .status-step.last {
          border-radius: 0 999px 999px 0;
          padding-right: 32px;
        }

        .status-step::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          box-shadow: inset 0 0 0 1px #cbd5f5;
        }

        .status-step::after {
          content: '';
          position: absolute;
          top: 0;
          right: -32px;
          width: 32px;
          height: 100%;
          background: inherit;
          clip-path: polygon(0 0, 100% 50%, 0 100%);
          box-shadow: inset -1px 0 0 0 #cbd5f5;
        }

        .status-step.last::after {
          display: none;
        }

        .status-step.current {
          background: #2563eb;
          color: #ffffff;
        }

        .status-step.current::before {
          box-shadow: none;
        }

        .status-step.current::after {
          background: #2563eb;
          box-shadow: none;
        }

        .status-step.completed {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-step.completed::before,
        .status-step.completed::after {
          box-shadow: none;
        }
      `}</style>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx global>{`
        .invoice-items-table .ant-table {
          border-radius: 18px;
        }

        .invoice-items-table .ant-table-container {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
        }

        .invoice-items-table .ant-table-thead > tr > th {
          background: #f8fafc;
          font-family: 'Karla', sans-serif;
          font-weight: 600;
          color: #0f172a;
          padding: 14px 16px;
        }

        .invoice-items-table .ant-table-tbody > tr > td {
          font-family: 'Karla', sans-serif;
          font-weight: 500;
          color: #0f172a;
          padding: 12px 16px;
        }

        .invoice-items-table .ant-table-thead > tr > th:first-child {
          border-top-left-radius: 18px;
        }

        .invoice-items-table .ant-table-thead > tr > th:last-child {
          border-top-right-radius: 18px;
        }

        .invoice-items-table .ant-input,
        .invoice-items-table .ant-input-number-input {
          font-family: 'Karla', sans-serif;
        }

        .invoice-items-table .ant-input-number {
          width: 100%;
        }

        .invoice-items-table .invoice-add-row > td {
          border-top: 1px solid #e2e8f0;
        }

        .invoice-items-table .add-item-trigger {
          font-family: 'Karla', sans-serif;
          font-weight: 600;
          color: #2563eb;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .invoice-items-table .add-item-trigger .anticon {
          font-size: 14px;
        }

        .invoice-items-table .item-title-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .invoice-items-table .remove-item-button {
          color: #ef4444;
        }

        .invoice-items-table .remove-item-button:hover {
          color: #dc2626;
        }
      `}</style>
    </div>
  )
}

const ProjectsShowApp = () => (
  <AppShell
    dataProvider={projectsDataProvider}
    resources={[
      { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
      {
        name: "client-directory",
        list: "/dashboard/new-ui/client-accounts",
        meta: { label: "Client Accounts" },
      },
      {
        name: "projects",
        list: "/dashboard/new-ui/projects",
        meta: { label: "Projects" },
      },
    ]}
    allowedMenuKeys={["dashboard", "client-directory", "projects"]}
  >
    <ProjectsShowContent />
  </AppShell>
)

export default ProjectsShowApp
