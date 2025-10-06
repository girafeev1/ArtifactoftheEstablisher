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
  Drawer,
  Form,
  Grid,
  Input,
  Layout,
  Menu,
  Pagination,
  Radio,
  Select,
  Space,
  Spin,
  Table,
  type TableProps,
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
  EllipsisOutlined,
  EyeOutlined,
  FileTextOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MinusCircleOutlined,
  PhoneOutlined,
  PlayCircleFilled,
  PlayCircleOutlined,
  PlusCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltFilled,
  UnorderedListOutlined,
} from "@ant-design/icons"
import debounce from "lodash.debounce"
import type { ClientDirectoryRecord } from "../../lib/clientDirectory"

const { Header, Content, Sider } = Layout
const { Text } = Typography

if (typeof window === "undefined") {
  console.info("[client-accounts] Module loaded", {
    timestamp: new Date().toISOString(),
  })
}

const clientStatuses = [
  "QUALIFIED",
  "NEGOTIATION",
  "CONTACTED",
  "INTERESTED",
  "NEW",
  "UNQUALIFIED",
  "LOST",
  "WON",
  "CHURNED",
] as const

type ContactStatus = (typeof clientStatuses)[number]

type ClientAccountRow = {
  id: string
  name: string
  email: string
  jobTitle: string
  phone: string
  region: string
  status: ContactStatus
  company: { id: string; name: string }
  avatarSeed: string
}

const directoryCache: { records: ClientAccountRow[] } = { records: [] }

type ClientFilter = CrudFilters[number]

const isFieldFilter = (filter: ClientFilter): filter is ClientFilter & { field: string } =>
  typeof filter === "object" && filter !== null && "field" in filter

