import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from "react"
import { useRouter } from "next/router"
import { useQueryClient } from "@tanstack/react-query"
import { navigateWithModifier } from "../../lib/navigation"
import {
  type BaseRecord,
  type CrudFilters,
  type CrudSorting,
  type DataProvider,
  type GetListParams,
  type GetListResponse,
  type HttpError,
} from "@refinedev/core"
import { useTable } from "@refinedev/antd"
import {
  App as AntdApp,
  Button,
  Form,
  Grid,
  Input,
  Empty,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
  Modal,
  DatePicker,
  Space,
} from "antd"
import { EyeOutlined, PlusOutlined, SearchOutlined, DeleteOutlined } from "@ant-design/icons"
import debounce from "lodash.debounce"

import type { ProjectRecord, WorkStatus } from "../../lib/projectsDatabase"
import { WORK_STATUS_COLORS, WORK_STATUS_LABELS, WORK_STATUS_DESCRIPTIONS } from "../../lib/projectsDatabase"
import AppShell from "../layout/AppShell"
import { NAVIGATION_RESOURCES, ALLOWED_MENU_KEYS } from "../../lib/navigation/resources"
import {
  amountText,
  normalizeProject,
  paidDateText,
  paymentChipColor,
  paymentChipLabel,
  stringOrNA,
  type NormalizedProject,
} from "./projectUtils"

import { fetchSubsidiaryById } from "../../lib/subsidiaries"

const sanitizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toIsoUtcStringOrNull = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.toISOString()
}

interface SequenceCandidate {
  original: string
  prefix: string
  value: number
  width: number
  matchesYear: boolean
}

const extractSequence = (text: string): Omit<SequenceCandidate, 'matchesYear'> | null => {
  const match = text.match(/(\d+)(?!.*\d)/)
  if (!match || match.index === undefined) {
    return null
  }
  const digits = match[1]
  const prefix = text.slice(0, match.index)
  const value = Number.parseInt(digits, 10)
  if (Number.isNaN(value)) {
    return null
  }
  return {
    original: text,
    prefix,
    value,
    width: digits.length,
  }
}

const generateSequentialProjectNumber = (
  year: string | null,
  existingNumbers: readonly string[]
): string => {
  const trimmedYear = year?.trim() ?? ''
  const cleaned = existingNumbers
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))

  const parsed = cleaned
    .map((value) => {
      const sequence = extractSequence(value)
      if (!sequence) {
        return null
      }
      return {
        ...sequence,
        matchesYear:
          trimmedYear.length > 0 &&
          (value.startsWith(trimmedYear) || sequence.prefix.includes(trimmedYear)),
      } satisfies SequenceCandidate
    })
    .filter((candidate): candidate is SequenceCandidate => Boolean(candidate))

  const chooseCandidate = (candidates: SequenceCandidate[]): SequenceCandidate | null => {
    if (candidates.length === 0) {
      return null
    }
    return candidates.reduce((highest, current) =>
      current.value > highest.value ? current : highest
    )
  }

  const preferred = trimmedYear.length
    ? chooseCandidate(parsed.filter((candidate) => candidate.matchesYear))
    : null

  const fallback = chooseCandidate(parsed)

  const target = preferred ?? fallback

  if (target) {
    const nextValue = target.value + 1
    const padded = String(nextValue).padStart(target.width, '0')
    return `${target.prefix}${padded}`
  }

  const defaultPrefix = trimmedYear ? `${trimmedYear}-` : ''
  const defaultWidth = trimmedYear ? 3 : 3
  return `${defaultPrefix}${String(1).padStart(defaultWidth, '0')}`
}

if (typeof window === "undefined") {
  console.info("[projects] Module loaded", {
    timestamp: new Date().toISOString(),
  })
}

const { Title } = Typography

const projectsCache: {
  years: string[]
  subsidiaries: string[]
} = {
  years: [],
  subsidiaries: [],
}

type ProjectsFilter = CrudFilters[number]

type ProjectRow = NormalizedProject

type ProjectsTableHook = {
  tableProps: any
  tableQuery: {
    data?: GetListResponse<ProjectRow> & { meta?: Record<string, unknown> }
    error?: HttpError
  }
  filters: CrudFilters | undefined
  setFilters: (updater: any) => void
  setCurrentPage: (page: number) => void
}

type ProjectFiltersForm = {
  year?: string
  subsidiary?: string
  search?: string
}

