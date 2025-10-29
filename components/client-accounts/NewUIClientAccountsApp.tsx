import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react"
import {
  type BaseRecord,
  type CrudFilters,
  type CrudSorting,
  type DataProvider,
  type GetListResponse,
  type HttpError,
} from "@refinedev/core"
import { List, FilterDropdown, useTable } from "@refinedev/antd"
import {
  App as AntdApp,
  Avatar,
  Button,
  Drawer,
  Form,
  Grid,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd"
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons"
import debounce from "lodash.debounce"
import type { ClientDirectoryRecord } from "../../lib/clientDirectory"

import AppShell from "../new-ui/AppShell"

type DirectoryApiRecord = ClientDirectoryRecord & { id: string }

const { Text } = Typography

const ALLOWED_MENU_KEYS = ["dashboard", "client-directory", "projects"] as const

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
  region: string | null
  company: { id: string; name: string }
  companyInitial: string
  hasOverduePayment: boolean
  avatarSeed: string
  createdAt: string | null
  source: DirectoryApiRecord
}

type ClientFilter = CrudFilters[number]

type ActionHandlers = {
  onViewDetails: (record: ClientAccountRow) => void
  onSendEmail: (record: ClientAccountRow) => void
  onCall: (record: ClientAccountRow) => void
}

type ClientDetailsFormValues = {
  companyName: string
  title?: string | null
  representative?: string | null
  email?: string | null
  phone?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  addressLine3?: string | null
  region?: string | null
}

type AddClientFormValues = Required<
  Pick<ClientDetailsFormValues, "companyName" | "title" | "representative" | "email" | "region">
> &
  Partial<Pick<ClientDetailsFormValues, "phone" | "addressLine1" | "addressLine2" | "addressLine3">>

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

