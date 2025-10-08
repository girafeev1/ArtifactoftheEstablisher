import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react"
import {
  type CrudFilters,
  type CrudSorting,
  type DataProvider,
  type GetListResponse,
  type HttpError,
} from "@refinedev/core"
import { useTable } from "@refinedev/antd"
import {
  App as AntdApp,
  Button,
  Drawer,
  Form,
  Grid,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd"
import { ArrowLeftOutlined, EyeOutlined, SearchOutlined } from "@ant-design/icons"
import debounce from "lodash.debounce"

import type { ProjectRecord } from "../../lib/projectsDatabase"
import AppShell from "../new-ui/AppShell"

if (typeof window === "undefined") {
  console.info("[projects] Module loaded", {
    timestamp: new Date().toISOString(),
  })
}

const { Text, Title } = Typography

const ALLOWED_MENU_KEYS = ["dashboard", "projects"] as const

const projectsCache: {
  years: string[]
  subsidiaries: string[]
} = {
  years: [],
  subsidiaries: [],
}

type ProjectsFilter = CrudFilters[number]

type ProjectRow = ProjectRecord & {
  projectNumber: string
  projectTitle: string | null
  clientCompany: string | null
  subsidiary: string | null
  searchIndex: string
}

type ProjectFiltersForm = {
  year?: string
  subsidiary?: string
  search?: string
}

type ProjectsListResponse = {
  data?: ProjectRecord[]
  years?: string[]
}

const stringOrNA = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return "N/A"
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : "N/A"
}