type ProjectsListResponse = {
  data?: ProjectRecord[]
  years?: string[]
  subsidiaries?: string[]
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

  const resolveOrder = (value: string | undefined) => {
    if (!value) {
      return 1
    }
    const normalized = value.toLowerCase()
    if (normalized === "asc" || normalized === "ascend") {
      return 1
    }
    if (normalized === "desc" || normalized === "descend") {
      return -1
    }
    return 1
  }

  const mapValue = (row: ProjectRow, field: string): string | number | boolean | null => {
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
        return typeof row.paid === "boolean" ? row.paid : null
      case "subsidiary":
        return row.subsidiary ?? null
      case "year":
        return row.year
      default:
        return null
    }
  }

  const compare = (
    field: string,
    aVal: ReturnType<typeof mapValue>,
    bVal: ReturnType<typeof mapValue>,
  ) => {
    if (field === "paid") {
      const rank = (value: ReturnType<typeof mapValue>) => {
        if (value === null || value === undefined) {
          return 1
        }
        return value === false ? 2 : 0
      }
      const diff = rank(aVal) - rank(bVal)
      if (diff !== 0) {
        return diff
      }
    }

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
      const order = resolveOrder(sorter.order as string | undefined)
      const result = compare(field, mapValue(a, field), mapValue(b, field))
      if (result !== 0) {
        return result * order
      }
    }
    return 0
  })
}

const refineDataProvider: DataProvider = {
  getApiUrl: () => "/api",
  getList: async <TData extends BaseRecord = ProjectRow>({
    resource,
    filters,
    pagination,
    sorters,
  }: GetListParams): Promise<GetListResponse<TData>> => {
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

    const needsSelection = !year

    if (needsSelection) {
      const metadataParams = new URLSearchParams()
      metadataParams.set("metaOnly", "1")
      if (year) {
        metadataParams.set("year", year)
      }
      if (subsidiaryFilter) {
        metadataParams.set("subsidiary", subsidiaryFilter)
      }
      const metadataQuery = metadataParams.toString()
      const metadataUrl = metadataQuery.length > 0 ? `/api/projects?${metadataQuery}` : "/api/projects"
      const metadataResponse = await fetch(metadataUrl, { credentials: "include" })
      if (metadataResponse.ok) {
        const metadata = (await metadataResponse.json()) as ProjectsListResponse
        projectsCache.years = Array.isArray(metadata.years) ? metadata.years : []
        projectsCache.subsidiaries = Array.isArray(metadata.subsidiaries)
          ? metadata.subsidiaries
          : []
      }

      return {
        data: [] as TData[],
        total: 0,
        meta: {
          years: projectsCache.years,
          subsidiaries: projectsCache.subsidiaries,
          requiresSelection: true,
        },
      }
    }

    const params = new URLSearchParams()
    if (year) {
      params.set("year", year)
    }
    if (subsidiaryFilter) {
      params.set("subsidiary", subsidiaryFilter)
    }

    const url = params.toString().length > 0 ? `/api/projects?${params.toString()}` : "/api/projects"

    const response = await fetch(url, { credentials: "include" })
    if (!response.ok) {
      throw new Error("Failed to load projects")
    }

    const payload = (await response.json()) as ProjectsListResponse
    const rawItems: ProjectRecord[] = payload.data ?? []
    projectsCache.years = Array.isArray(payload.years) ? payload.years : []
    projectsCache.subsidiaries = Array.isArray(payload.subsidiaries) ? payload.subsidiaries : []

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

    return {
      data: sorted as unknown as TData[],
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

export const projectsDataProvider = refineDataProvider

const KARLA_FONT = "'Karla', sans-serif"

const tableHeadingStyle = { fontFamily: KARLA_FONT, fontWeight: 700, color: "#0f172a" }
const tableCellStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 500,
  lineHeight: 1.2,
}
const primaryRowTextStyle = { ...tableCellStyle, fontSize: 16, color: "#0f172a" }
const secondaryRowTextStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 500,
  fontSize: 13,
  color: "#475569",
  lineHeight: 1.2,
}
const captionRowTextStyle = {
  fontFamily: KARLA_FONT,
  fontWeight: 600,
  fontSize: 12,
  color: "#64748b",
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
}
const italicDescriptorStyle = { ...secondaryRowTextStyle, fontStyle: "italic" }
const subsidiaryTagStyle = {
  ...tableCellStyle,
  borderRadius: 9999,
  border: "none",
  backgroundColor: "#e0f2fe",
  color: "#0c4a6e",
  fontSize: 12,
  padding: "2px 10px",
  width: "fit-content" as const,
  marginTop: 4,
  display: "inline-flex",
  alignItems: "center",
} as const
const simpleDescriptorText = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return "-"
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : "-"
}
const paymentTagStyles: Record<string, { backgroundColor: string; color: string }> = {
  green: { backgroundColor: "#dcfce7", color: "#166534" },    // All Cleared
  red: { backgroundColor: "#fee2e2", color: "#b91c1c" },      // Due
  orange: { backgroundColor: "#ffedd5", color: "#c2410c" },   // Partially Cleared
  amber: { backgroundColor: "#fef3c7", color: "#92400e" },    // Pending (blinking)
  gray: { backgroundColor: "#f1f5f9", color: "#64748b" },     // On Hold
  default: { backgroundColor: "#e2e8f0", color: "#1f2937" },
}

