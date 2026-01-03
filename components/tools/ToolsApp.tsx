/**
 * Tools App (Ant Design)
 *
 * Contains utility tools for the application.
 * Primary feature: Invoice Previewer for testing invoice layouts.
 */

import React, { useState, useMemo, useCallback, useEffect } from "react"
import AppShell from "../layout/AppShell"
import { NAVIGATION_RESOURCES, ALLOWED_MENU_KEYS } from "../../lib/navigation/resources"
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
  CalculatorOutlined,
  CloudOutlined,
  GoogleOutlined,
  ApiOutlined,
  CodeOutlined,
  BugOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  LockOutlined,
  GlobalOutlined,
  MailOutlined,
  MessageOutlined,
  NotificationOutlined,
  BellOutlined,
  HeartOutlined,
  StarOutlined,
  TagOutlined,
  FlagOutlined,
  PieChartOutlined,
  LineChartOutlined,
  AreaChartOutlined,
  FundOutlined,
  StockOutlined,
} from "@ant-design/icons"
import { Invoice } from "../../lib/invoice"
import { InvoiceGrid } from "../../lib/invoice/grid"
import { InvoiceHeaderFull, InvoiceHeaderFullVersionA, InvoiceHeaderContinuation } from "../../lib/invoice/components/headers"
import { FooterFull, FooterSimple } from "../../lib/invoice/components/footers"
import { TotalBox } from "../../lib/invoice/components/totals/TotalBox"
import { num2eng, num2chi } from "../../lib/invoiceFormat"
import type { InvoiceItem, SubsidiaryDoc, BankInfo, ProjectInvoiceRecord, InvoiceVariant } from "../../lib/invoice/types"
import type { ProjectRecord } from "../../lib/projectsDatabase"
import { fetchSubsidiaries } from "../../lib/subsidiaries"
import { listBanks, listAccounts, lookupAccount, type BankInfo as ErlBankInfo } from "../../lib/erlDirectory"

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
  { name: "Pie Chart", icon: <PieChartOutlined />, key: "piechart" },
  { name: "Line Chart", icon: <LineChartOutlined />, key: "linechart" },
  { name: "Area Chart", icon: <AreaChartOutlined />, key: "areachart" },
  { name: "Fund", icon: <FundOutlined />, key: "fund" },
  { name: "Stock", icon: <StockOutlined />, key: "stock" },
  { name: "Settings (Filled)", icon: <SettingFilled />, key: "settingfilled" },
  { name: "Settings (Outlined)", icon: <SettingOutlined />, key: "setting" },
  { name: "Database", icon: <DatabaseOutlined />, key: "database" },
  { name: "File", icon: <FileOutlined />, key: "file" },
  { name: "File Text", icon: <FileTextOutlined />, key: "filetext" },
  { name: "Shop / Store", icon: <ShopOutlined />, key: "shop" },
  { name: "Credit Card", icon: <CreditCardOutlined />, key: "creditcard" },
  { name: "Wallet", icon: <WalletOutlined />, key: "wallet" },
  { name: "Calculator", icon: <CalculatorOutlined />, key: "calculator" },
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
  { name: "Cloud", icon: <CloudOutlined />, key: "cloud" },
  { name: "Google", icon: <GoogleOutlined />, key: "google" },
  { name: "API", icon: <ApiOutlined />, key: "api" },
  { name: "Code", icon: <CodeOutlined />, key: "code" },
  { name: "Bug", icon: <BugOutlined />, key: "bug" },
  { name: "Rocket", icon: <RocketOutlined />, key: "rocket" },
  { name: "Thunderbolt", icon: <ThunderboltOutlined />, key: "thunderbolt" },
  { name: "Safety", icon: <SafetyOutlined />, key: "safety" },
  { name: "Lock", icon: <LockOutlined />, key: "lock" },
  { name: "Global", icon: <GlobalOutlined />, key: "global" },
  { name: "Mail", icon: <MailOutlined />, key: "mail" },
  { name: "Message", icon: <MessageOutlined />, key: "message" },
  { name: "Notification", icon: <NotificationOutlined />, key: "notification" },
  { name: "Bell", icon: <BellOutlined />, key: "bell" },
  { name: "Heart", icon: <HeartOutlined />, key: "heart" },
  { name: "Star", icon: <StarOutlined />, key: "star" },
  { name: "Tag", icon: <TagOutlined />, key: "tag" },
  { name: "Flag", icon: <FlagOutlined />, key: "flag" },
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
  payTo: null,
  paymentStatus: "Pending",
  presenterWorkType: "Consulting",
  projectDateDisplay: null,
  projectDateIso: new Date().toISOString().split("T")[0],
  projectNature: "Advisory",
  projectNumber: "PRJ-2024-001",
  projectTitle: "Sample Project for Invoice Testing",
  subsidiary: "mock-sub",
  workStatus: "active",
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