const formatNullable = (value: string | null | undefined, fallback = "N/A") => {
  if (!value) return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

const toCompanyId = (name: string, index: number) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "company"}-${index}`

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return hash
}

const getStatusForRecord = (record: ClientDirectoryRecord, index: number): ContactStatus => {
  const seed = `${record.companyName ?? "client"}-${record.region ?? "region"}-${index}`
  const paletteIndex = Math.abs(hashString(seed)) % clientStatuses.length
  return clientStatuses[paletteIndex]
}

const getAvatarColor = (seed: string) => {
  const base = Math.abs(hashString(seed))
  const r = (base & 0xff0000) >> 16
  const g = (base & 0x00ff00) >> 8
  const b = base & 0x0000ff
  return `rgb(${(r % 156) + 80}, ${(g % 156) + 80}, ${(b % 156) + 80})`
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

const statusStyles: Record<
  ContactStatus,
  { color: string; icon: ReactNode; label: string }
> = {
  QUALIFIED: { color: "green", icon: <PlayCircleFilled />, label: "Qualified" },
  NEGOTIATION: { color: "blue", icon: <PlayCircleFilled />, label: "Negotiation" },
  CONTACTED: { color: "cyan", icon: <PlayCircleOutlined />, label: "Contacted" },
  INTERESTED: { color: "cyan", icon: <PlayCircleOutlined />, label: "Interested" },
  NEW: { color: "geekblue", icon: <PlayCircleOutlined />, label: "New" },
  UNQUALIFIED: { color: "red", icon: <PlayCircleOutlined />, label: "Unqualified" },
  LOST: { color: "red", icon: <MinusCircleOutlined />, label: "Lost" },
  WON: { color: "green", icon: <CheckCircleOutlined />, label: "Won" },
  CHURNED: { color: "volcano", icon: <MinusCircleOutlined />, label: "Churned" },
}

const normalizeRecord = (
  raw: ClientDirectoryRecord & { id: string | undefined },
  index: number,
): ClientAccountRow => {
  const safeCompany = formatNullable(raw.companyName, "N/A")
  const companyId = raw.id && raw.id.trim().length > 0 ? raw.id : toCompanyId(safeCompany, index)
  const name = formatNullable(raw.nameAddressed ?? raw.name ?? raw.companyName, "N/A")
  return {
    id: companyId,
    name,
    email: formatNullable(raw.emailAddress, "N/A"),
    jobTitle: formatNullable(raw.title, "N/A"),
    phone: formatNullable(raw.phone, "N/A"),
    region: formatNullable(raw.region, "N/A"),
    company: {
      id: companyId,
      name: safeCompany,
    },
    status: getStatusForRecord(raw, index),
    avatarSeed: name,
  }
}

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
      case "name":
        if (typeof value === "string" && value.trim().length > 0) {
          const needle = value.trim().toLowerCase()
          return result.filter((row) =>
            [row.name, row.company.name, row.email, row.region]
              .join(" ")
              .toLowerCase()
              .includes(needle),
          )
        }
        return result
      case "email":
        if (typeof value === "string" && value.trim().length > 0) {
          const needle = value.trim().toLowerCase()
          return result.filter((row) => row.email.toLowerCase().includes(needle))
        }
        return result
      case "companyName":
      case "company.id":
        if (typeof value === "string" && value.trim().length > 0) {
          const match = value.trim().toLowerCase()
          return result.filter((row) =>
            row.company.id.toLowerCase() === match || row.company.name.toLowerCase() === match,
          )
        }
        return result
      case "jobTitle":
        if (typeof value === "string" && value.trim().length > 0) {
          const needle = value.trim().toLowerCase()
          return result.filter((row) => row.jobTitle.toLowerCase().includes(needle))
        }
        return result
      case "status":
        if (Array.isArray(value)) {
          const allowed = new Set(value.map((item) => String(item).toUpperCase()))
          return result.filter((row) => allowed.has(row.status))
        }
        if (typeof value === "string" && value.trim().length > 0) {
          return result.filter((row) => row.status === value.trim().toUpperCase())
        }
        return result
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
          return record.name
        case "email":
          return record.email
        case "jobTitle":
          return record.jobTitle
        case "status":
          return record.status
        case "companyName":
        case "company.id":
        case "company.name":
          return record.company.name
        default:
          return record.name
      }
    }
    const aValue = getValue(a)
    const bValue = getValue(b)
    return aValue.localeCompare(bValue, undefined, { sensitivity: "base" }) * direction
  })
}

const refineDataProvider: DataProvider = {
  getApiUrl: () => "/api",
  getList: async <TData extends BaseRecord = BaseRecord>({
    resource,
    pagination,
    sorters,
    filters,
  }) => {
    if (resource !== "client-directory") {
      return { data: [], total: 0 } as GetListResponse<TData>
    }

    const response = await fetch("/api/client-directory", { credentials: "include" })
    if (!response.ok) {
      throw new Error("Failed to load client directory")
    }

    const payload = await response.json()
    const rawItems: Array<ClientDirectoryRecord & { id?: string }> = payload.data ?? []
    const normalized = rawItems.map((entry, index) => normalizeRecord({ ...entry, id: entry.id }, index))
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

const ContactStatusTag = ({ status }: { status: ContactStatus }) => {
  const style = statusStyles[status]
  return (
    <Tag color={style.color} style={{ textTransform: "capitalize", borderRadius: 999 }}>
      <Space size={4}>
        {style.icon}
        {style.label}
      </Space>
    </Tag>
  )
}

const CustomAvatar = ({ seed, name }: { seed: string; name: string }) => (
  <Avatar style={{ backgroundColor: getAvatarColor(seed) }}>{getInitials(name)}</Avatar>
)

type ViewMode = "table" | "card"

type TableViewProps = {
  tableProps: TableProps<ClientAccountRow>
  companyOptions: Array<{ value: string; label: string }>
}

const ClientAccountsTable = ({ tableProps, companyOptions }: TableViewProps) => (
  <List
    breadcrumb={false}
    title={<AddClientAction />}
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
    <TableContent tableProps={tableProps} companyOptions={companyOptions} />
  </List>
)

type TableContentProps = {
  tableProps: TableProps<ClientAccountRow>
  companyOptions: Array<{ value: string; label: string }>
}

const TableContent = ({ tableProps, companyOptions }: TableContentProps) => (
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
      render={(_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.company.name}</Text>
          <Text type="secondary">{record.region}</Text>
        </Space>
      )}
    />
    <Table.Column<ClientAccountRow>
      dataIndex="name"
      title="Name"
      width={280}
      render={(_, record) => (
        <Space align="start">
          <CustomAvatar seed={record.avatarSeed} name={record.name} />
          <Space direction="vertical" size={0} style={{ lineHeight: 1.4 }}>
            <Text type="secondary">{record.jobTitle}</Text>
            <Text strong>{record.name}</Text>
            <Text type="secondary">{record.phone}</Text>
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
      render={(_, record) => <Text>{record.email}</Text>}
    />
    <Table.Column<ClientAccountRow>
      title="Actions"
      fixed="right"
      align="right"
      render={(_, record) => (
        <Space>
          <Tooltip title="View details">
            <Button type="text" size="small" icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title="Send email">
            <Button type="text" size="small" icon={<MailOutlined />} />
          </Tooltip>
          <Tooltip title="Call">
            <Button type="text" size="small" icon={<PhoneOutlined />} />
          </Tooltip>
        </Space>
      )}
    />
  </Table>
)

type CardGridProps = {
  tableProps: TableProps<ClientAccountRow>
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
}

const ClientCards = ({
  tableProps: { dataSource, pagination, loading },
  setCurrentPage,
  setPageSize,
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
    <List
      breadcrumb={false}
      title={<AddClientAction />}
      contentProps={{
        style: {
          marginTop: 28,
        },
      }}
    >
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
        ).map(
          (record) => (
            <ClientCard key={record.id} record={record} loading={isLoading} />
          ),
        )}
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
  name: "Loading",
  email: "loading@example.com",
  jobTitle: "Loading",
  phone: "N/A",
  region: "N/A",
  company: { id: "placeholder", name: "Loading" },
  status: "NEW",
  avatarSeed: "Loading",
}

type ClientCardProps = {
  record: ClientAccountRow
  loading?: boolean
}

const CardSection = ({ title, value }: { title: string; value: string }) => (
  <div>
    <Text type="secondary" style={{ display: "block", textTransform: "uppercase", fontSize: 12 }}>
      {title}
    </Text>
    <Text strong>{value}</Text>
  </div>
)

const ClientCard = ({ record, loading }: ClientCardProps) => (
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
      <Tooltip title="More actions">
        <Button type="text" icon={<EllipsisOutlined />} />
      </Tooltip>
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
        {getInitials(record.name)}
      </Avatar>
      <div>
        <Text strong style={{ fontSize: 18 }}>
          {loading ? "Loading" : record.name}
        </Text>
        <div>
          <Text type="secondary">{loading ? "" : record.email}</Text>
        </div>
      </div>
      <ContactStatusTag status={record.status} />
    </div>
    <div
      style={{
        padding: "16px 24px",
        borderTop: "1px solid #edf1f4",
        display: "grid",
        gap: 12,
      }}
    >
      <CardSection title="Job title" value={loading ? "N/A" : record.jobTitle} />
      <CardSection title="Company" value={record.company.name} />
      <CardSection title="Phone" value={record.phone} />
    </div>
  </div>
)

const PaginationSummary = ({ total }: { total: number }) => (
  <span style={{ marginLeft: 16 }}>
    <Text strong>{total}</Text> client accounts in total
  </span>
)

const AddClientAction = () => (
  <Button type="primary" size="large" icon={<PlusCircleOutlined />}>
    Add new client account
  </Button>
)

const NavigationSider = ({ collapsed, onCollapse }: { collapsed: boolean; onCollapse: (value: boolean) => void }) => {
  const { menuItems, selectedKey } = useMenu()
  const breakpoint = Grid.useBreakpoint()
  const isMobile = typeof breakpoint.lg === "undefined" ? false : !breakpoint.lg

  const items = menuItems.map((item) => {
    const key = item.key ?? item.name
    return {
      key,
      icon: iconForMenu(item.name ?? ""),
      label: item.label,
      route: item.route ?? item.list ?? "#",
    }
  })

  const content = (
    <>
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: collapsed ? "0 16px" : "0 24px",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <Avatar shape="square" size={36} style={{ backgroundColor: "#2563eb" }}>
          <ThunderboltFilled />
        </Avatar>
        {!collapsed ? (
          <Text strong style={{ fontSize: 18 }}>
            The Establishers
          </Text>
        ) : null}
      </div>
      <Menu
        mode="inline"
        selectedKeys={selectedKey ? [selectedKey] : []}
        items={items.map((item) => ({
          key: item.key,
          icon: item.icon,
          label: <a href={item.route}>{item.label}</a>,
        }))}
        style={{
          borderInlineEnd: "none",
        }}
      />
    </>
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
        <Drawer
          placement="left"
          open={!collapsed}
          onClose={() => onCollapse(true)}
          width={256}
          bodyStyle={{ padding: 0 }}
        >
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
        borderRight: "1px solid #e5e7eb",
        background: "#fff",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      {content}
      <div
        style={{
          borderTop: "1px solid #e5e7eb",
          padding: 16,
          display: "flex",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <Button shape="circle" icon={<MenuUnfoldOutlined />} onClick={() => onCollapse(false)} />
        <Button shape="circle" icon={<MenuFoldOutlined />} onClick={() => onCollapse(true)} />
      </div>
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
      return <FileTextOutlined />
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

  const {
    tableProps,
    searchFormProps,
    setCurrentPage,
    setPageSize,
    tableQuery: tableQueryResult,
  } = useTable<ClientAccountRow, HttpError, { name?: string }>({
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
        { field: "jobTitle", operator: "contains", value: undefined },
        { field: "status", operator: "in", value: undefined },
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
  })

  const debouncedSearch = useMemo(() => debounce((value: string) => {
    searchFormProps?.onFinish?.({ name: value })
  }, 400), [searchFormProps])

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
  }, [tableQueryResult.data?.data])

  return (
    <div
      style={{
        padding: "32px 48px",
        minHeight: "100%",
        background: "#f5f7fb",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          flexDirection: screens.md ? "row" : "column",
          justifyContent: "space-between",
          alignItems: screens.md ? "center" : "stretch",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Form form={searchForm} {...searchFormProps} layout="inline" style={{ flex: 1 }}>
          <Form.Item name="name" style={{ flex: 1 }}>
            <Input
              size="large"
              placeholder="Search by name"
              prefix={<SearchOutlined className="anticon tertiary" />}
              suffix={<Spin size="small" spinning={tableQueryResult.isFetching} />}
              onChange={(event) => debouncedSearch(event.target.value)}
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
      </div>

        {view === "table" ? (
          <ClientAccountsTable tableProps={tableProps} companyOptions={companyOptions} />
        ) : (
          <ClientCards
            tableProps={tableProps}
            setCurrentPage={setCurrentPage}
            setPageSize={setPageSize}
          />
        )}
      </div>
    </div>
  )
}

const ClientAccountsShell = () => {
  const [collapsed, setCollapsed] = useState(true)
  const screens = Grid.useBreakpoint()
  const isDesktop = typeof screens.lg === "undefined" ? true : screens.lg
  const contentMargin = isDesktop ? (collapsed ? 80 : 256) : 0

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2563eb",
          borderRadius: 10,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
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
            <Layout style={{ minHeight: "100vh" }}>
              <NavigationSider collapsed={collapsed} onCollapse={(value) => setCollapsed(value)} />
              <Layout style={{ marginLeft: contentMargin, transition: "margin 0.3s ease" }}>
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