const ProjectsContent = () => {
  const [filtersForm] = Form.useForm()
  const screens = Grid.useBreakpoint()
  const { message } = AntdApp.useApp()
  const router = useRouter()
  const queryClient = useQueryClient()

  const tableHook = useTable({
    resource: "projects",
    pagination: {
      pageSize: 12,
    },
    sorters: {
      initial: [
        {
          field: "projectNumber",
          order: "descend",
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
    onSearch: (values: { search?: string }) => [
      {
        field: "search",
        operator: "contains",
        value: values.search,
      },
    ],
    syncWithLocation: false,
  })

  const {
    tableProps,
    tableQuery,
    filters,
    setFilters,
    setCurrentPage,
  } = tableHook as ProjectsTableHook
  const [createForm] = Form.useForm()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [statusDropdownOpenId, setStatusDropdownOpenId] = useState<string | null>(null)
  const statusDropdownJustClosedRef = useRef(false)
  const [createYear, setCreateYear] = useState<string | undefined>(undefined)
  const [createNumbersLoading, setCreateNumbersLoading] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [subsidiaryMap, setSubsidiaryMap] = useState<Record<string, { englishName: string, chineseName: string }>>({})
  const [editingProjectNumber, setEditingProjectNumber] = useState(false)
  const [createFormTouched, setCreateFormTouched] = useState(false)

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
  const selectionRequired = Boolean(
    (tableQuery?.data?.meta as { requiresSelection?: boolean } | undefined)?.requiresSelection,
  )
  const hasActiveSelection = Boolean(activeYear)

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

  const updateFilter = useCallback(
    (field: string, value: string | undefined) => {
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
    },
    [setCurrentPage, setFilters],
  )

  useEffect(() => {
    if (!activeYear && availableYears.length > 0 && selectionRequired) {
      updateFilter("year", availableYears[0])
    }
  }, [activeYear, availableYears, selectionRequired, updateFilter])

  const loadProjectNumbers = useCallback(
    async (targetYear: string | undefined) => {
      if (!targetYear) {
        createForm.setFieldsValue({ projectNumber: "" })
        return
      }
      setCreateNumbersLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("year", targetYear)
        const response = await fetch(`/api/projects?${params.toString()}`, {
          credentials: "include",
        })
        const raw = await response.json().catch(() => ({}))
        const body = raw as ProjectsListResponse & { error?: string | undefined }
        if (!response.ok) {
          const errorMessage =
            typeof body?.error === "string" ? body.error : "Failed to load existing projects"
          throw new Error(errorMessage)
        }
        const records = Array.isArray(body.data) ? body.data : []
        const numbers = records
          .map((project) => (project?.projectNumber ?? "").trim())
          .filter((value) => value.length > 0)
        const generated = generateSequentialProjectNumber(targetYear, numbers)
        createForm.setFieldsValue({
          projectNumber: generated,
        })
      } catch (error) {
        const description = error instanceof Error ? error.message : "Failed to load project numbers"
        message.error(description)
      } finally {
        setCreateNumbersLoading(false)
      }
    },
    [createForm, message],
  )

  const handleYearChange = (value: string | undefined) => {
    updateFilter("year", value)
  }

  const handleSubsidiaryChange = (value: string | undefined) => {
    updateFilter("subsidiary", value)
  }

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(event.target.value)
  }

  const navigateToDetails = useCallback(
    (record: ProjectRow, event?: MouseEvent) => {
      // If status dropdown is open or was just closed, don't navigate
      // (the click was meant to close the dropdown, not to navigate)
      if (statusDropdownOpenId !== null || statusDropdownJustClosedRef.current) {
        setStatusDropdownOpenId(null)
        statusDropdownJustClosedRef.current = false
        return
      }
      if (!record?.id) {
        return
      }
      const target = `/projects/${encodeURIComponent(record.id)}`
      if (event) {
        navigateWithModifier(event, target, router)
      } else {
        router.push(target)
      }
    },
    [router, statusDropdownOpenId],
  )

  const handleCreateCancel = useCallback(() => {
    setCreateModalOpen(false)
    setCreateYear(undefined)
    createForm.resetFields()
  }, [createForm])

  const handleOpenCreate = useCallback(() => {
    if (availableYears.length === 0) {
      message.warning("No project collections are available.")
      return
    }
    const initialYear = activeYear ?? availableYears[0]
    createForm.resetFields()
    setCreateYear(initialYear)
    setCreateModalOpen(true)
    if (initialYear) {
      void loadProjectNumbers(initialYear)
    } else {
      createForm.setFieldsValue({ projectNumber: "" })
    }
  }, [activeYear, availableYears, createForm, loadProjectNumbers, message])

  const handleCreateYearSelect = useCallback(
    (value: string | undefined) => {
      setCreateYear(value)
      if (value) {
        void loadProjectNumbers(value)
      } else {
        createForm.setFieldsValue({ projectNumber: "" })
      }
    },
    [createForm, loadProjectNumbers],
  )

  const handleRegenerateNumber = useCallback(() => {
    if (!createYear) {
      return
    }
    void loadProjectNumbers(createYear)
  }, [createYear, loadProjectNumbers])

  const handleCreateSubmit = useCallback(async () => {
    const yearValue = createYear ?? activeYear ?? availableYears[0]
    if (!yearValue) {
      message.error("Select a year before creating a project.")
      return
    }

    const values = createForm.getFieldsValue()
    try {
      console.log('[CreateProject] form values', {
        projectNumber: values?.projectNumber,
        projectTitle: values?.projectTitle,
        presenterWorkType: values?.presenterWorkType,
        projectNature: values?.projectNature,
        projectDate: values?.projectDate && (values.projectDate as any).format ? (values.projectDate as any).format('YYYY-MM-DD') : values?.projectDate,
      })
    } catch {}
    try {
      console.log('[CreateProject] form.getFieldsValue keys', Object.keys(values || {}))
      console.log(
        '[CreateProject] form.projectDate',
        values?.projectDate && (values.projectDate as any).format ? (values.projectDate as any).format('YYYY-MM-DD') : values?.projectDate,
      )
    } catch {}
    const trimmedProjectNumber = (values.projectNumber ?? "").replace(/^#/, '').trim()
    if (!trimmedProjectNumber) {
      message.error("Project number is required.")
      return
    }

    const payload: Record<string, unknown> = {
      projectNumber: trimmedProjectNumber,
      projectTitle: sanitizeText(values.projectTitle ?? ""),
      presenterWorkType: sanitizeText(values.presenterWorkType ?? ""),
      projectNature: sanitizeText(values.projectNature ?? ""),
      subsidiary: sanitizeText(values.subsidiary ?? 'Establish Records Limited'),
    }

    // Optional: Project Pickup Date → ISO UTC midnight
    try {
      const dayVal = values.projectDate
      if (dayVal && typeof dayVal?.format === "function") {
        const ymd = dayVal.format("YYYY-MM-DD") as string
        const iso = toIsoUtcStringOrNull(ymd)
        payload.projectDate = iso
      } else if (typeof dayVal === "string") {
        const iso = toIsoUtcStringOrNull(dayVal)
        payload.projectDate = iso
      }
    } catch {
      // ignore invalid date; let backend treat as null
    }

    console.log('[CreateProject] payload keys', Object.keys(payload))
    if ('projectDate' in payload) {
      console.log('[CreateProject] projectDate', payload.projectDate)
    }
    setCreateSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(yearValue)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ project: payload }),
      })
      console.log('[CreateProject] response', response.status)

      const raw = await response.json().catch(() => ({}))
      const body = raw as { error?: string; project?: ProjectRecord }
      if (!response.ok) {
        const description = typeof body?.error === "string" ? body.error : "Failed to create project"
        throw new Error(description)
      }

      message.success("Project created")
      setCreateModalOpen(false)
      const created = body.project
      if (created?.id) {
        // Navigate straight to the new project details
        void router.push(`/projects/${encodeURIComponent(created.id)}`)
      } else {
        setCreateYear(undefined)
        createForm.resetFields()
        if (yearValue !== activeYear) {
          handleYearChange(yearValue)
        }
        await (tableQuery as unknown as { refetch?: () => Promise<unknown> })?.refetch?.()
        // Invalidate React Query cache for cross-component updates
        queryClient.invalidateQueries({ queryKey: ["projects"] })
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : "Failed to create project"
      message.error(description)
    } finally {
      setCreateSubmitting(false)
    }
  }, [
    activeYear,
    availableYears,
    createForm,
    createYear,
    handleYearChange,
    message,
    queryClient,
    tableQuery,
  ])

  const columns = useMemo(() => {
    return [
      {
        key: "projectNumber",
        title: <span style={tableHeadingStyle}>Project No.</span>,
        dataIndex: "projectNumber",
        sorter: true,
        render: (_: string, record: ProjectRow) => {
          const pickupDate = simpleDescriptorText(record.projectDateDisplay)
          const hasPickupDate = pickupDate !== "-"
          const numberText = record.projectNumber ? `#${record.projectNumber}` : "-"
          const numberContent = (
            <span style={primaryRowTextStyle}>{numberText}</span>
          )
          if (!hasPickupDate) {
            return numberContent
          }
          return (
            <Tooltip title={pickupDate} placement="top">
              <span style={{ display: "inline-flex" }}>{numberContent}</span>
            </Tooltip>
          )
        },
      },
      {
        key: "project",
        title: <span style={tableHeadingStyle}>Project</span>,
        dataIndex: "projectTitle",
        sorter: true,
        render: (_: string | null, record: ProjectRow & { workStatus?: WorkStatus; _invoiceSummary?: { label: string } }) => {
          // Override workStatus to 'completed' if all invoices are cleared
          const paymentLabel = record._invoiceSummary?.label
          const workStatus: WorkStatus = paymentLabel === 'All Cleared' ? 'completed' : (record.workStatus || 'active')
          const barColor = WORK_STATUS_COLORS[workStatus]

          return (
            <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
              {/* Colored bar - clickable to change status */}
              <Tooltip
                open={statusDropdownOpenId === record.id}
                onOpenChange={(open: boolean) => {
                  if (!open && statusDropdownOpenId === record.id) {
                    // Mark that dropdown was just closed to prevent navigation
                    statusDropdownJustClosedRef.current = true
                    // Reset the flag after a short delay
                    setTimeout(() => { statusDropdownJustClosedRef.current = false }, 100)
                  }
                  setStatusDropdownOpenId(open ? record.id : null)
                }}
                trigger="click"
                placement="right"
                overlayInnerStyle={{ padding: 0, backgroundColor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                overlayStyle={{ maxWidth: 'none' }}
                color="white"
                destroyTooltipOnHide
                overlay={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, backgroundColor: 'white' }}>
                    {(['active', 'completed', 'on_hold', 'cancelled'] as WorkStatus[]).map((status) => (
                      <Tooltip
                        key={status}
                        title={`${WORK_STATUS_LABELS[status]}: ${WORK_STATUS_DESCRIPTIONS[status]}`}
                        placement="right"
                      >
                        <div
                          onClick={async (e) => {
                            e.stopPropagation()
                            setStatusDropdownOpenId(null)  // Close dropdown immediately
                            try {
                              const res = await fetch(`/api/projects/${encodeURIComponent(record.year)}/${encodeURIComponent(record.id)}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ updates: { workStatus: status } }),
                              })
                              if (!res.ok) throw new Error('Failed to update status')
                              // Refresh by triggering a filter change (forces re-fetch)
                              setFilters((prev: CrudFilters) => [...(prev || [])])
                              // Invalidate React Query cache for cross-component updates
                              queryClient.invalidateQueries({ queryKey: ["projects"] })
                              message.success('Status updated')
                            } catch (err) {
                              message.error(err instanceof Error ? err.message : 'Failed to update status')
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 8px',
                            cursor: 'pointer',
                            borderRadius: 4,
                            backgroundColor: workStatus === status ? '#f0f0f0' : 'transparent',
                          }}
                        >
                          <div
                            style={{
                              width: 4,
                              height: 20,
                              borderRadius: 2,
                              backgroundColor: WORK_STATUS_COLORS[status],
                              border: workStatus === status ? '1px solid #1890ff' : 'none',
                            }}
                          />
                          <span style={{ fontSize: 12, color: '#374151' }}>{WORK_STATUS_LABELS[status]}</span>
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                }
              >
                {/* Wrapper with larger clickable area */}
                <div
                  className="work-status-bar-wrapper"
                  onClick={(e) => e.stopPropagation()}
                  title={`${WORK_STATUS_LABELS[workStatus]} (click to change)`}
                  style={{ alignSelf: 'stretch', marginRight: 6 }}
                >
                  {/* Visible bar - expands on hover */}
                  <div
                    className="work-status-bar-inner"
                    style={{ backgroundColor: barColor }}
                  />
                </div>
              </Tooltip>
              {/* Text column - all text aligns vertically */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={captionRowTextStyle}>{stringOrNA(record.presenterWorkType)}</span>
                <span style={{ ...primaryRowTextStyle, lineHeight: 1.2 }}>{stringOrNA(record.projectTitle)}</span>
                <span style={italicDescriptorStyle}>{stringOrNA(record.projectNature)}</span>
              </div>
            </div>
          )
        },
      },
      {
        key: "amount",
        title: <span style={tableHeadingStyle}>Amount</span>,
        dataIndex: "amount",
        sorter: true,
        align: "right" as const,
        render: (value: number | null) => (
          <span style={{ ...primaryRowTextStyle, fontVariantNumeric: "tabular-nums" }}>{amountText(value)}</span>
        ),
      },
      {
        key: "paymentStatus",
        title: <span style={tableHeadingStyle}>Payment Status</span>,
        dataIndex: "_invoiceSummary",
        sorter: false,
        render: (_: unknown, record: ProjectRow & { _invoiceSummary?: { label: string; lastPaidOnDisplay?: string | null } }) => {
          const label = record._invoiceSummary?.label ?? (record.paid ? "All Cleared" : "On Hold")
          const lastPaid = record._invoiceSummary?.lastPaidOnDisplay ?? null

          // Map label to color key
          const chipKey =
            label === 'All Cleared' ? 'green' :
            label === 'Due' ? 'red' :
            label === 'Partially Cleared' ? 'orange' :
            label === 'Pending' ? 'amber' :
            label === 'On Hold' ? 'gray' :
            'default'

          const isPending = label === 'Pending'
          const palette = paymentTagStyles[chipKey] ?? paymentTagStyles.default
          const tag = (
            <Tag
              color={palette.backgroundColor}
              style={{
                ...tableCellStyle,
                color: palette.color,
                borderRadius: 999,
                border: 'none',
                padding: '2px 12px',
                fontSize: 13,
                fontStyle: isPending ? 'italic' : 'normal',
                animation: isPending ? 'pending-blink 1.2s ease-in-out infinite' : 'none',
              }}
            >
              {label}
            </Tag>
          )
          return lastPaid ? (
            <Tooltip title={lastPaid} placement="top">
              <span style={{ display: 'inline-flex' }}>{tag}</span>
            </Tooltip>
          ) : (
            tag
          )
        },
      },
      {
        key: "clientCompany",
        title: <span style={tableHeadingStyle}>Client Company</span>,
        dataIndex: "clientCompany",
        sorter: true,
        render: (_: string | null, record: ProjectRow) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {record.subsidiary ? (
              <Tooltip title={subsidiaryMap[record.subsidiary]?.chineseName} placement="top">
                <Tag style={subsidiaryTagStyle}>{stringOrNA(subsidiaryMap[record.subsidiary]?.englishName ?? (record.subsidiary ? 'Loading...' : '-'))}</Tag>
              </Tooltip>
            ) : null}
            <span style={primaryRowTextStyle}>{stringOrNA(record.clientCompany)}</span>
          </div>
        ),
      },
      {
        key: "actions",
        title: <span style={tableHeadingStyle}>Actions</span>,
        dataIndex: "actions",
        align: "center" as const,
        render: (_: unknown, record: ProjectRow & { _invoiceSummary?: { total?: number } }) => {
          const invoiceCount = record._invoiceSummary?.total ?? 0
          const deleteDisabled = invoiceCount > 0
          const deleteBtn = (
            <Button
              type="text"
              aria-label="Delete project"
              icon={<DeleteOutlined style={{ color: deleteDisabled ? '#9ca3af' : '#dc2626' }} />}
              disabled={deleteDisabled}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation()
                Modal.confirm({
                  title: 'Delete this project?',
                  content: `#${record.projectNumber} — this action cannot be undone`,
                  okType: 'danger',
                  async onOk() {
                    try {
                      const res = await fetch(`/api/projects/${encodeURIComponent(record.year)}/${encodeURIComponent(record.id)}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      })
                      if (!res.ok) throw new Error('Delete failed')
                      message.success('Project deleted')
                      await (tableQuery as unknown as { refetch?: () => Promise<unknown> })?.refetch?.()
                      // Invalidate React Query cache for cross-component updates
                      queryClient.invalidateQueries({ queryKey: ["projects"] })
                    } catch (e) {
                      message.error(e instanceof Error ? e.message : 'Delete failed')
                    }
                  },
                })
              }}
            />
          )
          return (
            <Space>
              <Button
                type="text"
                icon={<EyeOutlined />}
                aria-label="View project details"
                onClick={(event: React.MouseEvent) => {
                  event.stopPropagation()
                  navigateToDetails(record, event)
                }}
              />
              {deleteDisabled ? (
                <Tooltip title="Delete invoice(s) in this project first">
                  <span>{deleteBtn}</span>
                </Tooltip>
              ) : (
                deleteBtn
              )}
            </Space>
          )
        },
      },
    ]
  }, [navigateToDetails, subsidiaryMap])

  const yearOptions = availableYears.map((year) => ({ label: year, value: year }))
  const subsidiaryOptions = availableSubsidiaries.map((value) => ({ label: value, value }))
  const canCreateProject = availableYears.length > 0

  useEffect(() => {
    if (tableQuery?.error) {
      const messageText =
        tableQuery.error instanceof Error ? tableQuery.error.message : "Failed to load projects"
      message.error(messageText)
    }
  }, [message, tableQuery?.error])

  // Build map of subsidiary identifier -> englishName for current rows
  useEffect(() => {
    const run = async () => {
      const rows = (tableQuery?.data?.data || []) as ProjectRow[]
      const uniq = Array.from(new Set(rows.map(r => (r.subsidiary || '').trim()).filter(Boolean)))
      if (uniq.length === 0) return
      const next: Record<string, { englishName: string, chineseName: string }> = { ...subsidiaryMap }
      await Promise.all(uniq.map(async (id) => {
        if (!next[id]) {
          const info = await fetchSubsidiaryById(id).catch(() => null)
          if (info?.englishName) next[id] = { englishName: info.englishName, chineseName: info.chineseName ?? '' }
        }
      }))
      setSubsidiaryMap(next)
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableQuery?.data?.data])

  return (
    <div
      style={{
        padding: screens.md ? "32px 0 32px 24px" : "24px 16px",
        minHeight: "100%",
        background: "#fff",
        fontFamily: KARLA_FONT,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: screens.md ? "center" : "flex-start",
            gap: 16,
          }}
        >
          <Title
            level={2}
            style={{ fontFamily: KARLA_FONT, fontWeight: 700, marginBottom: 8, color: "#0f172a" }}
          >
            Projects
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            disabled={!canCreateProject}
            style={{ fontFamily: KARLA_FONT, fontWeight: 600 }}
          >
            New Project
          </Button>
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
              onChange={(value: string | undefined) => handleYearChange(value ?? undefined)}
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
              onChange={(value: string | undefined) => handleSubsidiaryChange(value ?? undefined)}
              style={{ minWidth: 200 }}
            />
          </Form.Item>
          <Form.Item name="search" label="Search" style={{ marginBottom: 0, flex: 1 }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search by project, client, or invoice"
              onChange={handleSearchChange}
              disabled={!hasActiveSelection}
            />
          </Form.Item>
        </Form>
        {selectionRequired ? (
          <div
            style={{
              minHeight: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f8fafc",
              borderRadius: 16,
            }}
          >
            <Empty description="Select a year to load projects." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <Table<ProjectRow>
            {...tableProps}
            rowKey="id"
            columns={columns}
            pagination={false}
            onRow={(record: ProjectRow) => ({
              onClick: (event: React.MouseEvent) => navigateToDetails(record, event),
              style: { cursor: "pointer" },
            })}
          />
        )}
        {/* All styles consolidated here to avoid nested styled-jsx error */}
        <style jsx global>{`
          .work-status-bar-wrapper {
            display: flex;
            align-items: stretch;
            padding: 0 6px;
            margin-left: -6px;
            cursor: pointer;
          }
          .work-status-bar-wrapper:hover .work-status-bar-inner {
            width: 6px !important;
            opacity: 0.85;
          }
          .work-status-bar-inner {
            width: 4px;
            border-radius: 2px;
            transition: width 0.15s ease, opacity 0.15s ease;
            min-height: 60px;
            flex-shrink: 0;
            opacity: 1;
          }
          @keyframes soft-blink {
            0% { opacity: 1; }
            50% { opacity: 0.45; }
            100% { opacity: 1; }
          }
          @keyframes pending-blink {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          .spinner {
            width: 14px;
            height: 14px;
            border-radius: 9999px;
            border: 2px solid #cbd5e1;
            border-top-color: #94a3b8;
            display: inline-block;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
        <Modal
          title="Create Project"
          open={createModalOpen}
          destroyOnClose
          onCancel={handleCreateCancel}
          onOk={handleCreateSubmit}
          okText="Create Project"
          okButtonProps={{ disabled: !createYear || createNumbersLoading }}
          confirmLoading={createSubmitting}
        >
          {/* Hidden field to back the inline editing of project number */}
          <Form
            form={createForm}
            layout="vertical"
            initialValues={{
              projectNumber: "",
              projectTitle: "",
              presenterWorkType: "",
              projectNature: "",
              projectDate: undefined,
            }}
          >
            {/* Visible inline editable Project Number (no label) */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              {editingProjectNumber ? (
                <Input
                  autoFocus
                  variant="borderless"
                  size="large"
                  style={{ fontWeight: 700, fontSize: 20, padding: 0 }}
                  defaultValue={createForm.getFieldValue("projectNumber")}
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                    const v = (e.target.value ?? "").trim()
                    createForm.setFieldsValue({ projectNumber: v })
                    setEditingProjectNumber(false)
                  }}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      const target = e.target as HTMLInputElement
                      const v = (target.value ?? "").trim()
                      createForm.setFieldsValue({ projectNumber: v })
                      setEditingProjectNumber(false)
                    }
                  }}
                />
              ) : (
                (
                  () => {
                    const numberVal = createForm.getFieldValue("projectNumber")
                    if (!numberVal) {
                      return (
                        <span
                          aria-label="loading project number"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#94a3b8' }}
                        >
                          <span className="spinner" />
                          Generating…
                        </span>
                      )
                    }
                    return (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditingProjectNumber(true)}
                        style={{
                          fontWeight: 700,
                          fontSize: 20,
                          fontFamily: KARLA_FONT,
                          cursor: "pointer",
                          fontStyle: createFormTouched ? 'normal' : 'italic',
                          color: createFormTouched ? '#0f172a' : '#64748b',
                          animation: createFormTouched ? 'none' : 'soft-blink 1.2s ease-in-out infinite',
                        }}
                        title="Click to edit project number"
                      >
                        {numberVal}
                      </span>
                    )
                  }
                )()
              )}
            </div>
            {/* keep the value in form without visible label */}
            <Form.Item name="projectNumber" style={{ display: "none" }}>
              <Input />
            </Form.Item>
            <Form.Item label="Project Title" name="projectTitle">
              <Input allowClear placeholder="Project title" onChange={() => setCreateFormTouched(true)} />
            </Form.Item>
            <Form.Item label="Presenter/ Work Type" name="presenterWorkType">
              <Input allowClear placeholder="Presenter work type" onChange={() => setCreateFormTouched(true)} />
            </Form.Item>
            <Form.Item label="Project Nature" name="projectNature">
              <Input allowClear placeholder="Project nature" onChange={() => setCreateFormTouched(true)} />
            </Form.Item>
            {/* Pickup date (projectDate) */}
            <Form.Item label="Project Pickup Date" name="projectDate">
              <DatePicker style={{ width: '100%' }} onChange={(v: unknown) => {
                try {
                  console.log('[CreateProject] date change', v && (v as any).format ? (v as any).format('YYYY-MM-DD') : v)
                } catch {}
                setCreateFormTouched(true)
              }} />
            </Form.Item>
            <Form.Item label="Subsidiary" name="subsidiary" initialValue="Establish Records Limited">
              <Input allowClear placeholder="Subsidiary" onChange={() => setCreateFormTouched(true)} />
            </Form.Item>
            {/* Client Company moved to invoice scope; removed from project create */}
          </Form>
        </Modal>
      </div>
    </div>
  )
}

const ProjectsApp = () => (
  <AppShell
    dataProvider={refineDataProvider}
    resources={NAVIGATION_RESOURCES}
    allowedMenuKeys={ALLOWED_MENU_KEYS}
  >
    <ProjectsContent />
  </AppShell>
)

export default ProjectsApp
