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

import type { ProjectRecord } from "../../lib/projectsDatabase"
import AppShell from "../new-ui/AppShell"
import {
  amountText,
  normalizeProject,
  paidDateText,
  paymentChipColor,
  paymentChipLabel,
  stringOrNA,
  type NormalizedProject,
} from "./projectUtils"
import { projectsDataProvider } from "./NewUIProjectsApp"

const { Title, Text } = Typography

type ProjectShowResponse = {
  data?: ProjectRecord
}

type InvoiceItem = {
  key: string
  name: string
  description: string
  quantity: number
  unitPrice: number
}

type InvoiceItemField = keyof Pick<InvoiceItem, "name" | "description" | "quantity" | "unitPrice">

const descriptorLineStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 300,
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.2,
}
const projectTitleStyle = { fontFamily: "'Cantata One'", fontWeight: 400, margin: 0 }
const projectNatureStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 400,
  fontStyle: "italic",
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.2,
}
const subsidiaryChipStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 500,
  borderRadius: 999,
  backgroundColor: "#e0f2fe",
  color: "#0c4a6e",
  border: "none",
  padding: "2px 14px",
  fontSize: 12,
  marginTop: 8,
  width: "fit-content" as const,
}
const statusButtonStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 500,
}
const companyNameStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 600,
  fontSize: 18,
  color: "#0f172a",
}
const addressLineStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 400,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.4,
}
const moduleLabelStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 500,
  letterSpacing: 0.6,
  textTransform: "uppercase" as const,
  color: "#94a3b8",
  fontSize: 12,
}
const moduleValueStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 500,
  color: "#0f172a",
  fontSize: 16,
}
const invoiceFallbackStyle = {
  ...moduleValueStyle,
  color: "#94a3b8",
  fontStyle: "italic" as const,
}
const itemsHeadingStyle = { fontFamily: "'Cantata One'", fontWeight: 400, margin: 0 }
const itemsTableHeadingStyle = { fontFamily: "'Cantata One'", fontWeight: 400 }
const itemsInputStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 400,
  color: "#0f172a",
}
const paymentPalette = {
  green: { backgroundColor: "#dcfce7", color: "#166534" },
  red: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  default: { backgroundColor: "#e2e8f0", color: "#1f2937" },
} as const
const paymentTagBaseStyle = {
  fontFamily: "'Newsreader'",
  fontWeight: 500,
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

const combineLineWithRegion = (
  line: string | null | undefined,
  region: string | null | undefined,
) => {
  const normalizedLine = stringOrNA(line)
  const normalizedRegion = stringOrNA(region)
  if (normalizedLine === "N/A" && normalizedRegion === "N/A") {
    return "N/A"
  }
  if (normalizedLine === "N/A") {
    return normalizedRegion
  }
  if (normalizedRegion === "N/A") {
    return normalizedLine
  }
  return `${normalizedLine}, ${normalizedRegion}`
}

const ProjectsShowContent = () => {
  const router = useRouter()
  const { message } = AntdApp.useApp()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<NormalizedProject | null>(null)
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
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        const description =
          error instanceof Error ? error.message : "Unable to retrieve project details"
        message.error(description)
        setProject(null)
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
          name: "",
          description: "",
          quantity: 1,
          unitPrice: 0,
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
          if (field === "quantity" || field === "unitPrice") {
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

  const itemsColumns: ColumnsType<InvoiceItem> = useMemo(
    () => [
      {
        key: "name",
        dataIndex: "name",
        title: <span style={itemsTableHeadingStyle}>Item</span>,
        render: (_: string, record: InvoiceItem) => (
          <Input
            value={record.name}
            placeholder="Item name"
            bordered={false}
            onChange={(event) => handleItemChange(record.key, "name", event.target.value)}
            style={itemsInputStyle}
          />
        ),
      },
      {
        key: "description",
        dataIndex: "description",
        title: <span style={itemsTableHeadingStyle}>Description</span>,
        render: (_: string, record: InvoiceItem) => (
          <Input
            value={record.description}
            placeholder="Description"
            bordered={false}
            onChange={(event) =>
              handleItemChange(record.key, "description", event.target.value)
            }
            style={itemsInputStyle}
          />
        ),
      },
      {
        key: "quantity",
        dataIndex: "quantity",
        title: <span style={itemsTableHeadingStyle}>Qty</span>,
        width: 100,
        render: (_: number, record: InvoiceItem) => (
          <InputNumber
            min={0}
            value={record.quantity}
            bordered={false}
            onChange={(value) => handleItemChange(record.key, "quantity", value ?? 0)}
            style={{ ...itemsInputStyle, width: "100%" }}
          />
        ),
      },
      {
        key: "unitPrice",
        dataIndex: "unitPrice",
        title: <span style={itemsTableHeadingStyle}>Rate</span>,
        width: 140,
        render: (_: number, record: InvoiceItem) => (
          <InputNumber
            min={0}
            value={record.unitPrice}
            bordered={false}
            formatter={(value) => (value !== undefined ? `${value}` : "0")}
            onChange={(value) => handleItemChange(record.key, "unitPrice", value ?? 0)}
            style={{ ...itemsInputStyle, width: "100%" }}
          />
        ),
      },
      {
        key: "amount",
        dataIndex: "amount",
        title: <span style={itemsTableHeadingStyle}>Amount</span>,
        align: "right",
        render: (_: unknown, record: InvoiceItem) => {
          const total = record.quantity * record.unitPrice
          return <span style={itemsInputStyle}>{amountText(total)}</span>
        },
      },
      {
        key: "actions",
        dataIndex: "actions",
        align: "center",
        width: 80,
        render: (_: unknown, record: InvoiceItem) => (
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveItem(record.key)}
          />
        ),
      },
    ],
    [handleItemChange, handleRemoveItem],
  )

  const paidChipKey = paymentChipColor(project?.paid ?? null)
  const paidChipPalette = paymentPalette[paidChipKey] ?? paymentPalette.default
  const paidOnText = paidDateText(project?.paid ?? null, project?.onDateDisplay ?? null)

  const formattedDescriptor = project
    ? `${stringOrNA(project.projectNumber)} / ${formatProjectDateYmd(
        project.projectDateIso,
        project.projectDateDisplay,
      )}`
    : "-"

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
    () => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
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

  return (
    <div
      style={{
        padding: "32px 24px",
        minHeight: "100%",
        background: "#f8fafc",
      }}
    >
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        <div>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            style={{ paddingLeft: 0, fontFamily: "'Newsreader'", fontWeight: 500 }}
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
              <span style={descriptorLineStyle}>{formattedDescriptor}</span>
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
                fontFamily: "'Newsreader'",
                fontWeight: 500,
                background: "#fff",
                borderColor: "#cbd5f5",
              }}
            >
              Edit
            </Button>
          </div>
          <Space size={12} wrap>
            {statusSteps.map((step, index) => {
              const reached = statusIndex >= index
              const isCurrent = statusIndex === index
              return (
                <Button
                  key={step.key}
                  type={reached ? "primary" : "default"}
                  ghost={reached && !isCurrent}
                  style={statusButtonStyle}
                >
                  {step.label}
                </Button>
              )
            })}
          </Space>
        </div>
        <Card bordered={false} style={{ borderRadius: 18 }}>
          <Space direction="vertical" size={24} style={{ width: "100%" }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <Space direction="vertical" size={4}>
                  <Text style={companyNameStyle}>{stringOrNA(project.clientCompany)}</Text>
                  <Text style={addressLineStyle}>{stringOrNA(null)}</Text>
                  <Text style={addressLineStyle}>{stringOrNA(null)}</Text>
                  <Text style={addressLineStyle}>
                    {combineLineWithRegion(null, project.subsidiary)}
                  </Text>
                  <Text style={addressLineStyle}>{stringOrNA(project.paidTo)}</Text>
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
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={handleAddItem}
                  style={{ fontFamily: "'Newsreader'", fontWeight: 500 }}
                >
                  Add Item
                </Button>
              </div>
              <Table<InvoiceItem>
                dataSource={items}
                columns={itemsColumns}
                pagination={false}
                locale={{ emptyText: "Add line items to build an invoice." }}
                rowKey="key"
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
