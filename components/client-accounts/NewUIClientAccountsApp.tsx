import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Refine,
  useMenu,
  type BaseRecord,
  type CrudFilters,
  type CrudSorting,
  type DataProvider,
  type GetListResponse,
  type HttpError,
} from "@refinedev/core"
import { List, FilterDropdown, useTable } from "@refinedev/antd"
import routerProvider from "@refinedev/nextjs-router"
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  ConfigProvider,
  Divider,
  Drawer,
  Form,
  Grid,
  Input,
  Layout,
  Menu,
  Modal,
  Pagination,
  Radio,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd"
import {
  ApartmentOutlined,
  AppstoreOutlined,
  BarsOutlined,
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PhoneOutlined,
  PlusCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltFilled,
  UnorderedListOutlined,
} from "@ant-design/icons"
import debounce from "lodash.debounce"
import type { ClientDirectoryRecord } from "../../lib/clientDirectory"

type DirectoryApiRecord = ClientDirectoryRecord & { id: string }

const { Header, Content, Sider } = Layout
const { Text } = Typography

if (typeof window === "undefined") {
  console.info("[client-accounts] Module loaded", {
    timestamp: new Date().toISOString(),
  })
}

type ClientAccountRow = {
  id: string
  displayName: string
  baseName: string | null
  honorific: string | null
  email: string | null
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  addressLine4: string | null
  region: string | null
  company: { id: string; name: string }
  hasOverduePayment: boolean
  avatarSeed: string
  createdAt: string | null
  source: DirectoryApiRecord
}

type ClientFilter = CrudFilters[number]

type ViewMode = "table" | "card"

type ActionHandlers = {
  onViewDetails: (record: ClientAccountRow) => void
  onSendEmail: (record: ClientAccountRow) => void
  onCall: (record: ClientAccountRow) => void
}

type ClientDetailsFormValues = {
  companyName: string
  title?: string | null
  nameAddressed?: string | null
  emailAddress?: string | null
  phone?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  addressLine3?: string | null
  addressLine4?: string | null
  region?: string | null
}

type AddClientFormValues = Required<
  Pick<ClientDetailsFormValues, "companyName" | "title" | "nameAddressed" | "emailAddress" | "region">
> &
  Partial<Pick<ClientDetailsFormValues, "phone" | "addressLine1" | "addressLine2" | "addressLine3" | "addressLine4">>

const directoryCache: { records: ClientAccountRow[] } = { records: [] }

const toNullableString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const formatDisplayValue = (value: string | null | undefined, fallback = "N/A") => {
  const normalized = toNullableString(value)
  return normalized ?? fallback
}

const composeDisplayName = (name: string | null, honorific: string | null, fallback?: string) => {
  const safeName = name ?? fallback ?? "N/A"
  return honorific ? `${honorific} ${safeName}`.trim() : safeName
}

const getInitials = (value: string) => {
  const pieces = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  if (pieces.length === 0) return "NA"
  if (pieces.length === 1) return pieces[0].slice(0, 2).toUpperCase()
  return `${pieces[0][0] ?? ""}${pieces[1][0] ?? ""}`.toUpperCase()
}

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return hash
}

const getAvatarColor = (seed: string) => {
  const base = Math.abs(hashString(seed))
  const r = (base & 0xff0000) >> 16
  const g = (base & 0x00ff00) >> 8
  const b = base & 0x0000ff
  return `rgb(${(r % 156) + 80}, ${(g % 156) + 80}, ${(b % 156) + 80})`
}

const formatAddressLines = (record: ClientAccountRow) => {
  const lines: string[] = []
  if (record.addressLine1) {
    lines.push(record.addressLine1)
  }
  if (record.addressLine2) {
    lines.push(record.addressLine2)
  }
  const tail: string[] = []
  if (record.addressLine3) {
    tail.push(record.addressLine3)
  }
  if (record.addressLine4) {
    tail.push(record.addressLine4)
  }
  if (record.region) {
    tail.push(record.region)
  }
  if (tail.length > 0) {
    lines.push(tail.join(", "))
  }
  if (lines.length === 0) {
    return ["N/A"]
  }
  return lines
}

