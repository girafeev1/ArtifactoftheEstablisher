/**
 * Tools App (Ant Design)
 *
 * Contains utility tools for the application.
 * Primary feature: Invoice Previewer for testing invoice layouts.
 */

import React, { useState, useMemo, useCallback } from "react"
import AppShell from "../new-ui/AppShell"
import {
  Row,
  Col,
  Card,
  Typography,
  Button,
  Space,
  Select,
  InputNumber,
  Slider,
  Divider,
  Empty,
  Collapse,
  Switch,
  Tag,
  Tooltip,
} from "antd"
import {
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  SettingOutlined,
  AppstoreOutlined,
  HomeOutlined,
  TeamOutlined,
  ProjectOutlined,
  BankOutlined,
  ReadOutlined,
  ToolOutlined,
  UserOutlined,
  DollarOutlined,
  CalendarOutlined,
  FolderOutlined,
  BarChartOutlined,
  SettingFilled,
  DatabaseOutlined,
  FileOutlined,
  ShopOutlined,
  CreditCardOutlined,
  WalletOutlined,
  AuditOutlined,
  SolutionOutlined,
  ContactsOutlined,
  IdcardOutlined,
  ScheduleOutlined,
  BookOutlined,
  FormOutlined,
  ProfileOutlined,
  FileDoneOutlined,
  ContainerOutlined,
  InboxOutlined,
  LayoutOutlined,
  TableOutlined,
  MenuOutlined,
} from "@ant-design/icons"
import { Invoice } from "../../lib/invoice"
import type { InvoiceItem, SubsidiaryDoc, BankInfo, ProjectInvoiceRecord } from "../../lib/invoice/types"
import type { ProjectRecord } from "../../lib/projectsDatabase"

const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse

// Sidebar icon options with names for easy reference
const SIDEBAR_ICONS = [
  { name: "Home", icon: <HomeOutlined />, key: "home" },
  { name: "Dashboard", icon: <AppstoreOutlined />, key: "dashboard" },
  { name: "Team / Clients", icon: <TeamOutlined />, key: "team" },
  { name: "Project", icon: <ProjectOutlined />, key: "project" },
  { name: "Bank / Finance", icon: <BankOutlined />, key: "bank" },
  { name: "Read / Education", icon: <ReadOutlined />, key: "read" },
  { name: "Tools", icon: <ToolOutlined />, key: "tool" },
  { name: "User", icon: <UserOutlined />, key: "user" },
  { name: "Dollar / Money", icon: <DollarOutlined />, key: "dollar" },
  { name: "Calendar", icon: <CalendarOutlined />, key: "calendar" },
  { name: "Folder", icon: <FolderOutlined />, key: "folder" },
  { name: "Bar Chart", icon: <BarChartOutlined />, key: "barchart" },
  { name: "Settings (Filled)", icon: <SettingFilled />, key: "settingfilled" },
  { name: "Settings (Outlined)", icon: <SettingOutlined />, key: "setting" },
  { name: "Database", icon: <DatabaseOutlined />, key: "database" },
  { name: "File", icon: <FileOutlined />, key: "file" },
  { name: "File Text", icon: <FileTextOutlined />, key: "filetext" },
  { name: "Shop / Store", icon: <ShopOutlined />, key: "shop" },
  { name: "Credit Card", icon: <CreditCardOutlined />, key: "creditcard" },
  { name: "Wallet", icon: <WalletOutlined />, key: "wallet" },
  { name: "Audit", icon: <AuditOutlined />, key: "audit" },
  { name: "Solution", icon: <SolutionOutlined />, key: "solution" },
  { name: "Contacts", icon: <ContactsOutlined />, key: "contacts" },
  { name: "ID Card", icon: <IdcardOutlined />, key: "idcard" },
  { name: "Schedule", icon: <ScheduleOutlined />, key: "schedule" },
  { name: "Book", icon: <BookOutlined />, key: "book" },
  { name: "Form", icon: <FormOutlined />, key: "form" },
  { name: "Profile", icon: <ProfileOutlined />, key: "profile" },
  { name: "File Done", icon: <FileDoneOutlined />, key: "filedone" },
  { name: "Container", icon: <ContainerOutlined />, key: "container" },
  { name: "Inbox", icon: <InboxOutlined />, key: "inbox" },
  { name: "Layout", icon: <LayoutOutlined />, key: "layout" },
  { name: "Table", icon: <TableOutlined />, key: "table" },
  { name: "Menu", icon: <MenuOutlined />, key: "menu" },
]