const amountText = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-"
  }
  return `HK$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

const paidStatusText = (value: boolean | null | undefined) => {
  if (value === null || value === undefined) {
    return "N/A"
  }
  return value ? "Paid" : "Unpaid"
}

const paidStatusColor = (value: boolean | null | undefined) => {
  if (value === null || value === undefined) {
    return "default"
  }
  return value ? "green" : "red"
}

const paidDateText = (
  paid: boolean | null | undefined,
  date: string | null | undefined,
) => {
  if (!paid) {
    return "-"
  }
  if (!date) {
    return "-"
  }
  const trimmed = date.trim()
  return trimmed.length > 0 ? trimmed : "-"
}

const normalizeProject = (record: ProjectRecord): ProjectRow => {
  const projectNumber = record.projectNumber?.trim() ?? record.id
  const projectTitle = record.projectTitle ? record.projectTitle.trim() || null : null
  const clientCompany = record.clientCompany ? record.clientCompany.trim() || null : null
  const subsidiary = record.subsidiary ? record.subsidiary.trim() || null : null
  const searchIndex = [
    projectNumber,
    projectTitle ?? "",
    clientCompany ?? "",
    subsidiary ?? "",
    record.invoice ?? "",
    record.projectNature ?? "",
    record.presenterWorkType ?? "",
  ]
    .join(" ")
    .toLowerCase()

  return {
    ...record,
    projectNumber,
    projectTitle,
    clientCompany,
    subsidiary,
    searchIndex,
  }
}

const isFieldFilter = (filter: ProjectsFilter): filter is ProjectsFilter & { field: string } =>
  typeof filter === "object" && filter !== null && "field" in filter

const collectFilterValue = (filters: CrudFilters | undefined, field: string) => {
  if (!filters) {
    return undefined
  }
  const entry = (filters as Array<{ field?: string; value?: unknown }>).find(
    (item) => item && typeof item === "object" && "field" in item && item.field === field,
  )
  return entry?.value as string | undefined
}

const applySorting = (rows: ProjectRow[], sorters?: CrudSorting) => {
  if (!sorters || sorters.length === 0) {
    return rows
  }

  const mapValue = (row: ProjectRow, field: string): string | number | null => {
    switch (field) {
      case "projectDateIso": {
        const source = row.projectDateIso
        if (!source) return null
        const parsed = new Date(source)
        return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
      }
      case "projectNumber":
        return row.projectNumber
      case "clientCompany":
        return row.clientCompany ?? null
      case "projectTitle":
        return row.projectTitle ?? null
      case "amount":
        return row.amount ?? null
      case "paid":
        return row.paid ?? null
      case "subsidiary":
        return row.subsidiary ?? null
      case "year":
        return row.year
      default:
        return null
    }
  }

  const compare = (aVal: ReturnType<typeof mapValue>, bVal: ReturnType<typeof mapValue>) => {
    if (aVal === bVal) return 0
    if (aVal === null || aVal === undefined) return -1
    if (bVal === null || bVal === undefined) return 1
    if (typeof aVal === "number" && typeof bVal === "number") {
      if (aVal < bVal) return -1
      if (aVal > bVal) return 1
      return 0
    }
    return `${aVal}`.localeCompare(`${bVal}`, undefined, { numeric: true, sensitivity: "base" })
  }

  const activeSorters = sorters.filter((entry) => entry && entry.field && entry.order)

  if (activeSorters.length === 0) {
    return rows
  }

  return [...rows].sort((a, b) => {
    for (const sorter of activeSorters) {
      const field = sorter.field as string
      const order = sorter.order === "asc" ? 1 : -1
      const result = compare(mapValue(a, field), mapValue(b, field))
      if (result !== 0) {
        return result * order
      }
    }
    return 0
  })
}

const refineDataProvider: DataProvider = {
  getList: async ({
    resource,
    filters,
    pagination,
    sorters,
  }): Promise<GetListResponse<ProjectRow>> => {
    if (resource !== "projects") {
      return { data: [], total: 0 }
    }

    let year: string | undefined
    let subsidiaryFilter: string | undefined
    let searchToken: string | undefined

    if (filters) {
      for (const filter of filters) {
        if (!isFieldFilter(filter)) continue
        if (filter.field === "year" && typeof filter.value === "string") {
          year = filter.value
        }
        if (filter.field === "subsidiary" && typeof filter.value === "string") {
          subsidiaryFilter = filter.value
        }
        if (filter.field === "search" && typeof filter.value === "string") {
          searchToken = filter.value
        }
      }
    }

    const params = new URLSearchParams()
    if (year) {
      params.set("year", year)
    }

    const url = params.toString().length > 0 ? `/api/projects?${params.toString()}` : "/api/projects"

    const response = await fetch(url, { credentials: "include" })
    if (!response.ok) {
      throw new Error("Failed to load projects")
    }

    const payload = (await response.json()) as ProjectsListResponse
    const rawItems: ProjectRecord[] = payload.data ?? []
    projectsCache.years = Array.isArray(payload.years) ? payload.years : []

    let normalized = rawItems.map((entry) => normalizeProject(entry))

    const availableSubsidiaries = new Set<string>()
    normalized.forEach((entry) => {
      if (entry.subsidiary) {
        availableSubsidiaries.add(entry.subsidiary)
      }
    })
    projectsCache.subsidiaries = Array.from(availableSubsidiaries).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    )

    if (subsidiaryFilter) {
      const normalizedFilter = subsidiaryFilter.toLowerCase()
      normalized = normalized.filter(
        (entry) => (entry.subsidiary ?? "").toLowerCase() === normalizedFilter,
      )
    }

    if (searchToken) {
      const token = searchToken.trim().toLowerCase()
      if (token.length > 0) {
        normalized = normalized.filter((entry) => entry.searchIndex.includes(token))
      }
    }

    const sorted = applySorting(normalized, sorters)

    const current = pagination?.current ?? 1
    const pageSize = pagination?.pageSize ?? 12
    const start = (current - 1) * pageSize
    const paginated = sorted.slice(start, start + pageSize)

    return {
      data: paginated as ProjectRow[],
      total: sorted.length,
      meta: {
        years: projectsCache.years,
        subsidiaries: projectsCache.subsidiaries,
      },
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

const tableHeadingStyle = { fontFamily: "'Cantata One'", fontWeight: 400 }
const tableCellStyle = { fontFamily: "'Newsreader'", fontWeight: 500 }

const ProjectDetailsDrawer = ({
  project,
  open,
  onClose,
}: {
  project: ProjectRow | null
  open: boolean
  onClose: () => void
}) => {
  const handleClose = () => {
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      width={480}
      title={<span style={{ fontFamily: "'Cantata One'", fontWeight: 400 }}>Project Details</span>}
      destroyOnClose
      bodyStyle={{ padding: 24, background: "#fff" }}
      headerStyle={{ borderBottom: "1px solid #e5e7eb" }}
      footer={null}
    >
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleClose} style={{ marginBottom: 16 }}>
        Close
      </Button>
      {project ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <DetailField label="Project Number" value={stringOrNA(project.projectNumber)} />
          <DetailField label="Project Title" value={stringOrNA(project.projectTitle)} />
          <DetailField label="Client Company" value={stringOrNA(project.clientCompany)} />
          <DetailField label="Subsidiary" value={stringOrNA(project.subsidiary)} />
          <DetailField label="Year" value={stringOrNA(project.year)} />
          <DetailField label="Project Date" value={project.projectDateDisplay ?? "-"} />
          <DetailField label="On Date" value={paidDateText(project.paid, project.onDateDisplay)} />
          <DetailField label="Invoice" value={stringOrNA(project.invoice)} />
          <DetailField label="Paid Status" value={paidStatusText(project.paid)} />
          <DetailField label="Paid To" value={stringOrNA(project.paidTo)} />
          <DetailField label="Amount" value={amountText(project.amount)} />
          <DetailField label="Project Nature" value={stringOrNA(project.projectNature)} />
          <DetailField label="Presenter Work Type" value={stringOrNA(project.presenterWorkType)} />
        </Space>
      ) : (
        <Text style={tableCellStyle}>Select a project to view details.</Text>
      )}
    </Drawer>
  )
}

const DetailField = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <span style={{ fontFamily: "'Newsreader'", fontWeight: 200 }}>{label}:</span>
    <span style={tableCellStyle}>{value}</span>
  </div>
)

const ProjectsContent = () => {
  const [filtersForm] = Form.useForm<ProjectFiltersForm>()
  const screens = Grid.useBreakpoint()
  const { message } = AntdApp.useApp()
  const [activeProject, setActiveProject] = useState<ProjectRow | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const {
    tableProps,
    tableQuery,
    filters,
    setFilters,
    setCurrentPage,
  } = useTable<ProjectRow, HttpError, ProjectFiltersForm>({
    resource: "projects",
    pagination: {
      pageSize: 12,
    },
    sorters: {
      initial: [
        {
          field: "projectDateIso",
          order: "desc",
        },
      ],
    },
    filters: {
      initial: [
        { field: "year", operator: "eq", value: undefined },
        { field: "subsidiary", operator: "eq", value: undefined },
        { field: "search", operator: "contains", value: undefined },
      ],
    },
    onSearch: (values) => [
      {
        field: "search",
        operator: "contains",
        value: values.search,
      },
    ],
    syncWithLocation: false,
  }) as any

  const availableYears = useMemo(() => {
    const metaYears = (tableQuery?.data?.meta?.years as string[] | undefined) ?? projectsCache.years
    return Array.isArray(metaYears) ? metaYears : []
  }, [tableQuery?.data?.meta?.years])

  const availableSubsidiaries = useMemo(() => {
    const metaSubs = (tableQuery?.data?.meta?.subsidiaries as string[] | undefined) ?? projectsCache.subsidiaries
    return Array.isArray(metaSubs) ? metaSubs : []
  }, [tableQuery?.data?.meta?.subsidiaries])

  const activeYear = collectFilterValue(filters, "year")
  const activeSubsidiary = collectFilterValue(filters, "subsidiary")
  const activeSearch = collectFilterValue(filters, "search") ?? ""

  useEffect(() => {
    filtersForm.setFieldsValue({
      year: activeYear,
      subsidiary: activeSubsidiary,
      search: activeSearch,
    })
  }, [filtersForm, activeYear, activeSubsidiary, activeSearch])

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string | undefined) => {
        setCurrentPage(1)
        setFilters((previous: any[]) => {
          const base = (previous ?? []).filter(
            (entry: any) => !(entry && typeof entry === "object" && entry.field === "search"),
          )
          if (!value || value.trim().length === 0) {
            return base
          }
          return [
            ...base,
            { field: "search", operator: "contains", value: value.trim() },
          ]
        })
      }, 400),
    [setFilters, setCurrentPage],
  )

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])

  const updateFilter = (field: string, value: string | undefined) => {
    setCurrentPage(1)
    setFilters((previous: any[]) => {
      const base = (previous ?? []).filter(
        (entry: any) => !(entry && typeof entry === "object" && entry.field === field),
      )
      if (!value || value.trim().length === 0) {
        return base
      }
      return [...base, { field, operator: field === "search" ? "contains" : "eq", value }]
    })
  }

  const handleYearChange = (value: string | undefined) => {
    updateFilter("year", value)
  }

  const handleSubsidiaryChange = (value: string | undefined) => {
    updateFilter("subsidiary", value)
  }

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(event.target.value)
  }

  const handleViewDetails = useCallback((record: ProjectRow) => {
    setActiveProject(record)
    setIsDrawerOpen(true)
  }, [setActiveProject, setIsDrawerOpen])

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false)
    setActiveProject(null)
  }, [setActiveProject, setIsDrawerOpen])

  const columns = useMemo(() => {
    return [
      {
        key: "project",
        title: <span style={tableHeadingStyle}>Project</span>,
        dataIndex: "projectNumber",
        sorter: true,
        render: (_: unknown, record: ProjectRow) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ ...tableCellStyle, fontSize: 16 }}>{stringOrNA(record.projectNumber)}</span>
            <span style={{ ...tableCellStyle, fontSize: 13, color: "#475569" }}>
              {stringOrNA(record.projectTitle)}
            </span>
          </div>
        ),
      },
      {
        key: "clientCompany",
        title: <span style={tableHeadingStyle}>Client Company</span>,
        dataIndex: "clientCompany",
        sorter: true,
        render: (value: string | null) => <span style={tableCellStyle}>{stringOrNA(value)}</span>,
      },
      {
        key: "amount",
        title: <span style={tableHeadingStyle}>Amount</span>,
        dataIndex: "amount",
        sorter: true,
        align: "right" as const,
        render: (value: number | null) => (
          <span style={{ ...tableCellStyle, fontVariantNumeric: "tabular-nums" }}>{amountText(value)}</span>
        ),
      },
      {
        key: "projectDate",
        title: <span style={tableHeadingStyle}>Project Date</span>,
        dataIndex: "projectDateDisplay",
        sorter: true,
        render: (_: string | null, record: ProjectRow) => (
          <span style={tableCellStyle}>{record.projectDateDisplay ?? "-"}</span>
        ),
      },
      {
        key: "paid",
        title: <span style={tableHeadingStyle}>Paid</span>,
        dataIndex: "paid",
        sorter: true,
        render: (value: boolean | null, record: ProjectRow) => (
          <Tag color={paidStatusColor(value)} style={{ ...tableCellStyle, borderRadius: 999 }}>
            {paidStatusText(record.paid)}
          </Tag>
        ),
      },
      {
        key: "subsidiary",
        title: <span style={tableHeadingStyle}>Subsidiary</span>,
        dataIndex: "subsidiary",
        sorter: true,
        render: (value: string | null) => <span style={tableCellStyle}>{stringOrNA(value)}</span>,
      },
      {
        key: "actions",
        title: <span style={tableHeadingStyle}>Actions</span>,
        dataIndex: "actions",
        render: (_: unknown, record: ProjectRow) => (
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetails(record)}>
            View
          </Button>
        ),
      },
    ]
  }, [handleViewDetails])

  const yearOptions = availableYears.map((year) => ({ label: year, value: year }))
  const subsidiaryOptions = availableSubsidiaries.map((value) => ({ label: value, value }))

  useEffect(() => {
    if (tableQuery?.error) {
      const messageText =
        tableQuery.error instanceof Error ? tableQuery.error.message : "Failed to load projects"
      message.error(messageText)
    }
  }, [message, tableQuery?.error])

  return (
    <div
      style={{
        padding: screens.md ? "32px 0 32px 24px" : "24px 16px",
        minHeight: "100%",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <Title level={2} style={{ fontFamily: "'Cantata One'", marginBottom: 8 }}>
            Projects
          </Title>
          <Text style={{ fontFamily: "'Newsreader'", fontWeight: 400, color: "#475569" }}>
            Review project activity by year, subsidiary, and payment status.
          </Text>
        </div>
        <Form
          form={filtersForm}
          layout={screens.md ? "inline" : "vertical"}
          style={{ width: "100%", rowGap: screens.md ? 16 : 12 }}
        >
          <Form.Item name="year" label="Year" style={{ marginBottom: screens.md ? 0 : 12 }}>
            <Select
              allowClear
              placeholder="All years"
              options={yearOptions}
              onChange={(value) => handleYearChange(value ?? undefined)}
              style={{ minWidth: 160 }}
            />
          </Form.Item>
          <Form.Item
            name="subsidiary"
            label="Subsidiary"
            style={{ marginBottom: screens.md ? 0 : 12 }}
          >
            <Select
              allowClear
              placeholder="All subsidiaries"
              options={subsidiaryOptions}
              onChange={(value) => handleSubsidiaryChange(value ?? undefined)}
              style={{ minWidth: 200 }}
            />
          </Form.Item>
          <Form.Item name="search" label="Search" style={{ marginBottom: 0, flex: 1 }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search by project, client, or invoice"
              onChange={handleSearchChange}
            />
          </Form.Item>
        </Form>
        <Table<ProjectRow>
          {...tableProps}
          rowKey="id"
          columns={columns}
          pagination={{ ...tableProps.pagination, showSizeChanger: false }}
        />
      </div>
      <ProjectDetailsDrawer project={activeProject} open={isDrawerOpen} onClose={handleCloseDrawer} />
    </div>
  )
}

const ProjectsApp = () => (
  <AppShell
    dataProvider={refineDataProvider}
    resources={[
      { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
      {
        name: "projects",
        list: "/dashboard/new-ui/projects",
        meta: { label: "Projects" },
      },
    ]}
    allowedMenuKeys={ALLOWED_MENU_KEYS}
  >
    <ProjectsContent />
  </AppShell>
)

export default ProjectsApp