const normalizeRecord = (raw: DirectoryApiRecord, index: number): ClientAccountRow => {
  void index
  const companyName = toNullableString(raw.companyName)
  const companyDisplay = formatDisplayValue(companyName)
  const honorific = toNullableString(raw.title)
  const baseName = toNullableString(raw.nameAddressed) ?? toNullableString(raw.name)
  const displayName = composeDisplayName(baseName, honorific, companyDisplay)

  return {
    id: raw.id,
    displayName,
    baseName,
    honorific,
    email: toNullableString(raw.emailAddress),
    phone: toNullableString(raw.phone),
    addressLine1: toNullableString(raw.addressLine1),
    addressLine2: toNullableString(raw.addressLine2),
    addressLine3: toNullableString(raw.addressLine3),
    addressLine4: toNullableString(raw.addressLine4),
    region: toNullableString(raw.region ?? raw.addressLine5),
    company: {
      id: raw.id,
      name: companyDisplay,
    },
    hasOverduePayment: Boolean(raw.hasOverduePayment),
    avatarSeed: displayName,
    createdAt: raw.createdAt ?? null,
    source: raw,
  }
}

const isFieldFilter = (filter: ClientFilter): filter is ClientFilter & { field: string } =>
  typeof filter === "object" && filter !== null && "field" in filter

const applyFilters = (rows: ClientAccountRow[], filters?: CrudFilters): ClientAccountRow[] => {
  if (!filters) return rows
  return filters.reduce<ClientAccountRow[]>((result, filter) => {
    if (!filter) return result
    if (!isFieldFilter(filter)) {
      return result
    }
    const { field, value } = filter
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      return result
    }

    switch (field) {
      case "name": {
        if (typeof value === "string" && value.trim().length > 0) {
          const needle = value.trim().toLowerCase()
          return result.filter((row) =>
            [row.displayName, row.company.name, formatDisplayValue(row.email), formatDisplayValue(row.region)]
              .join(" ")
              .toLowerCase()
              .includes(needle),
          )
        }
        return result
      }
      case "email": {
        if (typeof value === "string" && value.trim().length > 0) {
          const needle = value.trim().toLowerCase()
          return result.filter((row) => (row.email ?? "").toLowerCase().includes(needle))
        }
        return result
      }
      case "companyName":
      case "company.id": {
        if (typeof value === "string" && value.trim().length > 0) {
          const match = value.trim().toLowerCase()
          return result.filter(
            (row) => row.company.id.toLowerCase() === match || row.company.name.toLowerCase() === match,
          )
        }
        return result
      }
      default:
        return result
    }
  }, rows)
}

const applySorting = (rows: ClientAccountRow[], sorters?: CrudSorting): ClientAccountRow[] => {
  if (!sorters || sorters.length === 0) return rows
  const [{ field, order }] = sorters
  if (!order) return rows
  return [...rows].sort((a, b) => {
    const direction = order === "asc" ? 1 : -1
    const getValue = (record: ClientAccountRow) => {
      switch (field) {
        case "name":
          return record.displayName
        case "email":
          return record.email ?? ""
        case "companyName":
        case "company.id":
        case "company.name":
          return record.company.name
        default:
          return record.displayName
      }
    }
    const aValue = getValue(a)
    const bValue = getValue(b)
    return aValue.localeCompare(bValue, undefined, { sensitivity: "base" }) * direction
  })
}