export default function ToolsApp() {
  const [itemConfigs, setItemConfigs] = useState<ItemConfig[]>([defaultItemConfig()])
  const [invoiceVersion, setInvoiceVersion] = useState<InvoiceVariant>("B")
  const [showDebugGrid, setShowDebugGrid] = useState(false)
  const [showFlexDebug, setShowFlexDebug] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState("INV-2024-TEST-001")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])
  const [manualTotal, setManualTotal] = useState<number | null>(null)

  // === Invoice Total Box State ===
  const [totalBoxAmount, setTotalBoxAmount] = useState<number>(12000)
  const [totalBoxEnglishOverride, setTotalBoxEnglishOverride] = useState<string>("")
  const [totalBoxChineseOverride, setTotalBoxChineseOverride] = useState<string>("")

  // === Invoice Component Showcase State ===
  const [showcaseSubsidiaries, setShowcaseSubsidiaries] = useState<SubsidiaryDoc[]>([])
  const [showcaseHeaderSubsidiary, setShowcaseHeaderSubsidiary] = useState<string>("")
  const [showcaseFooterSubsidiary, setShowcaseFooterSubsidiary] = useState<string>("")
  const [showcaseHeaderVersion, setShowcaseHeaderVersion] = useState<"full" | "fullVersionA" | "continuation">("full")
  const [showcaseFooterVersion, setShowcaseFooterVersion] = useState<"full" | "simple">("full")
  const [showcaseDebugGrid, setShowcaseDebugGrid] = useState(true)
  const [showcaseBankInfo, setShowcaseBankInfo] = useState<BankInfo>(mockBankInfo)

  // Fetch subsidiaries for showcase
  useEffect(() => {
    fetchSubsidiaries().then(subs => {
      setShowcaseSubsidiaries(subs)
      if (subs.length > 0) {
        if (!showcaseHeaderSubsidiary) setShowcaseHeaderSubsidiary(subs[0].identifier)
        if (!showcaseFooterSubsidiary) setShowcaseFooterSubsidiary(subs[0].identifier)
      }
    })
  }, [])

  // Get selected subsidiaries for showcase (separate for header and footer)
  const headerSubsidiary = useMemo(() => {
    return showcaseSubsidiaries.find(s => s.identifier === showcaseHeaderSubsidiary) || mockSubsidiary
  }, [showcaseSubsidiaries, showcaseHeaderSubsidiary])

  const footerSubsidiary = useMemo(() => {
    return showcaseSubsidiaries.find(s => s.identifier === showcaseFooterSubsidiary) || mockSubsidiary
  }, [showcaseSubsidiaries, showcaseFooterSubsidiary])

  // Mock invoice and project for showcase headers
  const showcaseMockInvoice: ProjectInvoiceRecord = useMemo(() => ({
    collectionId: "showcase",
    invoiceNumber: "2025-001-0102",
    baseInvoiceNumber: "2025-001-0102",
    suffix: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    companyName: "Sample Client Company Limited",
    addressLine1: "Suite 1234, 12/F",
    addressLine2: "Tower A, Business Centre",
    addressLine3: "123 Example Road, Central",
    region: "Hong Kong",
    representative: { title: "Mr", firstName: "John", lastName: "Smith" },
    subtotal: null,
    taxOrDiscountPercent: null,
    total: null,
    amount: null,
    paid: false,
    paidOnIso: null,
    paidOnDisplay: null,
    paymentStatus: "Due",
    paidTo: null,
    payTo: null,
    items: [],
    projectId: "showcase-project",
  }), [])

  const showcaseMockProject: ProjectRecord = useMemo(() => ({
    id: "showcase-project",
    year: new Date().getFullYear().toString(),
    amount: 12000,
    clientCompany: "Sample Client Company Limited",
    invoice: "2025-001-0102",
    onDateDisplay: null,
    onDateIso: null,
    paid: false,
    payTo: null,
    paymentStatus: "Due",
    presenterWorkType: "Consulting 顧問服務",
    projectDateDisplay: "January 2, 2025",
    projectDateIso: "2025-01-02",
    projectNature: "Advisory & Strategic Planning",
    projectNumber: "2025-001",
    projectTitle: "Strategic Business Advisory 企業策略顧問",
    subsidiary: showcaseHeaderSubsidiary || "mock-sub",
    workStatus: "active",
  }), [showcaseHeaderSubsidiary])

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
    total: manualTotal,
    amount: manualTotal,
    paid: false,
    paidOnIso: null,
    paidOnDisplay: null,
    paymentStatus: "Pending",
    paidTo: null,
    payTo: "mock-account",
    items: invoiceItems,
    projectId: "mock-project",
  } as ProjectInvoiceRecord), [invoiceNumber, invoiceDate, invoiceItems, manualTotal])

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
      resources={NAVIGATION_RESOURCES}
      allowedMenuKeys={ALLOWED_MENU_KEYS}
    >
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>Tools</Title>
          <Text type="secondary">Utility tools for testing and development</Text>
        </div>

        {/* Tool Cards - Collapsible (all collapsed by default) */}
        <Collapse
          defaultActiveKey={[]}
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
          >
            {/* Debug Grid Toggle */}
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Text type="secondary">Debug Grid:</Text>
              <Switch size="small" checked={showcaseDebugGrid} onChange={setShowcaseDebugGrid} />
            </div>

            {/* Nested Collapse for sub-sections */}
            <Collapse defaultActiveKey={[]} style={{ marginBottom: 0 }}>
              {/* Full Invoice Preview */}
              <Panel
                key="full-invoice"
                header={
                  <Space>
                    <EyeOutlined />
                    <span style={{ fontWeight: 500 }}>Full Invoice Preview</span>
                  </Space>
                }
              >
              {/* Controls Row */}
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <Space>
                  <Text type="secondary">Variant:</Text>
                  <Select
                    value={invoiceVersion}
                    onChange={setInvoiceVersion}
                    style={{ width: 100 }}
                    size="small"
                    options={[
                      { label: "B (Basic)", value: "B" },
                      { label: "B2", value: "B2" },
                      { label: "A", value: "A" },
                      { label: "A2", value: "A2" },
                    ]}
                  />
                </Space>
                <Space>
                  <Text type="secondary">Flex Debug:</Text>
                  <Switch size="small" checked={showFlexDebug} onChange={setShowFlexDebug} />
                </Space>
              </div>
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
                                onClick={(e: React.MouseEvent) => {
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
                                  onChange={(v: number) => handleUpdateItem(config.id, { titleLength: v })}
                                />
                              </div>
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Fee Type Length</Text>
                                <Slider
                                  min={5}
                                  max={40}
                                  value={config.feeTypeLength}
                                  onChange={(v: number) => handleUpdateItem(config.id, { feeTypeLength: v })}
                                />
                              </div>
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Notes Lines (0 = no notes)</Text>
                                <Slider
                                  min={0}
                                  max={10}
                                  value={config.notesLines}
                                  onChange={(v: number) => handleUpdateItem(config.id, { notesLines: v })}
                                />
                              </div>
                              {config.notesLines > 0 && (
                                <div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>Chars per Note Line</Text>
                                  <Slider
                                    min={20}
                                    max={100}
                                    value={config.notesCharsPerLine}
                                    onChange={(v: number) => handleUpdateItem(config.id, { notesCharsPerLine: v })}
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
                                    onChange={(v: number | null) => handleUpdateItem(config.id, { unitPrice: v ?? 0 })}
                                  />
                                </Col>
                                <Col span={12}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>Quantity</Text>
                                  <InputNumber
                                    style={{ width: "100%" }}
                                    size="small"
                                    value={config.quantity}
                                    onChange={(v: number | null) => handleUpdateItem(config.id, { quantity: v ?? 0 })}
                                  />
                                </Col>
                              </Row>
                              <div>
                                <Space>
                                  <Switch
                                    size="small"
                                    checked={config.hasSubQuantity}
                                    onChange={(v: boolean) => handleUpdateItem(config.id, { hasSubQuantity: v })}
                                  />
                                  <Text type="secondary" style={{ fontSize: 12 }}>Sub-quantity</Text>
                                </Space>
                              </div>
                              <div>
                                <Space>
                                  <Switch
                                    size="small"
                                    checked={config.hasDiscount}
                                    onChange={(v: boolean) => handleUpdateItem(config.id, { hasDiscount: v })}
                                  />
                                  <Text type="secondary" style={{ fontSize: 12 }}>Discount</Text>
                                  {config.hasDiscount && (
                                    <InputNumber
                                      size="small"
                                      style={{ width: 80 }}
                                      value={config.discountAmount}
                                      onChange={(v: number | null) => handleUpdateItem(config.id, { discountAmount: v ?? 0 })}
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
                          debug={showcaseDebugGrid}
                          flexDebug={showFlexDebug}
                        />
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
              </Panel>

              {/* Headers Section */}
              <Panel
                key="headers"
                header={
                  <Space>
                    <LayoutOutlined />
                    <span style={{ fontWeight: 500 }}>Headers</span>
                  </Space>
                }
              >
                {/* Controls Row */}
                <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <Space>
                    <Text type="secondary">Subsidiary:</Text>
                    <Select
                      value={showcaseHeaderSubsidiary}
                      onChange={setShowcaseHeaderSubsidiary}
                      style={{ width: 200 }}
                      size="small"
                      options={showcaseSubsidiaries.map(s => ({
                        label: s.englishName || s.identifier,
                        value: s.identifier,
                      }))}
                      placeholder="Select subsidiary"
                    />
                  </Space>
                  <Space>
                    <Text type="secondary">Version:</Text>
                    <Select
                      value={showcaseHeaderVersion}
                      onChange={setShowcaseHeaderVersion}
                      style={{ width: 180 }}
                      size="small"
                      options={[
                        { label: "Full B (Page 1)", value: "full" },
                        { label: "Full A (Page 1)", value: "fullVersionA" },
                        { label: "Continuation", value: "continuation" },
                      ]}
                    />
                  </Space>
                </div>
                <div style={{ backgroundColor: "#f5f5f5", padding: 24, overflow: "auto" }}>
                  <div style={{ display: "inline-block", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                    <InvoiceGrid showGrid={showcaseDebugGrid}>
                      {showcaseHeaderVersion === "full" ? (
                        <InvoiceHeaderFull
                          invoice={showcaseMockInvoice}
                          project={showcaseMockProject}
                          subsidiary={headerSubsidiary}
                          debug={showcaseDebugGrid}
                        />
                      ) : showcaseHeaderVersion === "fullVersionA" ? (
                        <InvoiceHeaderFullVersionA
                          invoice={showcaseMockInvoice}
                          project={showcaseMockProject}
                          subsidiary={headerSubsidiary}
                          debug={showcaseDebugGrid}
                        />
                      ) : (
                        <InvoiceHeaderContinuation
                          invoice={showcaseMockInvoice}
                          project={showcaseMockProject}
                          subsidiary={headerSubsidiary}
                          pageNumber={2}
                          debug={showcaseDebugGrid}
                        />
                      )}
                    </InvoiceGrid>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">
                    {showcaseHeaderVersion === "full"
                      ? "Version B: Full header for first page (476px total height, 22 rows) - Logo left, Invoice title right"
                      : showcaseHeaderVersion === "fullVersionA"
                      ? "Version A: Full header for first page (483px total height, 23 rows) - Invoice title left, Logo right"
                      : "Minimal header for continuation pages (210px total height, 10 rows)"}
                  </Text>
                </div>
              </Panel>

              {/* Footers Section */}
              <Panel
                key="footers"
                header={
                  <Space>
                    <LayoutOutlined />
                    <span style={{ fontWeight: 500 }}>Footers</span>
                  </Space>
                }
              >
                {/* Controls Row */}
                <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <Space>
                    <Text type="secondary">Subsidiary:</Text>
                    <Select
                      value={showcaseFooterSubsidiary}
                      onChange={setShowcaseFooterSubsidiary}
                      style={{ width: 200 }}
                      size="small"
                      options={showcaseSubsidiaries.map(s => ({
                        label: s.englishName || s.identifier,
                        value: s.identifier,
                      }))}
                      placeholder="Select subsidiary"
                    />
                  </Space>
                  <Space>
                    <Text type="secondary">Version:</Text>
                    <Select
                      value={showcaseFooterVersion}
                      onChange={setShowcaseFooterVersion}
                      style={{ width: 180 }}
                      size="small"
                      options={[
                        { label: "Full Payment (Last)", value: "full" },
                        { label: "Simple (Continuation)", value: "simple" },
                      ]}
                    />
                  </Space>
                </div>
                <div style={{ backgroundColor: "#f5f5f5", padding: 24, overflow: "auto" }}>
                  <div style={{ display: "inline-block", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                    <InvoiceGrid showGrid={showcaseDebugGrid}>
                      {showcaseFooterVersion === "full" ? (
                        <FooterFull
                          subsidiary={footerSubsidiary}
                          bankInfo={showcaseBankInfo}
                          totalEnglish="Hong Kong Dollars Twelve Thousand Only"
                          totalChinese="港幣壹萬貳仟元正"
                          debug={showcaseDebugGrid}
                        />
                      ) : (
                        <FooterSimple
                          subsidiary={footerSubsidiary}
                          pageNumber={1}
                          totalPages={2}
                          debug={showcaseDebugGrid}
                        />
                      )}
                    </InvoiceGrid>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">
                    {showcaseFooterVersion === "full"
                      ? "Full payment footer for last page (195px total height, 10 rows) - includes bank info, payment terms"
                      : "Simple footer for continuation pages (81px total height, 2 rows)"}
                  </Text>
                </div>
              </Panel>

              {/* Invoice Total Box Section */}
              <Panel
                key="total-box"
                header={
                  <Space>
                    <DollarOutlined />
                    <span style={{ fontWeight: 500 }}>Invoice Total Box</span>
                  </Space>
                }
              >
                {/* Controls Row */}
                <div style={{ marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Total Amount (HKD)</Text>
                      <InputNumber
                        style={{ width: "100%" }}
                        size="small"
                        value={totalBoxAmount}
                        onChange={(v: number | null) => setTotalBoxAmount(v || 0)}
                        min={0}
                        step={100}
                        formatter={(value: number | undefined) => value ? `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                        parser={(value: string | undefined) => value ? Number(value.replace(/\$\s?|(,*)/g, '')) : 0}
                      />
                    </Col>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>English Override</Text>
                      <input
                        type="text"
                        value={totalBoxEnglishOverride}
                        onChange={(e) => setTotalBoxEnglishOverride(e.target.value)}
                        placeholder={num2eng(totalBoxAmount)}
                        style={{ width: "100%", padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: 4, fontSize: 12 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Chinese Override</Text>
                      <input
                        type="text"
                        value={totalBoxChineseOverride}
                        onChange={(e) => setTotalBoxChineseOverride(e.target.value)}
                        placeholder={num2chi(totalBoxAmount)}
                        style={{ width: "100%", padding: "4px 8px", border: "1px solid #d9d9d9", borderRadius: 4, fontSize: 12 }}
                      />
                    </Col>
                  </Row>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      Leave override fields empty to use auto-generated text. English: "{num2eng(totalBoxAmount)}" | Chinese: "{num2chi(totalBoxAmount)}"
                    </Text>
                  </div>
                </div>
                <div style={{ backgroundColor: "#f5f5f5", padding: 24, overflow: "auto" }}>
                  <div style={{ display: "inline-block", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                    <InvoiceGrid showGrid={showcaseDebugGrid} rowHeights={[22, 34, 22]}>
                      <TotalBox
                        total={totalBoxAmount}
                        totalEnglish={totalBoxEnglishOverride || num2eng(totalBoxAmount)}
                        totalChinese={totalBoxChineseOverride || `港幣${num2chi(totalBoxAmount).replace('元', '元').replace('正', '正')}`}
                        debug={showcaseDebugGrid}
                      />
                    </InvoiceGrid>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">
                    Invoice total box (78px total height, 3 rows) - displays amount in numbers, English words, and Chinese characters
                  </Text>
                </div>
              </Panel>
            </Collapse>
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

          {/* Component Showcase */}
          <Panel
            key="storybook"
            header={
              <Space>
                <BookOutlined />
                <span style={{ fontWeight: 500 }}>Component Showcase</span>
              </Space>
            }
          >
            <Card size="small">
              <Space direction="vertical" style={{ width: "100%" }}>
                <Text>
                  Browse and interact with all Ant Design components used in this application.
                </Text>
                <Text type="secondary">
                  View buttons, inputs, tables, modals, and more with live examples.
                </Text>
                <Divider style={{ margin: "12px 0" }} />
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  href="/tools/storybook"
                >
                  Open Component Showcase
                </Button>
              </Space>
            </Card>
          </Panel>
        </Collapse>
      </div>
    </AppShell>
  )
}