// Placeholder text generators
const generatePlaceholderTitle = (length: number): string => {
  const words = [
    "Professional", "Consulting", "Advisory", "Strategic", "Technical",
    "Development", "Analysis", "Management", "Implementation", "Review",
    "Assessment", "Planning", "Design", "Integration", "Support",
    "Training", "Optimization", "Enhancement", "Deployment", "Services",
  ]
  let result = ""
  let wordIndex = 0
  while (result.length < length) {
    result += (result.length > 0 ? " " : "") + words[wordIndex % words.length]
    wordIndex++
  }
  return result.substring(0, length).trim()
}

const generatePlaceholderFeeType = (length: number): string => {
  const types = [
    "Hourly Rate", "Fixed Fee", "Retainer Fee", "Project Fee",
    "Consulting Fee", "Advisory Fee", "Service Charge", "Professional Fee",
  ]
  const base = types[Math.floor(Math.random() * types.length)]
  if (base.length >= length) return base.substring(0, length)
  return (base + " - Additional Description").substring(0, length)
}

const generatePlaceholderNotes = (lines: number, charsPerLine: number): string => {
  const sentences = [
    "Services rendered as per agreement.",
    "Work completed according to specifications.",
    "Includes all materials and labor costs.",
    "Subject to standard terms and conditions.",
    "Payment due within 30 days of invoice date.",
    "Please reference invoice number for payments.",
    "Additional work may be quoted separately.",
    "Approved by project manager before billing.",
  ]
  const result: string[] = []
  for (let i = 0; i < lines; i++) {
    let line = sentences[i % sentences.length]
    while (line.length < charsPerLine) {
      line += " " + sentences[(i + result.length) % sentences.length]
    }
    result.push(line.substring(0, charsPerLine).trim())
  }
  return result.join("\n")
}

interface ItemConfig {
  id: number
  titleLength: number
  feeTypeLength: number
  notesLines: number
  notesCharsPerLine: number
  unitPrice: number
  quantity: number
  quantityUnit: string
  hasSubQuantity: boolean
  hasDiscount: boolean
  discountAmount: number
}

const defaultItemConfig = (): ItemConfig => ({
  id: Date.now(),
  titleLength: 40,
  feeTypeLength: 15,
  notesLines: 1,
  notesCharsPerLine: 60,
  unitPrice: 1500,
  quantity: 8,
  quantityUnit: "hours",
  hasSubQuantity: false,
  hasDiscount: false,
  discountAmount: 0,
})

// Mock data for preview
const mockSubsidiary: SubsidiaryDoc = {
  identifier: "mock-sub",
  englishName: "The Establisher Company Limited",
  chineseName: "創立者有限公司",
  addressLine1: "Unit 1234, 12/F",
  addressLine2: "Tower A, Business Centre",
  addressLine3: "123 Example Road, Central",
  region: "Hong Kong",
  email: "info@establisher.example",
  phone: "+852 1234 5678",
}

const mockBankInfo: BankInfo = {
  bankName: "HSBC Hong Kong",
  bankCode: "004",
  accountNumber: "123-456789-001",
  fpsId: "12345678",
}