const refineDataProvider: DataProvider = {
  getApiUrl: () => "/api",
  getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination, sorters, filters }) => {
    if (resource !== "client-directory") {
      return { data: [], total: 0 } as GetListResponse<TData>
    }

    const response = await fetch("/api/client-directory", { credentials: "include" })
    if (!response.ok) {
      throw new Error("Failed to load client directory")
    }

    const payload = await response.json()
    const rawItems: DirectoryApiRecord[] = payload.data ?? []
    const normalized = rawItems.map((entry, index) => normalizeRecord(entry, index))
    directoryCache.records = normalized

    const filtered = applyFilters(normalized, filters)
    const sorted = applySorting(filtered, sorters)

    const current = pagination?.current ?? 1
    const pageSize = pagination?.pageSize ?? 12
    const start = (current - 1) * pageSize
    const paginated = sorted.slice(start, start + pageSize)

    return {
      data: paginated as unknown as TData[],
      total: sorted.length,
    }
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

const PaymentStatusTag = ({ overdue }: { overdue: boolean }) => (
  <Tag color={overdue ? "red" : "green"} style={{ borderRadius: 999, textTransform: "capitalize" }}>
    <Space size={6}>
      {overdue ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
      {overdue ? "Payment Overdue" : "Payment Clear"}
    </Space>
  </Tag>
)

const CustomAvatar = ({ seed, name }: { seed: string; name: string }) => (
  <Avatar style={{ backgroundColor: getAvatarColor(seed) }}>{getInitials(name)}</Avatar>
)

const ActionButtons = ({ record, onViewDetails, onSendEmail, onCall }: ActionHandlers & { record: ClientAccountRow }) => (
  <Space>
    <Tooltip title="View details">
      <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => onViewDetails(record)} />
    </Tooltip>
    <Tooltip title="Send email">
      <Button type="text" size="small" icon={<MailOutlined />} onClick={() => onSendEmail(record)} />
    </Tooltip>
    <Tooltip title="Call">
      <Button type="text" size="small" icon={<PhoneOutlined />} onClick={() => onCall(record)} />
    </Tooltip>
  </Space>
)

type TableViewProps = {
  tableProps: any
  companyOptions: Array<{ value: string; label: string }>
} & ActionHandlers

const ClientAccountsTable = ({ tableProps, companyOptions, onViewDetails, onSendEmail, onCall }: TableViewProps) => (
  <List
    breadcrumb={false}
    headerProps={{ title: null }}
    contentProps={{
      style: {
        marginTop: 28,
        background: "#fff",
        borderRadius: 12,
        padding: 0,
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
      },
    }}
  >
    <Table<ClientAccountRow>
      {...tableProps}
      rowKey="id"
      pagination={{
        ...tableProps.pagination,
        pageSizeOptions: ["12", "24", "48", "96"],
        showTotal: (total) => <PaginationSummary total={total} />,
      }}
    >
      <Table.Column<ClientAccountRow>
        dataIndex={["company", "name"]}
        title="Company"
        width={240}
        filterDropdown={(props) => (
          <FilterDropdown {...props}>
            <Select
              placeholder="Search Company"
              style={{ width: 220 }}
              showSearch
              options={companyOptions}
              filterOption={(input, option) =>
                (option?.label as string).toLowerCase().includes(input.toLowerCase())
              }
            />
          </FilterDropdown>
        )}
        render={(_, record) => <Text strong>{record.company.name}</Text>}
      />
      <Table.Column<ClientAccountRow>
        dataIndex="displayName"
        title="Name"
        width={280}
        render={(_, record) => (
          <Space align="start">
            <CustomAvatar seed={record.avatarSeed} name={record.displayName} />
            <Space direction="vertical" size={0} style={{ lineHeight: 1.4 }}>
              <Text strong>{record.displayName}</Text>
              <Text type="secondary">{formatDisplayValue(record.phone)}</Text>
            </Space>
          </Space>
        )}
        filterDropdown={(props) => (
          <FilterDropdown {...props}>
            <Input placeholder="Search Name" />
          </FilterDropdown>
        )}
      />
      <Table.Column<ClientAccountRow>
        dataIndex="email"
        title="Email"
        filterDropdown={(props) => (
          <FilterDropdown {...props}>
            <Input placeholder="Search Email" />
          </FilterDropdown>
        )}
        render={(_, record) => <Text>{formatDisplayValue(record.email)}</Text>}
      />
      <Table.Column<ClientAccountRow>
        title="Actions"
        fixed="right"
        align="right"
        render={(_, record) => (
          <ActionButtons
            record={record}
            onViewDetails={onViewDetails}
            onSendEmail={onSendEmail}
            onCall={onCall}
          />
        )}
      />
    </Table>
  </List>
)

type CardGridProps = {
  tableProps: any
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  onViewDetails: (record: ClientAccountRow) => void
  onSendEmail: (record: ClientAccountRow) => void
  onCall: (record: ClientAccountRow) => void
}

const ClientCards = ({
  tableProps: { dataSource, pagination, loading },
  setCurrentPage,
  setPageSize,
  onViewDetails,
  onSendEmail,
  onCall,
}: CardGridProps) => {
  const data = useMemo(() => dataSource ?? [], [dataSource])
  const isLoading = useMemo(() => {
    if (typeof loading === "boolean") {
      return loading
    }
    if (!loading) {
      return false
    }
    if (typeof loading === "object" && "spinning" in loading) {
      return Boolean(loading.spinning)
    }
    return Boolean(loading)
  }, [loading])
  const paginationConfig = pagination && typeof pagination === "object" ? pagination : undefined
  const current = paginationConfig?.current ?? 1
  const pageSize = paginationConfig?.pageSize ?? 12
  const total = paginationConfig?.total ?? data.length

  return (
    <List breadcrumb={false} headerProps={{ title: null }} contentProps={{ style: { marginTop: 28 } }}>
      <div
        style={{
          display: "grid",
          gap: 24,
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        }}
      >
        {(isLoading
          ? Array.from({ length: 12 }).map((_, index) => ({ ...placeholderCard, id: `placeholder-${index}` }))
          : data
        ).map((record) => (
          <ClientCard
            key={record.id}
            record={record}
            loading={isLoading}
            onViewDetails={onViewDetails}
            onSendEmail={onSendEmail}
            onCall={onCall}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 24,
        }}
      >
        <Pagination
          current={current}
          pageSize={pageSize}
          total={total}
          hideOnSinglePage
          pageSizeOptions={["12", "24", "48"]}
          showLessItems
          showSizeChanger
          showTotal={(count) => <PaginationSummary total={count} />}
          onChange={(page, nextPageSize) => {
            setCurrentPage(page)
            setPageSize(nextPageSize ?? pageSize)
          }}
        />
      </div>
    </List>
  )
}

const placeholderCard: ClientAccountRow = {
  id: "placeholder",
  displayName: "Loading",
  baseName: "Loading",
  honorific: null,
  email: null,
  phone: null,
  addressLine1: null,
  addressLine2: null,
  addressLine3: null,
  addressLine4: null,
  region: null,
  company: { id: "placeholder", name: "Loading" },
  hasOverduePayment: false,
  avatarSeed: "Loading",
  createdAt: null,
  source: {
    id: "placeholder",
    documentId: "placeholder",
    companyName: "Loading",
    title: null,
    name: null,
    nameAddressed: null,
    emailAddress: null,
    phone: null,
    addressLine1: null,
    addressLine2: null,
    addressLine3: null,
    addressLine4: null,
    addressLine5: null,
    region: null,
    createdAt: null,
    hasOverduePayment: false,
  },
}

type ClientCardProps = {
  record: ClientAccountRow
  loading?: boolean
} & ActionHandlers

const CardSection = ({ title, value, showLabel = true }: { title: string; value: string; showLabel?: boolean }) => (
  <div>
    {showLabel ? (
      <Text type="secondary" style={{ display: "block", textTransform: "uppercase", fontSize: 12 }}>
        {title}
      </Text>
    ) : null}
    <Text strong>{value}</Text>
  </div>
)

const ClientCard = ({ record, loading, onViewDetails, onSendEmail, onCall }: ClientCardProps) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      borderRadius: 12,
      background: "#fff",
      boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
      minHeight: 260,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
      }}
    >
      <PaymentStatusTag overdue={record.hasOverduePayment} />
    </div>
    <div
      style={{
        padding: "32px 24px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <Avatar size={64} style={{ backgroundColor: getAvatarColor(record.avatarSeed) }}>
        {getInitials(record.displayName)}
      </Avatar>
      <div>
        <Text strong style={{ fontSize: 18 }}>
          {loading ? "Loading" : record.displayName}
        </Text>
        <div>
          <Text type="secondary">{loading ? "" : formatDisplayValue(record.email)}</Text>
        </div>
      </div>
    </div>
    <div
      style={{
        padding: "16px 24px",
        borderTop: "1px solid #edf1f4",
        display: "grid",
        gap: 12,
      }}
    >
      <CardSection title="Company" value={record.company.name} showLabel={false} />
      <CardSection title="Phone" value={formatDisplayValue(record.phone)} />
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        <Button type="text" icon={<EyeOutlined />} onClick={() => onViewDetails(record)}>
          View
        </Button>
        <Button type="text" icon={<MailOutlined />} onClick={() => onSendEmail(record)}>
          Email
        </Button>
        <Button type="text" icon={<PhoneOutlined />} onClick={() => onCall(record)}>
          Call
        </Button>
      </div>
    </div>
  </div>
)

const DetailField = ({ label, value }: { label: string; value: ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <Text type="secondary" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
      {label}:
    </Text>
    <Text strong>{value}</Text>
  </div>
)

const ClientDetailsDrawer = ({
  record,
  open,
  saving,
  onClose,
  onDelete,
  onSubmit,
}: {
  record: ClientAccountRow | null
  open: boolean
  saving: boolean
  onClose: () => void
  onDelete: (record: ClientAccountRow) => void
  onSubmit: (values: ClientDetailsFormValues) => Promise<void>
}) => {
  const [form] = Form.useForm()

  useEffect(() => {
    if (record) {
      form.setFieldsValue({
        companyName: record.source.companyName ?? record.company.name,
        title: record.source.title ?? undefined,
        nameAddressed: record.source.nameAddressed ?? record.baseName ?? undefined,
        emailAddress: record.source.emailAddress ?? record.email ?? undefined,
        phone: record.source.phone ?? record.phone ?? undefined,
        addressLine1: record.source.addressLine1 ?? record.addressLine1 ?? undefined,
        addressLine2: record.source.addressLine2 ?? record.addressLine2 ?? undefined,
        addressLine3: record.source.addressLine3 ?? record.addressLine3 ?? undefined,
        addressLine4: record.source.addressLine4 ?? record.addressLine4 ?? undefined,
        region: record.source.region ?? record.region ?? undefined,
      })
    } else {
      form.resetFields()
    }
  }, [record, form])

  return (
    <Drawer placement="right" width={480} open={open} onClose={onClose} destroyOnClose title={null}>
      {record ? (
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          <Space align="center" size={16}>
            <Avatar size={64} style={{ backgroundColor: getAvatarColor(record.avatarSeed) }}>
              {getInitials(record.displayName)}
            </Avatar>
            <Space direction="vertical" size={4}>
              <Text strong style={{ fontSize: 20 }}>
                {record.displayName}
              </Text>
              <PaymentStatusTag overdue={record.hasOverduePayment} />
            </Space>
          </Space>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <DetailField label="Company" value={record.company.name} />
            <DetailField label="Representative" value={record.displayName} />
            <DetailField label="Email" value={formatDisplayValue(record.email)} />
            <DetailField label="Phone" value={formatDisplayValue(record.phone)} />
            <DetailField
              label="Address"
              value={
                <span>
                  {formatAddressLines(record).map((line) => (
                    <span key={line} style={{ display: "block" }}>
                      {line}
                    </span>
                  ))}
                </span>
              }
            />
          </Space>
          <Divider style={{ margin: "8px 0" }} />
          <Form<ClientDetailsFormValues>
            layout="vertical"
            form={form}
            onFinish={onSubmit}
            initialValues={{ title: "Mr.", region: "Kowloon" }}
          >
            <Form.Item
              label="Company Name"
              name="companyName"
              rules={[{ required: true, message: "Company name is required" }]}
            >
              <Input placeholder="Enter company name" />
            </Form.Item>
            <Form.Item label="Title" name="title">
              <Select
                placeholder="Select title"
                allowClear
                options={[
                  { label: "Mr.", value: "Mr." },
                  { label: "Mrs.", value: "Mrs." },
                  { label: "Ms.", value: "Ms." },
                ]}
              />
            </Form.Item>
            <Form.Item label="Representative" name="nameAddressed">
              <Input placeholder="Enter representative name" />
            </Form.Item>
            <Form.Item label="Email" name="emailAddress">
              <Input placeholder="Enter email" type="email" />
            </Form.Item>
            <Form.Item label="Phone" name="phone">
              <Input placeholder="Enter phone" />
            </Form.Item>
            <Form.Item label="Address Line 1" name="addressLine1">
              <Input placeholder="Address line 1" />
            </Form.Item>
            <Form.Item label="Address Line 2" name="addressLine2">
              <Input placeholder="Address line 2" />
            </Form.Item>
            <Form.Item label="Address Line 3" name="addressLine3">
              <Input placeholder="Address line 3" />
            </Form.Item>
            <Form.Item label="Address Line 4" name="addressLine4">
              <Input placeholder="Address line 4" />
            </Form.Item>
            <Form.Item label="Region" name="region">
              <Select
                placeholder="Select region"
                allowClear
                options={[
                  { label: "Kowloon", value: "Kowloon" },
                  { label: "Hong Kong", value: "Hong Kong" },
                  { label: "New Territories", value: "New Territories" },
                ]}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button onClick={() => form.resetFields()} disabled={saving}>
                  Reset
                </Button>
                <Button type="primary" htmlType="submit" loading={saving}>
                  Save changes
                </Button>
              </Space>
            </Form.Item>
          </Form>
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <Button danger onClick={() => onDelete(record)}>
              Delete client account
            </Button>
          </div>
        </Space>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}>
          <Spin />
        </div>
      )}
    </Drawer>
  )
}

const PaginationSummary = ({ total }: { total: number }) => (
  <span style={{ marginLeft: 16 }}>
    <Text strong>{total}</Text> clients in total
  </span>
)

const AddClientModal = ({
  open,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  onCancel: () => void
  onSubmit: (values: AddClientFormValues) => Promise<void>
}) => {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({ title: "Mr.", region: "Kowloon" } as Partial<AddClientFormValues>)
    }
  }, [open, form])

  return (
    <Modal
      open={open}
      title="Add client"
      onCancel={onCancel}
      okText="Create"
      confirmLoading={loading}
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Form<AddClientFormValues>
        layout="vertical"
        form={form}
        onFinish={onSubmit}
        initialValues={{ title: "Mr.", region: "Kowloon" }}
      >
        <Form.Item
          label="Company Name"
          name="companyName"
          rules={[{ required: true, message: "Company name is required" }]}
        >
          <Input placeholder="Enter company name" />
        </Form.Item>
        <Form.Item label="Title" name="title">
          <Select
            options={[
              { label: "Mr.", value: "Mr." },
              { label: "Mrs.", value: "Mrs." },
              { label: "Ms.", value: "Ms." },
            ]}
          />
        </Form.Item>
        <Form.Item label="Representative" name="nameAddressed">
          <Input placeholder="Representative name" />
        </Form.Item>
        <Form.Item label="Email" name="emailAddress">
          <Input placeholder="Email" type="email" />
        </Form.Item>
        <Form.Item label="Phone" name="phone">
          <Input placeholder="Phone" />
        </Form.Item>
        <Form.Item label="Address Line 1" name="addressLine1">
          <Input placeholder="Address line 1" />
        </Form.Item>
        <Form.Item label="Address Line 2" name="addressLine2">
          <Input placeholder="Address line 2" />
        </Form.Item>
        <Form.Item label="Address Line 3" name="addressLine3">
          <Input placeholder="Address line 3" />
        </Form.Item>
        <Form.Item label="Address Line 4" name="addressLine4">
          <Input placeholder="Address line 4" />
        </Form.Item>
        <Form.Item label="Region" name="region">
          <Select
            options={[
              { label: "Kowloon", value: "Kowloon" },
              { label: "Hong Kong", value: "Hong Kong" },
              { label: "New Territories", value: "New Territories" },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

const NavigationSider = ({ collapsed, onCollapse }: { collapsed: boolean; onCollapse: (value: boolean) => void }) => {
  const { menuItems, selectedKey } = useMenu()
  const breakpoint = Grid.useBreakpoint()
  const isMobile = typeof breakpoint.lg === "undefined" ? false : !breakpoint.lg

  const navigationItems = menuItems
    .map((item) => {
      const key = item.key ?? item.name
      const route = item.route ?? item.list
      if (!route) {
        return null
      }
      return {
        key,
        icon: iconForMenu(item.name ?? ""),
        label: item.label,
        route,
      }
    })
    .filter(Boolean) as Array<{ key: string; icon: ReactNode; label: ReactNode; route: string }>

  const handleMenuClick = (event: { key: string }) => {
    if (event.key === "__collapse__") {
      onCollapse(!collapsed)
      return
    }
    const target = navigationItems.find((item) => item.key === event.key)
    if (target?.route && typeof window !== "undefined") {
      window.location.href = target.route
    }
  }

  const menuEntries = [
    ...navigationItems.map((item) => ({
      key: item.key,
      icon: item.icon,
      label: item.label,
    })),
    {
      key: "__collapse__",
      icon: collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />,
      label: collapsed ? "Expand sidebar" : "Collapse sidebar",
      style: { marginTop: "auto" },
    },
  ]

  const content = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: collapsed ? "0 12px" : "0 24px",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <Avatar shape="square" size={36} style={{ backgroundColor: "#2563eb" }}>
            <ThunderboltFilled />
          </Avatar>
          {!collapsed ? (
            <Text strong style={{ fontSize: 18 }}>
              The Establishers
            </Text>
          ) : null}
        </div>
      </div>
      <Menu
        mode="inline"
        selectedKeys={selectedKey ? [selectedKey] : []}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          borderInlineEnd: "none",
          paddingTop: 16,
        }}
        items={menuEntries}
        onClick={handleMenuClick}
      />
    </div>
  )

  if (isMobile) {
    return (
      <>
        <Button
          type="primary"
          icon={<BarsOutlined />}
          style={{ position: "fixed", top: 72, left: 0, zIndex: 1300, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
          onClick={() => onCollapse(!collapsed)}
        />
        <Drawer placement="left" open={!collapsed} onClose={() => onCollapse(true)} width={256} bodyStyle={{ padding: 0 }}>
          {content}
        </Drawer>
      </>
    )
  }

  return (
    <Sider
      width={256}
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
      style={{
        background: "#fff",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      {content}
    </Sider>
  )
}

const iconForMenu = (name: string) => {
  switch (name) {
    case "dashboard":
      return <AppstoreOutlined />
    case "calendar":
      return <CalendarOutlined />
    case "scrumboard":
      return <AppstoreOutlined />
    case "companies":
      return <ApartmentOutlined />
    case "client-directory":
      return <TeamOutlined />
    case "quotes":
      return <SettingOutlined />
    case "administration":
      return <SettingOutlined />
    default:
      return <UnorderedListOutlined />
  }
}

const TopHeader = () => (
  <Header
    style={{
      background: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: "0 32px",
      position: "sticky",
      top: 0,
      zIndex: 1000,
      height: 64,
      borderBottom: "1px solid #e5e7eb",
    }}
  >
    <Space size="large" align="center">
      <Tooltip title="Notifications">
        <Badge dot>
          <Button type="text" shape="circle" icon={<BellOutlined />} />
        </Badge>
      </Tooltip>
      <Avatar style={{ backgroundColor: "#1e3a8a", color: "#fff" }}>TE</Avatar>
    </Space>
  </Header>
)

const ClientAccountsContent = () => {
  const [view, setView] = useState<ViewMode>("table")
  const [searchForm] = Form.useForm()
  const screens = Grid.useBreakpoint()
  const { message } = AntdApp.useApp()
  const [detailsRecord, setDetailsRecord] = useState<ClientAccountRow | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isDetailsSaving, setIsDetailsSaving] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  const { tableProps, searchFormProps, setCurrentPage, setPageSize, tableQuery } = useTable({
    resource: "client-directory",
    pagination: {
      pageSize: 12,
    },
    sorters: {
      initial: [
        {
          field: "companyName",
          order: "asc",
        },
      ],
    },
    filters: {
      initial: [
        { field: "name", operator: "contains", value: undefined },
        { field: "email", operator: "contains", value: undefined },
        { field: "company.id", operator: "eq", value: undefined },
      ],
    },
    onSearch: (values) => [
      {
        field: "name",
        operator: "contains",
        value: values.name,
      },
    ],
    syncWithLocation: false,
  }) as any

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        searchFormProps?.onFinish?.({ name: value })
      }, 400),
    [searchFormProps],
  )

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])

  const handleViewChange = (next: ViewMode) => {
    setView(next)
    searchFormProps?.form?.resetFields()
    searchForm?.resetFields()
  }

  const companyOptions = useMemo(() => {
    const unique = new Map<string, string>()
    directoryCache.records.forEach((record) => {
      if (!unique.has(record.company.id)) {
        unique.set(record.company.id, record.company.name)
      }
    })
    return Array.from(unique.entries()).map(([value, label]) => ({ value, label }))
  }, [tableQuery.data?.data])

  const refreshDirectory = async () => {
    await tableQuery.refetch()
  }

  const handleViewDetails = (record: ClientAccountRow) => {
    setDetailsRecord(record)
    setIsDetailsOpen(true)
  }

  const handleSendEmail = (record: ClientAccountRow) => {
    if (!record.email) {
      message.warning("No email address is available for this client.")
      return
    }
    if (typeof window !== "undefined") {
      window.open(`mailto:${record.email}`)
    }
  }

  const handleCall = (record: ClientAccountRow) => {
    if (!record.phone) {
      message.warning("No phone number is available for this client.")
      return
    }
    if (typeof window !== "undefined") {
      const normalized = record.phone.replace(/[^\d+]/g, "")
      window.open(`tel:${normalized}`)
    }
  }

  const handleDeleteRequest = (record: ClientAccountRow) => {
    void record
    message.info("Delete client account is not available in this preview build yet.")
  }

  const handleCloseDetails = () => {
    setIsDetailsOpen(false)
    setDetailsRecord(null)
  }

  const handleAddSubmit = async (values: AddClientFormValues) => {
    setIsAdding(true)
    try {
      const response = await fetch("/api/client-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: {
            companyName: values.companyName,
            title: values.title,
            nameAddressed: values.nameAddressed,
            name: values.nameAddressed,
            emailAddress: values.emailAddress,
            phone: values.phone,
            addressLine1: values.addressLine1,
            addressLine2: values.addressLine2,
            addressLine3: values.addressLine3,
            addressLine4: values.addressLine4,
            addressLine5: values.region,
            region: values.region,
          },
        }),
      })
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}))
        throw new Error(errorJson.error ?? "Failed to add client")
      }
      await refreshDirectory()
      message.success("Client added successfully")
      setIsAddOpen(false)
    } catch (error) {
      const err = error instanceof Error ? error.message : "Failed to add client"
      message.error(err)
    } finally {
      setIsAdding(false)
    }
  }

  const handleDetailsSubmit = async (values: ClientDetailsFormValues) => {
    if (!detailsRecord) {
      return
    }
    setIsDetailsSaving(true)
    try {
      const response = await fetch(`/api/client-directory/${encodeURIComponent(detailsRecord.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            companyName: values.companyName,
            title: values.title,
            nameAddressed: values.nameAddressed,
            name: values.nameAddressed,
            emailAddress: values.emailAddress,
            phone: values.phone,
            addressLine1: values.addressLine1,
            addressLine2: values.addressLine2,
            addressLine3: values.addressLine3,
            addressLine4: values.addressLine4,
            addressLine5: values.region,
            region: values.region,
          },
        }),
      })
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}))
        throw new Error(errorJson.error ?? "Failed to update client")
      }
      await refreshDirectory()
      const refreshed = directoryCache.records.find((entry) => entry.id === detailsRecord.id)
      if (refreshed) {
        setDetailsRecord(refreshed)
      }
      message.success("Client updated")
    } catch (error) {
      const err = error instanceof Error ? error.message : "Failed to update client"
      message.error(err)
    } finally {
      setIsDetailsSaving(false)
    }
  }

  return (
    <div
      style={{
        padding: screens.md ? "32px 32px 32px 24px" : "24px 16px",
        minHeight: "100%",
        background: "#fff",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: 0,
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: screens.md ? "row" : "column",
            alignItems: screens.md ? "center" : "stretch",
            gap: screens.md ? 12 : 8,
            marginBottom: 24,
            width: "100%",
            flexWrap: screens.md ? "nowrap" : "wrap",
          }}
        >
          <Form
            form={searchForm}
            {...searchFormProps}
            layout="inline"
            style={{
              marginBottom: 0,
              width: screens.md ? 200 : "100%",
            }}
          >
            <Form.Item name="name" style={{ marginBottom: 0, width: "100%" }}>
              <Input
                size="large"
                placeholder="Search by name"
                prefix={<SearchOutlined className="anticon tertiary" />}
                suffix={<Spin size="small" spinning={tableQuery.isFetching} />}
                onChange={(event) => debouncedSearch(event.target.value)}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Form>
          {screens.md ? (
            <Radio.Group
              size="large"
              value={view}
              onChange={(event) => handleViewChange(event.target.value)}
              buttonStyle="solid"
              style={{
                background: "#f0f4ff",
                borderRadius: 999,
                padding: 4,
              }}
            >
              <Radio.Button value="table">
                <UnorderedListOutlined />
              </Radio.Button>
              <Radio.Button value="card">
                <AppstoreOutlined />
              </Radio.Button>
            </Radio.Group>
          ) : null}
          <Button
            type="primary"
            size="large"
            icon={<PlusCircleOutlined />}
            onClick={() => setIsAddOpen(true)}
            style={{
              borderRadius: 999,
              paddingInline: 20,
            }}
          >
            Add
          </Button>
        </div>
        {!screens.md ? (
          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
            <Radio.Group
              size="large"
              value={view}
              onChange={(event) => handleViewChange(event.target.value)}
              buttonStyle="solid"
              style={{
                background: "#f0f4ff",
                borderRadius: 999,
                padding: 4,
              }}
            >
              <Radio.Button value="table">
                <UnorderedListOutlined />
              </Radio.Button>
              <Radio.Button value="card">
                <AppstoreOutlined />
              </Radio.Button>
            </Radio.Group>
          </div>
        ) : null}
        {view === "table" ? (
          <ClientAccountsTable
            tableProps={tableProps}
            companyOptions={companyOptions}
            onViewDetails={handleViewDetails}
            onSendEmail={handleSendEmail}
            onCall={handleCall}
          />
        ) : (
          <ClientCards
            tableProps={tableProps}
            setCurrentPage={setCurrentPage}
            setPageSize={setPageSize}
            onViewDetails={handleViewDetails}
            onSendEmail={handleSendEmail}
            onCall={handleCall}
          />
        )}
      </div>
      <ClientDetailsDrawer
        record={detailsRecord}
        open={isDetailsOpen}
        saving={isDetailsSaving}
        onClose={handleCloseDetails}
        onDelete={handleDeleteRequest}
        onSubmit={handleDetailsSubmit}
      />
      <AddClientModal
        open={isAddOpen}
        loading={isAdding}
        onCancel={() => setIsAddOpen(false)}
        onSubmit={handleAddSubmit}
      />
    </div>
  )
}

const ClientAccountsShell = () => {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2563eb",
          borderRadius: 10,
          fontFamily:
            "'Inter', 'Inter var', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
        },
        components: {
          Button: {
            fontWeight: 600,
            borderRadius: 999,
          },
        },
      }}
    >
      <AntdApp>
        <Refine
          dataProvider={refineDataProvider}
          routerProvider={routerProvider}
          resources={[
            { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
            { name: "calendar", list: "/dashboard/calendar", meta: { label: "Calendar" } },
            { name: "scrumboard", list: "/dashboard/scrumboard", meta: { label: "Scrumboard" } },
            { name: "companies", list: "/dashboard/companies", meta: { label: "Companies" } },
            {
              name: "client-directory",
              list: "/dashboard/new-ui/client-accounts",
              meta: { label: "Client Accounts" },
            },
            { name: "quotes", list: "/dashboard/quotes", meta: { label: "Quotes" } },
            { name: "administration", list: "/dashboard/administration", meta: { label: "Administration" } },
          ]}
          options={{ syncWithLocation: false }}
        >
          <Layout style={{ minHeight: "100vh", background: "#fff" }}>
            <NavigationSider collapsed={collapsed} onCollapse={(value) => setCollapsed(value)} />
            <Layout style={{ background: "#fff" }}>
              <TopHeader />
              <Content>
                <ClientAccountsContent />
              </Content>
            </Layout>
          </Layout>
        </Refine>
      </AntdApp>
    </ConfigProvider>
  )
}

export default ClientAccountsShell