const getCompanyInitial = (value: string) => {
  const first = value.trim()[0]
  if (!first) return "#"
  if (/[A-Z]/i.test(first)) {
    return first.toUpperCase()
  }
  if (/\d/.test(first)) {
    return "#"
  }
  return "#"
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
  const baseName = toNullableString(raw.representative)
  const displayName = composeDisplayName(baseName, honorific, companyDisplay)
  const companyInitial = getCompanyInitial(companyDisplay)

  return {
    id: raw.id,
    displayName,
    baseName,
    honorific,
    email: toNullableString(raw.email),
    phone: toNullableString(raw.phone),
    addressLine1: toNullableString(raw.addressLine1),
    addressLine2: toNullableString(raw.addressLine2),
    addressLine3: toNullableString(raw.addressLine3),
    region: toNullableString(raw.region ?? raw.addressLine5),
    company: {
      id: raw.id,
      name: companyDisplay,
    },
    companyInitial,
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
      case "companyInitial": {
        if (typeof value === "string" && value.trim().length > 0) {
          const token = value.trim().toUpperCase()
          if (token === "#") {
            return result.filter((row) => row.companyInitial === "#")
          }
          return result.filter((row) => row.companyInitial === token)
        }
        return result
      }
      case "hasOverduePayment": {
        if (value === undefined || value === null || value === "") {
          return result
        }
        if (Array.isArray(value)) {
          if (value.length === 0) {
            return result
          }
          const normalized = value
            .map((entry) => `${entry}`.trim())
            .filter((entry): entry is "true" | "false" => entry === "true" || entry === "false")
          if (normalized.length === 0) {
            return result
          }
          return result.filter((row) => {
            const token: "true" | "false" = row.hasOverduePayment ? "true" : "false"
            return normalized.includes(token)
          })
        }
        if (typeof value === "string") {
          const trimmed = value.trim()
          if (trimmed === "true" || trimmed === "false") {
            return result.filter((row) => {
              const token: "true" | "false" = row.hasOverduePayment ? "true" : "false"
              return token === trimmed
            })
          }
        }
        if (typeof value === "boolean") {
          return result.filter((row) => row.hasOverduePayment === value)
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
        case "hasOverduePayment":
          return record.hasOverduePayment ? "1" : "0"
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

    let normalized: ClientAccountRow[] = directoryCache.records
    try {
      const response = await fetch("/api/client-directory", {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      } as RequestInit)
      if (response.status === 304 && directoryCache.records.length > 0) {
        // Use cached records
        normalized = directoryCache.records
      } else {
        if (!response.ok) {
          throw new Error("Failed to load client directory")
        }
        const payload = await response.json()
        const rawItems: DirectoryApiRecord[] = payload.data ?? []
        normalized = rawItems.map((entry, index) => normalizeRecord(entry, index))
        directoryCache.records = normalized
      }
    } catch (e) {
      // Network/cache fallback: if we have cache, use it; else rethrow
      if (directoryCache.records.length === 0) {
        throw e
      }
      normalized = directoryCache.records
    }

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
      {overdue ? "Payment Due" : "No Payment Due"}
    </Space>
  </Tag>
)

const RepresentativeAvatar = ({
  seed,
  value,
  size = 32,
}: {
  seed: string
  value: string
  size?: number
}) => (
  <Avatar size={size} style={{ backgroundColor: getAvatarColor(seed) }}>
    {getInitials(value)}
  </Avatar>
)

const CompanyAvatar = ({ seed, size = 32 }: { seed: string; size?: number }) => (
  <Avatar
    shape="square"
    size={size}
    style={{
      backgroundColor: getAvatarColor(seed),
      borderRadius: 10,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {null}
  </Avatar>
)

const ActionButtons = ({ record, onViewDetails, onSendEmail, onCall }: ActionHandlers & { record: ClientAccountRow }) => (
  <Space data-table-action>
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

const alphabetTokens = ["All", "#", ...Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))]

type AlphabetScrollbarProps = {
  active: string | null
  available: ReadonlySet<string>
  onSelect: (token: string | null) => void
}

const AlphabetScrollbar = ({ active, available, onSelect }: AlphabetScrollbarProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const availableTokens = useMemo(() => {
    const next = new Set<string>(available)
    next.add("All")
    return next
  }, [available])

  const visibleTokens = useMemo(() => {
    const preferredActive = active ?? undefined
    const filtered = alphabetTokens.filter((token) => {
      if (token === "All") {
        return true
      }
      if (token === "#") {
        return availableTokens.has("#")
      }
      if (availableTokens.has(token)) {
        return true
      }
      return preferredActive === token
    })
    if (!filtered.includes("All")) {
      filtered.unshift("All")
    }
    return filtered
  }, [active, availableTokens])

  const commitSelection = (token: string) => {
    if (token === "All") {
      onSelect(null)
      return
    }
    if (!availableTokens.has(token)) {
      return
    }
    onSelect(token)
  }

  const pickToken = (clientY: number) => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const rect = container.getBoundingClientRect()
    if (rect.height === 0) {
      return
    }
    const ratio = (clientY - rect.top) / rect.height
    const index = Math.min(
      visibleTokens.length - 1,
      Math.max(0, Math.floor(ratio * visibleTokens.length)),
    )
    const token = visibleTokens[index]
    commitSelection(token)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    pickToken(event.clientY)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return
    }
    pickToken(event.clientY)
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return
    }
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={handlePointerDown}
      onPointerMoveCapture={handlePointerMove}
      onPointerUpCapture={handlePointerUp}
      onPointerCancelCapture={handlePointerUp}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "8px 4px",
        borderRadius: 12,
        background: "rgba(226, 232, 240, 0.75)",
        boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
        userSelect: "none",
        touchAction: "none",
        maxHeight: "48vh",
        justifyContent: "flex-start",
      }}
    >
      {visibleTokens.map((token) => {
        const isActive = token === (active ?? "All")
        const isAvailable = token === "All" || availableTokens.has(token)
        return (
          <button
            key={token}
            type="button"
            onClick={(event) => {
              event.preventDefault()
              commitSelection(token)
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              border: 0,
              fontWeight: 600,
              fontSize: token === "All" ? 11 : 12,
              color: isAvailable ? (isActive ? "#fff" : "#1e293b") : "#94a3b8",
              background: isActive ? "#1d4ed8" : "transparent",
              cursor: isAvailable ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            disabled={!isAvailable}
          >
            {token}
          </button>
          )
      })}
    </div>
  )
}

type TableViewProps = {
  tableProps: any
  companyOptions: Array<{ value: string; label: string }>
  alphabetAvailable: ReadonlySet<string>
  alphabetActive: string | null
  onAlphabetSelect: (token: string | null) => void
} & ActionHandlers

const ClientAccountsTable = ({
  tableProps,
  companyOptions,
  alphabetAvailable,
  alphabetActive,
  onAlphabetSelect,
  onViewDetails,
  onSendEmail,
  onCall,
}: TableViewProps) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      columnGap: 16,
      alignItems: "stretch",
      width: "100%",
      paddingRight: 12,
    }}
  >
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
          width: "100%",
        },
      }}
      style={{ flex: 1 }}
    >
      <Table<ClientAccountRow>
        {...tableProps}
        rowKey="id"
        onRow={(record) => ({
          onClick: (event) => {
            const target = event.target as HTMLElement
            if (target.closest('[data-table-action]')) {
              return
            }
            onViewDetails(record)
          },
        })}
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
            <Space size={12} align="center">
              <CompanyAvatar seed={record.company.id || record.company.name} />
              <Button
                type="link"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onViewDetails(record)
                }}
                style={{ padding: 0, fontWeight: 600 }}
              >
                {record.company.name}
              </Button>
            </Space>
          )}
        />
        <Table.Column<ClientAccountRow>
          dataIndex="hasOverduePayment"
          title="Payment Status"
          width={200}
          sorter
          render={(_, record) => <PaymentStatusTag overdue={record.hasOverduePayment} />}
        />
        <Table.Column<ClientAccountRow>
          dataIndex="displayName"
          title="Representative"
          width={300}
          render={(_, record) => (
            <Space align="start">
              <RepresentativeAvatar seed={record.avatarSeed} value={record.baseName ?? record.displayName} />
              <Text strong>{record.displayName}</Text>
            </Space>
          )}
          filterDropdown={(props) => (
            <FilterDropdown {...props}>
              <Input placeholder="Search Representative" />
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
          render={(_, record) => {
            const phone = toNullableString(record.phone)
            return (
              <Space direction="vertical" size={0}>
                <Text>{formatDisplayValue(record.email)}</Text>
                {phone ? <Text type="secondary">{phone}</Text> : null}
              </Space>
            )
          }}
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
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "flex-start",
        marginTop: 28,
        paddingRight: 8,
      }}
    >
      <AlphabetScrollbar active={alphabetActive} available={alphabetAvailable} onSelect={onAlphabetSelect} />
    </div>
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
  const [initialValues, setInitialValues] = useState<ClientDetailsFormValues | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const hydrateValues = (entry: ClientAccountRow): ClientDetailsFormValues => ({
    companyName: entry.source.companyName ?? entry.company.name,
    title: entry.source.title ?? entry.honorific ?? null,
    representative: entry.source.representative ?? entry.baseName ?? null,
    email: entry.source.email ?? entry.email ?? null,
    phone: entry.source.phone ?? entry.phone ?? null,
    addressLine1: entry.source.addressLine1 ?? entry.addressLine1 ?? null,
    addressLine2: entry.source.addressLine2 ?? entry.addressLine2 ?? null,
    addressLine3: entry.source.addressLine3 ?? entry.addressLine3 ?? null,
    region: entry.source.region ?? entry.region ?? null,
  })

  useEffect(() => {
    if (record) {
      const nextValues = hydrateValues(record)
      form.setFieldsValue(nextValues)
      setInitialValues(nextValues)
      setIsEditing(false)
    } else {
      form.resetFields()
      setInitialValues(null)
      setIsEditing(false)
    }
  }, [record, form])

  useEffect(() => {
    if (!open) {
      setIsEditing(false)
    }
  }, [open])

  const addressLines = useMemo(() => {
    if (!record) {
      return [] as string[]
    }
    return formatAddressLines(record).filter((line) => line !== "N/A")
  }, [record])

  type DetailItemValue = string | string[] | ReactNode | null
  type DetailItem = { key: string; label: string; value: DetailItemValue; always?: boolean }

  const detailItems = useMemo<DetailItem[]>(() => {
    if (!record) {
      return []
    }
    return [
      { key: "company", label: "Company", value: record.company.name, always: true },
      {
        key: "representative",
        label: "Representative",
        value: (
          <Space align="center" size={12}>
            <RepresentativeAvatar
              seed={record.avatarSeed}
              value={record.baseName ?? record.displayName}
              size={32}
            />
            <Text strong>{record.displayName}</Text>
          </Space>
        ),
        always: true,
      },
      { key: "email", label: "Email", value: toNullableString(record.email) },
      {
        key: "address",
        label: "Address",
        value: addressLines.length > 0 ? addressLines : null,
      },
    ]
  }, [record, addressLines])

  const visibleItems = useMemo(() => {
    return detailItems.filter((item) => {
      if (item.always) {
        return true
      }
      if (Array.isArray(item.value)) {
        return item.value.length > 0
      }
      if (typeof item.value === "string") {
        return toNullableString(item.value) !== null
      }
      return Boolean(item.value)
    })
  }, [detailItems])

  const handleCancelEdit = () => {
    if (initialValues) {
      form.setFieldsValue(initialValues)
    } else {
      form.resetFields()
    }
    setIsEditing(false)
  }

  const handleFinish = async (values: ClientDetailsFormValues) => {
    await onSubmit(values)
    setInitialValues(values)
    setIsEditing(false)
  }

  const handleDrawerClose = () => {
    if (isEditing) {
      handleCancelEdit()
    }
    onClose()
  }

  return (
    <Drawer
      placement="right"
      width={480}
      open={open}
      onClose={handleDrawerClose}
      destroyOnClose={false}
      title={null}
      maskClosable={!saving}
    >
      {record ? (
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              width: "100%",
            }}
          >
            <Space align="center" size={16}>
              <CompanyAvatar seed={record.company.name} size={64} />
              <Space direction="vertical" size={4}>
                <Text strong style={{ fontSize: 20 }}>
                  {record.company.name}
                </Text>
                {record.email ? <Text type="secondary">{record.email}</Text> : null}
                <PaymentStatusTag overdue={record.hasOverduePayment} />
              </Space>
            </Space>
            {!isEditing ? (
              <Button type="primary" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : null}
          </div>
          {isEditing ? (
            <Form<ClientDetailsFormValues> form={form} layout="vertical" onFinish={handleFinish}>
              <Form.Item
                label="Company Name"
                name="companyName"
                rules={[{ required: true, message: "Company name is required" }]}
              >
                <Input placeholder="Enter company name" />
              </Form.Item>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <Form.Item label="Title" name="title" style={{ flex: "0 0 160px", minWidth: 140 }}>
                  <Select
                    allowClear
                    placeholder="Title"
                    options={[
                      { label: "Mr.", value: "Mr." },
                      { label: "Mrs.", value: "Mrs." },
                      { label: "Ms.", value: "Ms." },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label="Representative"
                  name="representative"
                  style={{ flex: 1, minWidth: 200 }}
                  rules={[{ required: true, message: "Representative name is required" }]}
                >
                  <Input placeholder="Enter representative name" />
                </Form.Item>
              </div>
              <Form.Item label="Email" name="email" rules={[{ type: "email", message: "Enter a valid email" }]}> 
                <Input placeholder="Enter email" type="email" />
              </Form.Item>
              <Form.Item label="Phone" name="phone">
                <Input placeholder="Enter phone" />
              </Form.Item>
              <Form.Item label="Unit / Floor / Block / Building" name="addressLine1">
                <Input placeholder="Unit / Floor / Block / Building" />
              </Form.Item>
              <Form.Item label="Street No. / Street" name="addressLine2">
                <Input placeholder="Street No. / Street" />
              </Form.Item>
              <Form.Item label="District" name="addressLine3">
                <Input placeholder="District" />
              </Form.Item>
              <Form.Item label="Region" name="region">
                <Select
                  placeholder="Select region"
                  options={[
                    { label: "Kowloon", value: "Kowloon" },
                    { label: "Hong Kong", value: "Hong Kong" },
                    { label: "New Territories", value: "New Territories" },
                  ]}
                />
              </Form.Item>
              <Space style={{ justifyContent: "flex-end", display: "flex" }}>
                <Button onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={saving}>
                  Save
                </Button>
              </Space>
            </Form>
          ) : (
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              {visibleItems.map((item) => (
                <div key={item.key}>
                  <Text type="secondary" style={{ display: "block", textTransform: "uppercase", fontSize: 12 }}>
                    {item.label}
                  </Text>
                  <div style={{ marginTop: 4 }}>
                    {Array.isArray(item.value)
                      ? item.value.map((line) => (
                          <Text key={line} strong style={{ display: "block" }}>
                            {line}
                          </Text>
                        ))
                      : typeof item.value === "string"
                      ? <Text strong>{item.value}</Text>
                      : item.value}
                  </div>
                </div>
              ))}
            </Space>
          )}
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
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Form.Item
            label="Title"
            name="title"
            style={{ flex: "0 0 160px", minWidth: 140 }}
          >
            <Select
              options={[
                { label: "Mr.", value: "Mr." },
                { label: "Mrs.", value: "Mrs." },
                { label: "Ms.", value: "Ms." },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Representative"
            name="representative"
            style={{ flex: 1, minWidth: 200 }}
          >
            <Input placeholder="Representative name" />
          </Form.Item>
        </div>
        <Form.Item label="Email" name="email">
          <Input placeholder="Email" type="email" />
        </Form.Item>
        <Form.Item label="Phone" name="phone">
          <Input placeholder="Phone" />
        </Form.Item>
        <Form.Item label="Unit / Floor / Block / Building" name="addressLine1">
          <Input placeholder="Unit / Floor / Block / Building" />
        </Form.Item>
        <Form.Item label="Street No. / Street" name="addressLine2">
          <Input placeholder="Street No. / Street" />
        </Form.Item>
        <Form.Item label="District" name="addressLine3">
          <Input placeholder="District" />
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

const ClientAccountsContent = () => {
  const [searchForm] = Form.useForm()
  const screens = Grid.useBreakpoint()
  const { message } = AntdApp.useApp()
  const [detailsRecord, setDetailsRecord] = useState<ClientAccountRow | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isDetailsSaving, setIsDetailsSaving] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [activeInitial, setActiveInitial] = useState<string | null>(null)

  const { tableProps, searchFormProps, setCurrentPage, tableQuery, filters, setFilters } = useTable({
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
        { field: "companyInitial", operator: "eq", value: undefined },
        { field: "hasOverduePayment", operator: "eq", value: undefined },
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

  useEffect(() => {
    const currentInitial = filters?.find(
      (entry: any) => entry && typeof entry === "object" && entry.field === "companyInitial",
    ) as { value?: unknown } | undefined
    const rawValue = currentInitial?.value
    if (typeof rawValue === "string" && rawValue.trim().length > 0) {
      setActiveInitial(rawValue)
    } else {
      setActiveInitial(null)
    }
  }, [filters])

  const availableInitials = useMemo(() => {
    const set = new Set<string>()
    directoryCache.records.forEach((record) => {
      set.add(record.companyInitial)
    })
    return set
  }, [tableQuery.data?.data])

  const handleAlphabetSelect = (token: string | null) => {
    setCurrentPage(1)
    setFilters((previous: any[]) => {
      const base = (previous ?? []).filter(
        (entry: any) => !(entry && typeof entry === "object" && entry.field === "companyInitial"),
      )
      if (!token) {
        return base
      }
      return [...base, { field: "companyInitial", operator: "eq", value: token }]
    })
    setActiveInitial(token)
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
            representative: values.representative,
            email: values.email,
            phone: values.phone,
            addressLine1: values.addressLine1,
            addressLine2: values.addressLine2,
            addressLine3: values.addressLine3,
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
            representative: values.representative,
            email: values.email,
            phone: values.phone,
            addressLine1: values.addressLine1,
            addressLine2: values.addressLine2,
            addressLine3: values.addressLine3,
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
        padding: screens.md ? "32px 0 32px 24px" : "24px 16px",
        minHeight: "100%",
        background: "#fff",
      }}
    >
      <div
        style={{
          margin: 0,
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: screens.md ? "row" : "column",
            alignItems: screens.md ? "center" : "stretch",
            justifyContent: screens.md ? "space-between" : "flex-start",
            gap: screens.md ? 16 : 12,
            marginBottom: 24,
            width: "100%",
          }}
        >
          <Button
            type="primary"
            size="large"
            icon={<PlusCircleOutlined />}
            onClick={() => setIsAddOpen(true)}
            style={{
              borderRadius: 999,
              paddingInline: 20,
              alignSelf: screens.md ? "auto" : "flex-start",
            }}
          >
            Add
          </Button>
          <Form
            form={searchForm}
            {...searchFormProps}
            layout="inline"
            style={{
              marginBottom: 0,
              width: screens.md ? 220 : "100%",
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
        </div>
        <ClientAccountsTable
          tableProps={tableProps}
          companyOptions={companyOptions}
          alphabetAvailable={availableInitials}
          alphabetActive={activeInitial}
          onAlphabetSelect={handleAlphabetSelect}
          onViewDetails={handleViewDetails}
          onSendEmail={handleSendEmail}
          onCall={handleCall}
        />
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


const ClientAccountsShell = () => (
  <AppShell
    dataProvider={refineDataProvider}
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
    allowedMenuKeys={ALLOWED_MENU_KEYS}
  >
    <ClientAccountsContent />
  </AppShell>
)

export default ClientAccountsShell