const mockProject: ProjectRecord = {
  id: "mock-project",
  year: new Date().getFullYear().toString(),
  amount: null,
  clientCompany: "Sample Client Company Ltd",
  invoice: null,
  onDateDisplay: null,
  onDateIso: null,
  paid: false,
  paidTo: null,
  paymentStatus: "Pending",
  presenterWorkType: "Consulting",
  projectDateDisplay: null,
  projectDateIso: new Date().toISOString().split("T")[0],
  projectNature: "Advisory",
  projectNumber: "PRJ-2024-001",
  projectTitle: "Sample Project for Invoice Testing",
  subsidiary: "mock-sub",
}

// Data provider for Refine (stub - this page doesn't use Refine data features)
const dataProvider = {
  getList: async () => ({ data: [] as any[], total: 0 }),
  getOne: async () => ({ data: {} as any }),
  create: async () => ({ data: {} as any }),
  update: async () => ({ data: {} as any }),
  deleteOne: async () => ({ data: {} as any }),
  getApiUrl: () => "",
}

export default function NewUIToolsApp() {
  const [itemConfigs, setItemConfigs] = useState<ItemConfig[]>([defaultItemConfig()])
  const [invoiceVersion, setInvoiceVersion] = useState<"A" | "B">("B")
  const [showDebugGrid, setShowDebugGrid] = useState(false)
  const [showFlexDebug, setShowFlexDebug] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState("INV-2024-TEST-001")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])

  // Generate invoice items from configs
  const invoiceItems: InvoiceItem[] = useMemo(() => {
    return itemConfigs.map((config, index) => ({
      title: generatePlaceholderTitle(config.titleLength),
      feeType: generatePlaceholderFeeType(config.feeTypeLength),
      unitPrice: config.unitPrice,
      quantity: config.quantity,
      quantityUnit: config.quantityUnit,
      subQuantity: config.hasSubQuantity ? config.quantity + " sessions" : undefined,
      notes: config.notesLines > 0
        ? generatePlaceholderNotes(config.notesLines, config.notesCharsPerLine)
        : undefined,
      discount: config.hasDiscount ? config.discountAmount : undefined,
    }))
  }, [itemConfigs])

  // Mock invoice record (partial - only fields needed for preview rendering)
  const mockInvoice = useMemo(() => ({
    collectionId: "mock-collection",
    invoiceNumber,
    baseInvoiceNumber: invoiceNumber,
    suffix: "",
    invoiceDate,
    companyName: "Sample Client Company Ltd",
    addressLine1: "Suite 5678, 56/F",
    addressLine2: "Client Tower",
    addressLine3: "456 Client Street, Admiralty",
    region: "Hong Kong",
    representative: {
      title: "Mr",
      firstName: "John",
      lastName: "Smith",
    },
    subtotal: null,
    taxOrDiscountPercent: null,
    total: null,
    amount: null,
    paid: false,
    paidOnIso: null,
    paidOnDisplay: null,
    paymentStatus: "Pending",
    paidTo: "mock-account",
    items: invoiceItems,
    projectId: "mock-project",
  } as ProjectInvoiceRecord), [invoiceNumber, invoiceDate, invoiceItems])

  const handleAddItem = useCallback(() => {
    setItemConfigs(prev => [...prev, defaultItemConfig()])
  }, [])

  const handleRemoveItem = useCallback((id: number) => {
    setItemConfigs(prev => prev.filter(item => item.id !== id))
  }, [])

  const handleUpdateItem = useCallback((id: number, updates: Partial<ItemConfig>) => {
    setItemConfigs(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))
  }, [])

  const handleDuplicateItem = useCallback((id: number) => {
    setItemConfigs(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      return [...prev, { ...item, id: Date.now() }]
    })
  }, [])

  return (
    <AppShell
      dataProvider={dataProvider}
      resources={[
        { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
        { name: "client-directory", list: "/dashboard/client-accounts", meta: { label: "Client Accounts" } },
        { name: "projects", list: "/dashboard/projects", meta: { label: "Projects" } },
        { name: "finance", list: "/dashboard/finance", meta: { label: "Finance" } },
        { name: "coaching-sessions", list: "/dashboard/coaching-sessions", meta: { label: "Coaching Sessions" } },
        { name: "tools", list: "/dashboard/tools", meta: { label: "Tools" } },
      ]}
      allowedMenuKeys={["dashboard", "client-directory", "projects", "finance", "coaching-sessions", "tools"]}
    >
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>Tools</Title>
          <Text type="secondary">Utility tools for testing and development</Text>
        </div>

        {/* Tool Cards - Collapsible */}
        <Collapse
          defaultActiveKey={["invoice-previewer"]}
          style={{ marginBottom: 24 }}
        >
          {/* Invoice Previewer Tool */}
          <Panel
            key="invoice-previewer"
            header={
              <Space>
                <FileTextOutlined />
                <span style={{ fontWeight: 500 }}>Invoice Previewer</span>
              </Space>
            }
            extra={
              <Space onClick={(e) => e.stopPropagation()}>
                <Text type="secondary">Version:</Text>
                <Select
                  value={invoiceVersion}
                  onChange={setInvoiceVersion}
                  style={{ width: 80 }}
                  size="small"
                  options={[
                    { label: "A", value: "A" },
                    { label: "B", value: "B" },
                  ]}
                />
                <Divider type="vertical" />
                <Text type="secondary">Debug Grid:</Text>
                <Switch size="small" checked={showDebugGrid} onChange={setShowDebugGrid} />
                <Text type="secondary">Flex Debug:</Text>
                <Switch size="small" checked={showFlexDebug} onChange={setShowFlexDebug} />
              </Space>
            }
          >
              <Row gutter={24}>
                {/* Controls Panel */}
                <Col xs={24} lg={8}>
                  <Card size="small" title="Item Configuration" style={{ marginBottom: 16 }}>
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Text strong>{itemConfigs.length} Item{itemConfigs.length !== 1 ? "s" : ""}</Text>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          size="small"
                          onClick={handleAddItem}
                        >
                          Add Item
                        </Button>
                      </div>
                      <Divider style={{ margin: "8px 0" }} />

                      <Collapse accordion size="small">
                        {itemConfigs.map((config, index) => (
                          <Panel
                            key={config.id}
                            header={
                              <Space>
                                <Text>Item {index + 1}</Text>
                                <Tag size="small">{config.titleLength} chars</Tag>
                                {config.notesLines > 0 && (
                                  <Tag size="small" color="blue">{config.notesLines} note lines</Tag>
                                )}
                              </Space>
                            }
                            extra={
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveItem(config.id)
                                }}
                                disabled={itemConfigs.length <= 1}
                              />
                            }
                          >
                            <Space direction="vertical" style={{ width: "100%" }} size="small">
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Title Length</Text>
                                <Slider
                                  min={10}
                                  max={100}
                                  value={config.titleLength}
                                  onChange={(v) => handleUpdateItem(config.id, { titleLength: v })}
                                />
                              </div>
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Fee Type Length</Text>
                                <Slider
                                  min={5}
                                  max={40}
                                  value={config.feeTypeLength}
                                  onChange={(v) => handleUpdateItem(config.id, { feeTypeLength: v })}
                                />
                              </div>
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Notes Lines (0 = no notes)</Text>
                                <Slider
                                  min={0}
                                  max={10}
                                  value={config.notesLines}
                                  onChange={(v) => handleUpdateItem(config.id, { notesLines: v })}
                                />
                              </div>
                              {config.notesLines > 0 && (
                                <div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>Chars per Note Line</Text>
                                  <Slider
                                    min={20}
                                    max={100}
                                    value={config.notesCharsPerLine}
                                    onChange={(v) => handleUpdateItem(config.id, { notesCharsPerLine: v })}
                                  />
                                </div>
                              )}
                              <Row gutter={8}>
                                <Col span={12}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>Unit Price</Text>
                                  <InputNumber
                                    style={{ width: "100%" }}
                                    size="small"
                                    value={config.unitPrice}
                                    onChange={(v) => handleUpdateItem(config.id, { unitPrice: v ?? 0 })}
                                  />
                                </Col>
                                <Col span={12}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>Quantity</Text>
                                  <InputNumber
                                    style={{ width: "100%" }}
                                    size="small"
                                    value={config.quantity}
                                    onChange={(v) => handleUpdateItem(config.id, { quantity: v ?? 0 })}
                                  />
                                </Col>
                              </Row>
                              <div>
                                <Space>
                                  <Switch
                                    size="small"
                                    checked={config.hasSubQuantity}
                                    onChange={(v) => handleUpdateItem(config.id, { hasSubQuantity: v })}
                                  />
                                  <Text type="secondary" style={{ fontSize: 12 }}>Sub-quantity</Text>
                                </Space>
                              </div>
                              <div>
                                <Space>
                                  <Switch
                                    size="small"
                                    checked={config.hasDiscount}
                                    onChange={(v) => handleUpdateItem(config.id, { hasDiscount: v })}
                                  />
                                  <Text type="secondary" style={{ fontSize: 12 }}>Discount</Text>
                                  {config.hasDiscount && (
                                    <InputNumber
                                      size="small"
                                      style={{ width: 80 }}
                                      value={config.discountAmount}
                                      onChange={(v) => handleUpdateItem(config.id, { discountAmount: v ?? 0 })}
                                    />
                                  )}
                                </Space>
                              </div>
                            </Space>
                          </Panel>
                        ))}
                      </Collapse>
                    </Space>
                  </Card>

                  <Card size="small" title="Invoice Settings">
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Invoice Number</Text>
                        <input
                          type="text"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                          style={{ width: "100%", padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: 4 }}
                        />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Invoice Date</Text>
                        <input
                          type="date"
                          value={invoiceDate}
                          onChange={(e) => setInvoiceDate(e.target.value)}
                          style={{ width: "100%", padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: 4 }}
                        />
                      </div>
                    </Space>
                  </Card>
                </Col>

                {/* Preview Panel */}
                <Col xs={24} lg={16}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <EyeOutlined />
                        <span>Invoice Preview</span>
                        <Tag>{itemConfigs.length} items</Tag>
                      </Space>
                    }
                    bodyStyle={{
                      backgroundColor: "#f5f5f5",
                      padding: 16,
                      maxHeight: "80vh",
                      overflow: "auto",
                    }}
                  >
                    {itemConfigs.length === 0 ? (
                      <Empty description="Add items to preview invoice" />
                    ) : (
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <Invoice
                          invoice={mockInvoice}
                          project={mockProject}
                          subsidiary={mockSubsidiary}
                          bankInfo={mockBankInfo}
                          variant={invoiceVersion}
                          debug={showDebugGrid}
                          flexDebug={showFlexDebug}
                        />
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
          </Panel>

          {/* Icon Picker Tool */}
          <Panel
            key="icon-picker"
            header={
              <Space>
                <AppstoreOutlined />
                <span style={{ fontWeight: 500 }}>Sidebar Icon Reference</span>
              </Space>
            }
          >
            <div style={{ padding: 16 }}>
              <Text type="secondary" style={{ marginBottom: 16, display: "block" }}>
                Available icons for sidebar navigation. Click to copy the icon name.
              </Text>
              <Row gutter={[16, 16]}>
                {SIDEBAR_ICONS.map((item) => (
                  <Col key={item.key} xs={12} sm={8} md={6} lg={4}>
                    <Card
                      size="small"
                      hoverable
                      style={{ textAlign: "center" }}
                      onClick={() => {
                        navigator.clipboard.writeText(item.name)
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 8, color: "#1890ff" }}>
                        {item.icon}
                      </div>
                      <Text style={{ fontSize: 12 }}>{item.name}</Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </Panel>
        </Collapse>
      </div>
    </AppShell>
  )
}
