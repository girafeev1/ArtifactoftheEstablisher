import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { useRouter } from "next/router"
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd"
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons"

import type { ClientDirectoryRecord } from "../../lib/clientDirectory"
import type { ProjectRecord } from "../../lib/projectsDatabase"
import type { ProjectInvoiceRecord } from "../../lib/projectInvoices"
import dayjs, { type Dayjs } from "dayjs"
import { resolveBankAccountIdentifier } from "../../lib/erlDirectory"

import AppShell from "../new-ui/AppShell"
import {
  amountText,
  mergeLineWithRegion,
  normalizeClient,
  normalizeCompanyKey,
  normalizeProject,
  paymentChipLabel,
  stringOrNA,
  type NormalizedClient,
  type NormalizedProject,
} from "./projectUtils"
import { projectsDataProvider } from "./NewUIProjectsApp"

const { Title, Text } = Typography

const KARLA_FONT = "'Karla', sans-serif"
const STATUS_STEPS = ["Project Saved", "Invoice Drafted", "Payment Received"] as const
const paymentPalette = {
  green: { backgroundColor: "#dcfce7", color: "#166534" },
  red: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  default: { backgroundColor: "#e2e8f0", color: "#1f2937" },
} as const

const INVOICE_STATUS_OPTIONS = [
  { label: "Draft", value: "Draft" },
  { label: "Due", value: "Due" },
  { label: "Cleared", value: "Cleared" },
] as const

const ANT_INVOICE_STATUS_OPTIONS = INVOICE_STATUS_OPTIONS.map((option) => ({
  label: option.label,
  value: option.value,
}))

const statusToColorKey = (status: string | null | undefined): keyof typeof paymentPalette => {
  if (!status) {
    return "default"
  }
  const normalized = status.trim().toLowerCase()
  if (normalized === "cleared" || normalized === "paid" || normalized === "received") {
    return "green"
  }
  if (
    normalized === "due" ||
    normalized === "draft" ||
    normalized === "pending" ||
    normalized === "outstanding"
  ) {
    return "red"
  }
  return "default"
}

const invoiceCollectionPattern = /^invoice-([a-z]+)$/
const LEGACY_INVOICE_COLLECTION_IDS = new Set(["Invoice", "invoice"])
const alphabet = "abcdefghijklmnopqrstuvwxyz"

type ProjectShowResponse = {
  data?: ProjectRecord
  client?: ClientDirectoryRecord | null
  clients?: ClientDirectoryRecord[]
  invoices?: ProjectInvoiceRecord[]
}

type InvoiceDraftItem = {
  key: string
  title: string
  feeType: string
  unitPrice: number
  quantity: number
  discount: number
}

type InvoiceClientState = {
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  region: string | null
  representative: string | null
}

type InvoiceDraftState = {
  invoiceNumber: string
  baseInvoiceNumber: string
  collectionId?: string
  originalInvoiceNumber?: string
  client: InvoiceClientState
  items: InvoiceDraftItem[]
  taxOrDiscountPercent: number
  paymentStatus: string | null
  paidTo?: string | null
  paidOnIso?: string | null
}

type ProjectDraftState = {
  presenterWorkType: string
  projectTitle: string
  projectNature: string
  projectNumber: string
  projectDateIso: string | null
  subsidiary: string
}

type InvoiceTableRow = {
  key: string
  kind: "item" | "adder"
  title?: string
  feeType?: string
  unitPrice?: number
  quantity?: number
  discount?: number
}

type ClientDirectoryMap = Record<string, NormalizedClient>

const toNumberValue = (value: number | null | undefined) =>
  typeof value === "number" && !Number.isNaN(value) ? value : 0

const formatProjectDate = (
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
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    })
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
    return projectNumber
  }
  const parsed = new Date(projectDateIso)
  if (Number.isNaN(parsed.getTime())) {
    return projectNumber
  }
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0")
  const day = `${parsed.getDate()}`.padStart(2, "0")
  return `${projectNumber}-${month}${day}`
}

const lettersToIndex = (letters: string) => {
  if (!letters) {
    return 0
  }
  let result = 0
  for (const char of letters) {
    const offset = alphabet.indexOf(char)
    if (offset === -1) {
      return 0
    }
    result = result * 26 + (offset + 1)
  }
  return Math.max(result - 1, 0)
}

const addClientToDirectoryMap = (
  map: ClientDirectoryMap,
  client: NormalizedClient | null,
  ...identifiers: (string | null | undefined)[]
) => {
  if (!client) {
    return
  }
  const keys = identifiers
    .concat(client.companyName)
    .map((identifier) => normalizeCompanyKey(identifier))
    .filter((key): key is string => Boolean(key))

  keys.forEach((key) => {
    if (!map[key]) {
      map[key] = client
    }
  })
}

const buildClientDirectoryMap = (records: ClientDirectoryRecord[]): ClientDirectoryMap => {
  const map: ClientDirectoryMap = {}
  records.forEach((record) => {
    const normalized = normalizeClient(record)
    addClientToDirectoryMap(map, normalized, record.companyName, record.documentId)
  })
  return map
}

const lookupClientFromDirectory = (
  map: ClientDirectoryMap,
  ...identifiers: (string | null | undefined)[]
): NormalizedClient | null => {
  for (const identifier of identifiers) {
    const key = normalizeCompanyKey(identifier)
    if (key && map[key]) {
      return map[key]
    }
  }
  return null
}

const indexToLetters = (index: number) => {
  if (index < 0) {
    return "a"
  }
  let value = index + 1
  let result = ""
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = alphabet[remainder] + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

const indexToSuffix = (index: number) => {
  if (index <= 0) {
    return ""
  }
  return indexToLetters(index)
}

const determineNextInvoiceIdentifiers = (
  existing: ProjectInvoiceRecord[],
  baseInvoiceNumber: string,
) => {
  const usedIndexes = new Set<number>()
  existing.forEach((invoice) => {
    if (LEGACY_INVOICE_COLLECTION_IDS.has(invoice.collectionId)) {
      usedIndexes.add(0)
      return
    }
    const match = invoice.collectionId.match(invoiceCollectionPattern)
    if (!match) {
      return
    }
    usedIndexes.add(lettersToIndex(match[1]))
  })

  let candidate = 0
  while (usedIndexes.has(candidate)) {
    candidate += 1
  }

  const suffix = indexToSuffix(candidate)
  const invoiceNumber = suffix ? `${baseInvoiceNumber}-${suffix}` : baseInvoiceNumber

  return { invoiceNumber, index: candidate }
}

const extractBaseInvoiceNumber = (invoiceNumber: string) => {
  const suffixMatch = invoiceNumber.match(/-([a-z]+)$/)
  if (!suffixMatch) {
    return invoiceNumber
  }
  return invoiceNumber.slice(0, Math.max(0, invoiceNumber.length - suffixMatch[1].length - 1))
}

const buildClientState = (
  invoice: ProjectInvoiceRecord | null,
  normalizedClient: NormalizedClient | null,
  project: NormalizedProject | null,
  directoryMap: ClientDirectoryMap,
): InvoiceClientState => {
  const directoryClient =
    lookupClientFromDirectory(
      directoryMap,
      invoice?.companyName,
      normalizedClient?.companyName,
      project?.clientCompany,
    ) ?? null

  const companyName =
    invoice?.companyName ??
    directoryClient?.companyName ??
    normalizedClient?.companyName ??
    project?.clientCompany ??
    null

  return {
    companyName,
    addressLine1:
      directoryClient?.addressLine1 ??
      invoice?.addressLine1 ??
      normalizedClient?.addressLine1 ??
      null,
    addressLine2:
      directoryClient?.addressLine2 ??
      invoice?.addressLine2 ??
      normalizedClient?.addressLine2 ??
      null,
    addressLine3:
      directoryClient?.addressLine3 ??
      invoice?.addressLine3 ??
      normalizedClient?.addressLine3 ??
      null,
    region:
      directoryClient?.region ??
      invoice?.region ??
      normalizedClient?.region ??
      null,
    representative:
      directoryClient?.representative ??
      invoice?.representative ??
      normalizedClient?.representative ??
      null,
  }
}

const buildDraftFromInvoice = (
  invoice: ProjectInvoiceRecord,
  normalizedClient: NormalizedClient | null,
  project: NormalizedProject | null,
  directoryMap: ClientDirectoryMap,
): InvoiceDraftState => ({
  invoiceNumber: invoice.invoiceNumber,
  baseInvoiceNumber: invoice.baseInvoiceNumber ?? extractBaseInvoiceNumber(invoice.invoiceNumber),
  collectionId: invoice.collectionId,
  originalInvoiceNumber: invoice.invoiceNumber,
  client: buildClientState(invoice, normalizedClient, project, directoryMap),
  items: (invoice.items ?? []).map((item, index) => ({
    key: `item-${index + 1}`,
    title: item.title ?? "",
    feeType: item.feeType ?? "",
    unitPrice: toNumberValue(item.unitPrice),
    quantity: toNumberValue(item.quantity),
    discount: toNumberValue(item.discount),
  })),
  taxOrDiscountPercent: toNumberValue(invoice.taxOrDiscountPercent),
  paymentStatus:
    invoice.paymentStatus ??
    (invoice.paid === true ? "Cleared" : invoice.paid === false ? "Due" : "Draft"),
  paidTo: invoice.paidTo ?? null,
  paidOnIso: invoice.paidOnIso ?? null,
})

const buildDraftForNewInvoice = (
  invoices: ProjectInvoiceRecord[],
  project: NormalizedProject | null,
  normalizedClient: NormalizedClient | null,
  directoryMap: ClientDirectoryMap,
): InvoiceDraftState => {
  const baseCandidate =
    generateInvoiceFallback(project?.projectNumber ?? null, project?.projectDateIso ?? null) ??
    project?.projectNumber ??
    project?.id ??
    "Invoice"
  const { invoiceNumber } = determineNextInvoiceIdentifiers(invoices, baseCandidate)
  return {
    invoiceNumber,
    baseInvoiceNumber: baseCandidate,
    originalInvoiceNumber: undefined,
    client: buildClientState(null, normalizedClient, project, directoryMap),
    items: [],
    taxOrDiscountPercent: 0,
    paymentStatus: "Draft",
    paidTo: null,
    paidOnIso: null,
  }
}

const computeLineTotal = (item: { unitPrice: number; quantity: number; discount: number }) => {
  const total = item.unitPrice * item.quantity - item.discount
  return total > 0 ? total : 0
}

const computeSubtotal = (items: InvoiceDraftItem[]) =>
  items.reduce((sum, item) => sum + computeLineTotal(item), 0)

const computeTotals = (subtotal: number, percent: number) => {
  if (!percent) {
    return { subtotal, taxAmount: 0, total: subtotal }
  }
  const taxAmount = subtotal * (percent / 100)
  return { subtotal, taxAmount, total: subtotal + taxAmount }
}

const formatPercentText = (percent: number) => {
  const safe = Number(percent) || 0
  return `${safe.toFixed(2).replace(/\.00$/, "")}\u0025`
}

const toNullableString = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
const ProjectsShowContent = () => {
  const router = useRouter()
  const { message } = AntdApp.useApp()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<NormalizedProject | null>(null)
  const [client, setClient] = useState<NormalizedClient | null>(null)
  const [clientDirectoryMap, setClientDirectoryMap] = useState<ClientDirectoryMap>({})
  const [invoices, setInvoices] = useState<ProjectInvoiceRecord[]>([])
  const [activeInvoiceIndex, setActiveInvoiceIndex] = useState(0)
  const [invoiceMode, setInvoiceMode] = useState<"idle" | "create" | "edit">("idle")
  const [draftInvoice, setDraftInvoice] = useState<InvoiceDraftState | null>(null)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [projectEditMode, setProjectEditMode] = useState<"view" | "edit" | "saving">("view")
  const [projectDraft, setProjectDraft] = useState<ProjectDraftState>({
    presenterWorkType: "",
    projectTitle: "",
    projectNature: "",
    projectNumber: "",
    projectDateIso: null,
    subsidiary: "",
  })
  const [invoiceNumberEditing, setInvoiceNumberEditing] = useState(false)
  const [bankInfoMap, setBankInfoMap] = useState<
    Record<string, { bankName: string; bankCode?: string; accountType?: string | null }>
  >({})
  const itemIdRef = useRef(0)

  const projectId = useMemo(() => {
    const raw = router.query.projectId
    if (Array.isArray(raw)) {
      return raw[0]
    }
    return raw
  }, [router.query.projectId])

  const loadProject = useCallback(
    async (signal?: AbortSignal) => {
      if (typeof projectId !== "string" || projectId.trim().length === 0) {
        return
      }

      try {
        setLoading(true)
        const response = await fetch(`/api/projects/by-id/${encodeURIComponent(projectId)}`, {
          credentials: "include",
          signal,
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

        const normalizedProject = normalizeProject(payload.data)
        const normalizedClient = payload.client ? normalizeClient(payload.client) : null
        const directoryRecords = Array.isArray(payload.clients) ? payload.clients : []
        const directoryMap = buildClientDirectoryMap(directoryRecords)

        if (payload.client) {
          addClientToDirectoryMap(
            directoryMap,
            normalizedClient,
            payload.client.companyName,
            payload.client.documentId,
          )
        }

        addClientToDirectoryMap(directoryMap, normalizedClient, normalizedProject.clientCompany)

        const invoiceRecords = Array.isArray(payload.invoices) ? payload.invoices : []

        invoiceRecords.forEach((record) => {
          if (record.companyName) {
            const existing = lookupClientFromDirectory(directoryMap, record.companyName)
            if (!existing && normalizedClient) {
              addClientToDirectoryMap(directoryMap, normalizedClient, record.companyName)
            }
          }
        })

        setClientDirectoryMap(directoryMap)

        const resolvedClientRecord =
          lookupClientFromDirectory(
            directoryMap,
            normalizedProject.clientCompany,
            normalizedClient?.companyName,
          ) ?? normalizedClient

        setProject(normalizedProject)
        setProjectEditMode("view")
        setClient(resolvedClientRecord)
        setInvoices(invoiceRecords)
        setInvoiceNumberEditing(false)

        if (invoiceRecords.length > 0) {
          setActiveInvoiceIndex(0)
          setInvoiceMode("idle")
          setDraftInvoice(null)
        } else {
          const draft = buildDraftForNewInvoice(
            invoiceRecords,
            normalizedProject,
            resolvedClientRecord,
            directoryMap,
          )
          itemIdRef.current = draft.items.length
          setDraftInvoice(draft)
          setInvoiceMode("create")
          setActiveInvoiceIndex(0)
        }
      } catch (error) {
        if (signal?.aborted) {
          return
        }
        const description =
          error instanceof Error ? error.message : "Unable to retrieve project details"
        message.error(description)
        setProject(null)
        setClient(null)
        setClientDirectoryMap({})
        setInvoices([])
        setDraftInvoice(null)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [message, projectId],
  )

  useEffect(() => {
    if (!router.isReady) {
      return
    }
    const controller = new AbortController()
    void loadProject(controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadProject, router.isReady])

  // Resolve bank identifiers (paidTo) into bank name/account type for display
  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      const ids = new Set<string>()
      invoices.forEach((inv) => {
        if (typeof inv.paidTo === "string" && inv.paidTo.trim().length > 0) {
          ids.add(inv.paidTo.trim())
        }
      })
      if (draftInvoice?.paidTo && draftInvoice.paidTo.trim().length > 0) {
        ids.add(draftInvoice.paidTo.trim())
      }
      const missing = Array.from(ids).filter((id) => !bankInfoMap[id])
      if (missing.length === 0) return
      const results = await Promise.all(
        missing.map(async (id) => {
          try {
            const info = await resolveBankAccountIdentifier(id)
            return { id, info }
          } catch {
            return { id, info: null }
          }
        }),
      )
      if (controller.signal.aborted) return
      const updates: Record<string, { bankName: string; bankCode?: string; accountType?: string | null }> = {}
      results.forEach(({ id, info }) => {
        if (info) {
          updates[id] = {
            bankName: info.bankName,
            bankCode: info.bankCode,
            accountType: info.accountType ?? null,
          }
        }
      })
      if (Object.keys(updates).length > 0) {
        setBankInfoMap((prev) => ({ ...prev, ...updates }))
      }
    }
    void run()
    return () => controller.abort()
  }, [bankInfoMap, invoices, draftInvoice?.paidTo])

  useEffect(() => {
    if (!project || projectEditMode !== "view") {
      return
    }
    setProjectDraft({
      presenterWorkType: project.presenterWorkType ?? "",
      projectTitle: project.projectTitle ?? "",
      projectNature: project.projectNature ?? "",
      projectNumber: project.projectNumber ?? "",
      projectDateIso: project.projectDateIso ?? null,
      subsidiary: project.subsidiary ?? "",
    })
  }, [project, projectEditMode])

  const hasInvoices = invoices.length > 0
  const { totalValue: aggregatedInvoiceTotal, hasAmount: hasAggregatedInvoiceAmount } =
    useMemo(() => {
      let totalValue = 0
      let hasAmount = false
      invoices.forEach((entry) => {
        if (typeof entry.total === "number" && !Number.isNaN(entry.total)) {
          totalValue += entry.total
          hasAmount = true
        } else if (typeof entry.amount === "number" && !Number.isNaN(entry.amount)) {
          totalValue += entry.amount
          hasAmount = true
        }
      })
      return { totalValue, hasAmount }
    }, [invoices])

  useEffect(() => {
    if (invoiceMode === "create") {
      setInvoiceNumberEditing(true)
    }
    if (invoiceMode === "idle") {
      setInvoiceNumberEditing(false)
    }
  }, [invoiceMode])

  const handleBack = useCallback(() => {
    void router.push("/dashboard/new-ui/projects")
  }, [router])

  const isEditingInvoice = invoiceMode !== "idle"

  const currentInvoiceRecord =
    invoiceMode === "idle" && invoices.length > 0
      ? invoices[Math.min(activeInvoiceIndex, invoices.length - 1)] ?? null
      : null

  const resolvedDraft = isEditingInvoice
    ? draftInvoice
    : currentInvoiceRecord
    ? buildDraftFromInvoice(currentInvoiceRecord, client, project, clientDirectoryMap)
    : draftInvoice

  const resolvedClient = resolvedDraft
    ? resolvedDraft.client
    : buildClientState(currentInvoiceRecord, client, project, clientDirectoryMap)

  const activeItems = resolvedDraft?.items ?? []
  const subtotal = computeSubtotal(activeItems)
  const taxPercent = resolvedDraft?.taxOrDiscountPercent ?? 0
  const { taxAmount, total } = computeTotals(subtotal, taxPercent)

  const { clearedCount, totalInvoiceCount, outstandingCount, lastPaidIso, lastPaidDisplay } =
    useMemo(() => {
      let cleared = 0
      let latestIso: string | null = null
      let latestDisplay: string | null = null
      let latestIsoTime = Number.NEGATIVE_INFINITY

      invoices.forEach((invoice) => {
        if (invoice.paid === true) {
          cleared += 1
          if (invoice.paidOnIso) {
            const parsed = new Date(invoice.paidOnIso)
            const timestamp = parsed.getTime()
            if (!Number.isNaN(timestamp) && timestamp >= latestIsoTime) {
              latestIso = invoice.paidOnIso
              latestIsoTime = timestamp
              latestDisplay = invoice.paidOnDisplay ?? invoice.paidOnIso
            } else if (latestIso === null && invoice.paidOnDisplay) {
              latestDisplay = invoice.paidOnDisplay
            }
          } else if (latestIso === null && invoice.paidOnDisplay) {
            latestDisplay = invoice.paidOnDisplay
          }
        }
      })

      return {
        clearedCount: cleared,
        totalInvoiceCount: invoices.length,
        outstandingCount: Math.max(invoices.length - cleared, 0),
        lastPaidIso: latestIso,
        lastPaidDisplay: latestDisplay,
      }
    }, [invoices])

  const projectPaidState = useMemo(() => {
    if (totalInvoiceCount > 0) {
      return outstandingCount === 0
    }
    return project?.paid ?? null
  }, [outstandingCount, project?.paid, totalInvoiceCount])

  const paymentStatusIndex = useMemo(() => {
    let index = 0
    if (hasInvoices) {
      index = 1
    }
    if (projectPaidState === true) {
      index = 2
    }
    return index
  }, [hasInvoices, projectPaidState])

  const baseInvoiceNumber = useMemo(() => {
    if (draftInvoice?.baseInvoiceNumber) {
      return draftInvoice.baseInvoiceNumber
    }
    if (project) {
      return (
        generateInvoiceFallback(project.projectNumber, project.projectDateIso) ??
        project.projectNumber ??
        project.id
      )
    }
    return ""
  }, [draftInvoice?.baseInvoiceNumber, project])

  const projectTotalValue = hasAggregatedInvoiceAmount ? aggregatedInvoiceTotal : total

  const totalStatusLabel = useMemo(() => {
    if (totalInvoiceCount === 0) {
      return "-"
    }
    if (outstandingCount === 0) {
      return "Cleared"
    }
    return `${outstandingCount}/${totalInvoiceCount} Due`
  }, [outstandingCount, totalInvoiceCount])

  const totalPaidOnText = useMemo(() => {
    if (clearedCount === 0) {
      return "-"
    }
    return formatProjectDate(lastPaidIso, lastPaidDisplay)
  }, [clearedCount, lastPaidDisplay, lastPaidIso])

  const invoiceEntries = useMemo(() => {
    const entries = invoices.map((invoice, index) => {
      const rawAmount =
        typeof invoice.total === "number" && !Number.isNaN(invoice.total)
          ? invoice.total
          : typeof invoice.amount === "number" && !Number.isNaN(invoice.amount)
          ? invoice.amount
          : null
      const paidOnFormatted = formatProjectDate(
        invoice.paidOnIso ?? null,
        invoice.paidOnDisplay ?? null,
      )

      const isActiveRow = invoiceMode !== "idle" && index === activeInvoiceIndex
      const draftStatus = draftInvoice?.paymentStatus ?? null
      const derivedStatus =
        isActiveRow && draftInvoice
          ? draftStatus ?? (draftInvoice.invoiceNumber ? "Draft" : null)
          : invoice.paymentStatus ?? paymentChipLabel(invoice.paid)
      const statusColor = statusToColorKey(derivedStatus)

      let amountValue = rawAmount
      if (isActiveRow && draftInvoice) {
        amountValue = total
      }

      const paidFromStatus =
        derivedStatus && statusToColorKey(derivedStatus) === "green"
          ? true
          : derivedStatus && statusToColorKey(derivedStatus) === "red"
          ? false
          : typeof invoice.paid === "boolean"
          ? invoice.paid
          : null

      const paidOnText =
        isActiveRow && draftInvoice && draftInvoice.paymentStatus === "Cleared"
          ? totalPaidOnText !== "-" ? totalPaidOnText : null
          : paidOnFormatted !== "-" ? paidOnFormatted : null

      const paidToIdentifier = invoice.paidTo && invoice.paidTo.trim().length > 0 ? invoice.paidTo.trim() : null
      const payToInfo = paidToIdentifier ? bankInfoMap[paidToIdentifier] ?? null : null

      return {
        invoiceNumber: isActiveRow && draftInvoice ? draftInvoice.invoiceNumber : invoice.invoiceNumber,
        pending: false,
        amount: amountValue,
        paid: paidFromStatus,
        statusLabel: derivedStatus ?? paymentChipLabel(paidFromStatus),
        statusColor,
        paidOnText,
        payToText: paidToIdentifier,
        payToInfo,
        collectionId: invoice.collectionId,
        index,
      }
    })

    if (invoiceMode === "create" && draftInvoice) {
      const pendingIdentifier =
        draftInvoice.paidTo && draftInvoice.paidTo.trim().length > 0
          ? draftInvoice.paidTo.trim()
          : null
      entries.push({
        invoiceNumber: draftInvoice.invoiceNumber,
        pending: true,
        amount: total,
        paid: null,
        statusLabel: draftInvoice.paymentStatus ?? "Draft",
        statusColor: statusToColorKey(draftInvoice.paymentStatus),
        paidOnText: null,
        payToText: pendingIdentifier ?? draftInvoice.client?.companyName ?? null,
        payToInfo: pendingIdentifier ? bankInfoMap[pendingIdentifier] ?? null : null,
        collectionId: draftInvoice.collectionId,
        index: invoices.length,
      })
    }

    return entries
  }, [
    activeInvoiceIndex,
    bankInfoMap,
    draftInvoice,
    invoiceMode,
    invoices,
    total,
    totalPaidOnText,
  ])

  const activeEntryIndex = useMemo(() => {
    if (invoiceEntries.length === 0) {
      return -1
    }
    if (invoiceMode === "create" && draftInvoice) {
      return invoiceEntries.length - 1
    }
    return Math.min(activeInvoiceIndex, invoiceEntries.length - 1)
  }, [activeInvoiceIndex, draftInvoice, invoiceEntries.length, invoiceMode])

  const companyLine3 = mergeLineWithRegion(resolvedClient?.addressLine3, resolvedClient?.region)

  const prepareDraft = useCallback(
    (mode: "create" | "edit", targetIndex?: number) => {
      if (!project) {
        return
      }
      if (mode === "create") {
        const draft = buildDraftForNewInvoice(
          invoices,
          project,
          client,
          clientDirectoryMap,
        )
        itemIdRef.current = draft.items.length
        setDraftInvoice(draft)
        setInvoiceMode("create")
        setActiveInvoiceIndex(invoices.length)
        return
      }
      const index = typeof targetIndex === "number" ? targetIndex : activeInvoiceIndex
      const current = invoices[index]
      if (!current) {
        message.warning("Select an invoice to edit.")
        return
      }
      const draft = buildDraftFromInvoice(current, client, project, clientDirectoryMap)
      itemIdRef.current = draft.items.length
      setDraftInvoice(draft)
      setInvoiceMode("edit")
      setActiveInvoiceIndex(index)
    },
    [activeInvoiceIndex, client, clientDirectoryMap, invoices, message, project],
  )

  const handleSelectInvoice = useCallback(
    (index: number, pending: boolean) => {
      if (pending && invoiceMode === "create") {
        return
      }
      if (invoiceMode !== "idle" && index !== activeInvoiceIndex) {
        message.warning("Finish editing the current invoice before switching.")
        return
      }
      if (invoiceMode !== "idle") {
        return
      }
      setActiveInvoiceIndex(index)
    },
    [activeInvoiceIndex, invoiceMode, message],
  )

  const handleBeginInvoiceRowEdit = useCallback(
    (index: number, pending: boolean) => {
      if (pending) {
        if (invoiceMode === "create") {
          setActiveInvoiceIndex(index)
          setInvoiceNumberEditing(true)
        }
        return
      }

      if (invoiceMode === "create") {
        message.warning("Finish creating the current invoice before editing another.")
        return
      }

      if (invoiceMode !== "idle" && index !== activeInvoiceIndex) {
        message.warning("Finish editing the current invoice before editing another.")
        return
      }

      if (invoiceMode === "edit" && index === activeInvoiceIndex) {
        setInvoiceNumberEditing(true)
        return
      }

      prepareDraft("edit", index)
      setInvoiceNumberEditing(true)
    },
    [activeInvoiceIndex, invoiceMode, message, prepareDraft, setActiveInvoiceIndex, setInvoiceNumberEditing],
  )

  const startProjectEditing = useCallback(() => {
    if (!project) {
      return
    }
    setProjectDraft({
      presenterWorkType: project.presenterWorkType ?? "",
      projectTitle: project.projectTitle ?? "",
      projectNature: project.projectNature ?? "",
      projectNumber: project.projectNumber ?? "",
      projectDateIso: project.projectDateIso ?? null,
      subsidiary: project.subsidiary ?? "",
    })
    setProjectEditMode("edit")
  }, [project])

  const cancelProjectEditing = useCallback(() => {
    setProjectEditMode("view")
    if (project) {
      setProjectDraft({
        presenterWorkType: project.presenterWorkType ?? "",
        projectTitle: project.projectTitle ?? "",
        projectNature: project.projectNature ?? "",
        projectNumber: project.projectNumber ?? "",
        projectDateIso: project.projectDateIso ?? null,
        subsidiary: project.subsidiary ?? "",
      })
    }
  }, [project])

  const handleProjectDraftChange = useCallback(
    (
      field:
        | "presenterWorkType"
        | "projectTitle"
        | "projectNature"
        | "projectNumber"
        | "subsidiary",
      value: string,
    ) => {
      setProjectDraft((previous) => ({ ...previous, [field]: value }))
    },
    [],
  )

  const handleProjectDateChange = useCallback((value: Dayjs | null) => {
    setProjectDraft((previous) => ({
      ...previous,
      projectDateIso: value ? value.toDate().toISOString() : null,
    }))
  }, [])

  const saveProjectEdits = useCallback(async () => {
    if (!project) {
      return
    }

    const trimmedPresenter = projectDraft.presenterWorkType.trim()
    const trimmedTitle = projectDraft.projectTitle.trim()
    const trimmedNature = projectDraft.projectNature.trim()
    const trimmedNumber = projectDraft.projectNumber.trim()
    const trimmedSubsidiary = projectDraft.subsidiary.trim()

    if (trimmedNumber.length === 0) {
      message.error("Project number is required")
      return
    }

    const normalizeIso = (value: string | null | undefined) => {
      if (!value) {
        return null
      }
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) {
        return null
      }
      return parsed.toISOString()
    }

    const draftDateIso = normalizeIso(projectDraft.projectDateIso)
    if (projectDraft.projectDateIso && !draftDateIso) {
      message.error("Invalid project pickup date")
      return
    }

    const currentPresenter = project.presenterWorkType?.trim() ?? ""
    const currentTitle = project.projectTitle?.trim() ?? ""
    const currentNature = project.projectNature?.trim() ?? ""
    const currentNumber = project.projectNumber?.trim() ?? ""
    const currentSubsidiary = project.subsidiary?.trim() ?? ""
    const currentDateIso = normalizeIso(project.projectDateIso)

    const sanitizedPresenter = toNullableString(trimmedPresenter)
    const sanitizedTitle = toNullableString(trimmedTitle)
    const sanitizedNature = toNullableString(trimmedNature)
    const sanitizedSubsidiary = toNullableString(trimmedSubsidiary)

    const updatesPayload: Record<string, unknown> = {}

    if (currentPresenter !== trimmedPresenter) {
      updatesPayload.presenterWorkType = sanitizedPresenter
    }
    if (currentTitle !== trimmedTitle) {
      updatesPayload.projectTitle = sanitizedTitle
    }
    if (currentNature !== trimmedNature) {
      updatesPayload.projectNature = sanitizedNature
    }
    if (currentNumber !== trimmedNumber) {
      updatesPayload.projectNumber = trimmedNumber
    }
    if (currentSubsidiary !== trimmedSubsidiary) {
      updatesPayload.subsidiary = sanitizedSubsidiary
    }
    if (currentDateIso !== draftDateIso) {
      updatesPayload.projectDate = draftDateIso
    }

    if (Object.keys(updatesPayload).length === 0) {
      setProjectEditMode("view")
      setProjectDraft({
        presenterWorkType: project.presenterWorkType ?? "",
        projectTitle: project.projectTitle ?? "",
        projectNature: project.projectNature ?? "",
        projectNumber: project.projectNumber ?? "",
        projectDateIso: project.projectDateIso ?? null,
        subsidiary: project.subsidiary ?? "",
      })
      return
    }

    const displayFromIso = (value: string | null | undefined) => {
      if (!value) {
        return null
      }
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) {
        return null
      }
      return parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    }

    try {
      setProjectEditMode("saving")
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.year)}/${encodeURIComponent(project.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            updates: updatesPayload,
          }),
        },
      )

      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update project")
      }

      setProject((previous) => {
        if (!previous) {
          return previous
        }
        const nextPresenter =
          "presenterWorkType" in updatesPayload ? sanitizedPresenter ?? null : previous.presenterWorkType
        const nextTitle = "projectTitle" in updatesPayload ? sanitizedTitle ?? null : previous.projectTitle
        const nextNature = "projectNature" in updatesPayload ? sanitizedNature ?? null : previous.projectNature
        const nextNumber = "projectNumber" in updatesPayload ? trimmedNumber : previous.projectNumber
        const nextSubsidiary =
          "subsidiary" in updatesPayload ? sanitizedSubsidiary ?? null : previous.subsidiary
        const nextDateIso =
          "projectDate" in updatesPayload ? draftDateIso : previous.projectDateIso ?? null
        const nextDateDisplay =
          "projectDate" in updatesPayload ? displayFromIso(draftDateIso) : previous.projectDateDisplay ?? null

        const nextSearchIndex = [
          nextNumber,
          nextTitle ?? "",
          previous.clientCompany ?? "",
          nextSubsidiary ?? "",
          previous.invoice ?? "",
          nextNature ?? "",
          nextPresenter ?? "",
        ]
          .join(" ")
          .toLowerCase()

        return {
          ...previous,
          presenterWorkType: nextPresenter,
          projectTitle: nextTitle,
          projectNature: nextNature,
          projectNumber: nextNumber,
          projectDateIso: nextDateIso,
          projectDateDisplay: nextDateDisplay,
          subsidiary: nextSubsidiary,
          searchIndex: nextSearchIndex,
        }
      })

      setProjectEditMode("view")
      setProjectDraft({
        presenterWorkType: sanitizedPresenter ?? "",
        projectTitle: sanitizedTitle ?? "",
        projectNature: sanitizedNature ?? "",
        projectNumber: trimmedNumber,
        projectDateIso: draftDateIso,
        subsidiary: sanitizedSubsidiary ?? "",
      })
      message.success("Project updated")
    } catch (error) {
      const description = error instanceof Error ? error.message : "Unable to update project"
      message.error(description)
      setProjectEditMode("edit")
    }
  }, [
    message,
    project,
    projectDraft.presenterWorkType,
    projectDraft.projectNature,
    projectDraft.projectTitle,
    projectDraft.projectNumber,
    projectDraft.projectDateIso,
  ])

  const handleAddItem = useCallback(() => {
    if (!draftInvoice) {
      return
    }
    setDraftInvoice((previous) => {
      if (!previous) {
        return previous
      }
      const nextId = itemIdRef.current + 1
      itemIdRef.current = nextId
      return {
        ...previous,
        items: [
          ...previous.items,
          {
            key: `item-${nextId}`,
            title: "",
            feeType: "",
            unitPrice: 0,
            quantity: 1,
            discount: 0,
          },
        ],
      }
    })
  }, [draftInvoice])

  const handleItemChange = useCallback(
    (key: string, field: keyof InvoiceDraftItem, value: string | number) => {
      setDraftInvoice((previous) => {
        if (!previous) {
          return previous
        }
        const nextItems = previous.items.map((item) => {
          if (item.key !== key) {
            return item
          }
          if (field === "unitPrice" || field === "quantity" || field === "discount") {
            const numericValue =
              typeof value === "number" && !Number.isNaN(value)
                ? value
                : Number(value) || 0
            return { ...item, [field]: numericValue }
          }
          return { ...item, [field]: typeof value === "string" ? value : `${value}` }
        })
        return { ...previous, items: nextItems }
      })
    },
    [],
  )

  const handleRemoveItem = useCallback((key: string) => {
    setDraftInvoice((previous) => {
      if (!previous) {
        return previous
      }
      return { ...previous, items: previous.items.filter((item) => item.key !== key) }
    })
  }, [])

  const handleTaxChange = useCallback((value: number | null) => {
    setDraftInvoice((previous) => {
      if (!previous) {
        return previous
      }
      const safe = typeof value === "number" && !Number.isNaN(value) ? value : 0
      return { ...previous, taxOrDiscountPercent: safe }
    })
  }, [])

  const handleInvoiceNumberInput = useCallback((value: string) => {
    setDraftInvoice((previous) => {
      if (!previous) {
        return previous
      }
      const baseValue = extractBaseInvoiceNumber(value)
      return { ...previous, invoiceNumber: value, baseInvoiceNumber: baseValue }
    })
  }, [])

  const finalizeInvoiceNumberEdit = useCallback(() => {
    setInvoiceNumberEditing(false)
    setDraftInvoice((previous) => {
      if (!previous) {
        return previous
      }
      const trimmed = previous.invoiceNumber.trim()
      if (trimmed.length === 0) {
        const fallback =
          generateInvoiceFallback(project?.projectNumber ?? null, project?.projectDateIso ?? null) ??
          previous.originalInvoiceNumber ??
          previous.baseInvoiceNumber ??
          "Invoice"
        const fallbackBase = extractBaseInvoiceNumber(fallback)
        return { ...previous, invoiceNumber: fallback, baseInvoiceNumber: fallbackBase }
      }
      const normalizedBase = extractBaseInvoiceNumber(trimmed)
      return { ...previous, invoiceNumber: trimmed, baseInvoiceNumber: normalizedBase }
    })
  }, [project?.projectDateIso, project?.projectNumber])

  const cancelInvoiceNumberEdit = useCallback(() => {
    setInvoiceNumberEditing(false)
    setDraftInvoice((previous) => {
      if (!previous) {
        return previous
      }
      const fallback = previous.originalInvoiceNumber ?? previous.baseInvoiceNumber
      const fallbackBase = extractBaseInvoiceNumber(fallback)
      return { ...previous, invoiceNumber: fallback, baseInvoiceNumber: fallbackBase }
    })
  }, [])

  const handleInvoiceNumberKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault()
        finalizeInvoiceNumberEdit()
      }
      if (event.key === "Escape") {
        event.preventDefault()
        cancelInvoiceNumberEdit()
      }
    },
    [cancelInvoiceNumberEdit, finalizeInvoiceNumberEdit],
  )

  const handleInvoiceStatusChange = useCallback((value: string) => {
    setDraftInvoice((previous) => {
      if (!previous) {
        return previous
      }
      return { ...previous, paymentStatus: value }
    })
  }, [])

  const handleCancelInvoice = useCallback(() => {
    if (!hasInvoices) {
      if (project) {
        const draft = buildDraftForNewInvoice([], project, client, clientDirectoryMap)
        itemIdRef.current = draft.items.length
        setDraftInvoice(draft)
        setInvoiceMode("create")
        setActiveInvoiceIndex(0)
      }
      setInvoiceNumberEditing(false)
      return
    }
    setInvoiceNumberEditing(false)
    setInvoiceMode("idle")
    setDraftInvoice(null)
    itemIdRef.current = 0
    setActiveInvoiceIndex((previousIndex) =>
      Math.min(previousIndex, Math.max(invoices.length - 1, 0)),
    )
  }, [client, clientDirectoryMap, hasInvoices, invoices.length, project])

  const updateProjectFromInvoices = useCallback((nextInvoices: ProjectInvoiceRecord[]) => {
    setProject((previous) => {
      if (!previous) {
        return previous
      }
      const primary = nextInvoices[0]
      let aggregated = 0
      let hasAmount = false
      let aggregatedPaid: boolean | null = null
      let aggregatedPaidOnDisplay: string | null = null
      let aggregatedPaidOnIso: string | null = null
      let aggregatedPaidTo: string | null = null
      nextInvoices.forEach((entry) => {
        if (typeof entry.total === "number" && !Number.isNaN(entry.total)) {
          aggregated += entry.total
          hasAmount = true
        } else if (typeof entry.amount === "number" && !Number.isNaN(entry.amount)) {
          aggregated += entry.amount
          hasAmount = true
        }
        if (entry.paid === true) {
          aggregatedPaid = true
          if (!aggregatedPaidOnDisplay && entry.paidOnDisplay) {
            aggregatedPaidOnDisplay = entry.paidOnDisplay
          }
          if (!aggregatedPaidOnIso && entry.paidOnIso) {
            aggregatedPaidOnIso = entry.paidOnIso
          }
          if (!aggregatedPaidTo && entry.paidTo) {
            aggregatedPaidTo = entry.paidTo
          }
        } else if (entry.paid === false && aggregatedPaid === null) {
          aggregatedPaid = false
          if (!aggregatedPaidOnDisplay && entry.paidOnDisplay) {
            aggregatedPaidOnDisplay = entry.paidOnDisplay
          }
          if (!aggregatedPaidOnIso && entry.paidOnIso) {
            aggregatedPaidOnIso = entry.paidOnIso
          }
          if (!aggregatedPaidTo && entry.paidTo) {
            aggregatedPaidTo = entry.paidTo
          }
        } else {
          if (!aggregatedPaidOnDisplay && entry.paidOnDisplay) {
            aggregatedPaidOnDisplay = entry.paidOnDisplay
          }
          if (!aggregatedPaidOnIso && entry.paidOnIso) {
            aggregatedPaidOnIso = entry.paidOnIso
          }
          if (!aggregatedPaidTo && entry.paidTo) {
            aggregatedPaidTo = entry.paidTo
          }
        }
      })
      const resolvedOnIso = aggregatedPaidOnIso ?? previous.onDateIso ?? null
      const resolvedOnDisplay = aggregatedPaidOnDisplay ?? previous.onDateDisplay ?? null
      return {
        ...previous,
        invoice: primary?.invoiceNumber ?? previous.invoice,
        amount: hasAmount ? aggregated : previous.amount,
        clientCompany: primary?.companyName ?? previous.clientCompany,
        paid: aggregatedPaid ?? previous.paid,
        paidTo: aggregatedPaidTo ?? previous.paidTo,
        onDateIso: resolvedOnIso,
        onDateDisplay: resolvedOnDisplay,
      }
    })
  }, [])

  const handlePaidToChange = useCallback((value: string) => {
    setDraftInvoice((previous) => {
      if (!previous) return previous
      return { ...previous, paidTo: value }
    })
  }, [])

  const handlePaidOnChange = useCallback((value: Dayjs | null) => {
    setDraftInvoice((previous) => {
      if (!previous) return previous
      return { ...previous, paidOnIso: value ? value.toISOString() : null }
    })
  }, [])

  const handleSaveInvoice = useCallback(async () => {
    if (!project || !draftInvoice) {
      return
    }
    try {
      setSavingInvoice(true)
      const endpoint = `/api/projects/by-id/${encodeURIComponent(project.id)}/invoices`
      const method = invoiceMode === "create" ? "POST" : "PATCH"

      const serializedItems = draftInvoice.items.map((item) => ({
        title: item.title?.trim() ?? "",
        feeType: item.feeType?.trim() ?? "",
        unitPrice:
          typeof item.unitPrice === "number" && !Number.isNaN(item.unitPrice)
            ? item.unitPrice
            : Number(item.unitPrice) || 0,
        quantity:
          typeof item.quantity === "number" && !Number.isNaN(item.quantity)
            ? item.quantity
            : Number(item.quantity) || 0,
        discount:
          typeof item.discount === "number" && !Number.isNaN(item.discount)
            ? item.discount
            : Number(item.discount) || 0,
      }))

      const clientPayload = {
        companyName: draftInvoice.client?.companyName ?? null,
      }

      const payload =
        invoiceMode === "create"
          ? {
              baseInvoiceNumber: draftInvoice.baseInvoiceNumber,
              client: clientPayload,
              items: serializedItems,
              taxOrDiscountPercent: draftInvoice.taxOrDiscountPercent,
              paymentStatus: draftInvoice.paymentStatus,
              paidTo: draftInvoice.paidTo ?? null,
              paidOn: draftInvoice.paidOnIso ?? null,
            }
          : {
              collectionId: draftInvoice.collectionId,
              invoiceNumber: draftInvoice.invoiceNumber,
              client: clientPayload,
              items: serializedItems,
              taxOrDiscountPercent: draftInvoice.taxOrDiscountPercent,
              paymentStatus: draftInvoice.paymentStatus,
              paidTo: draftInvoice.paidTo ?? null,
              paidOn: draftInvoice.paidOnIso ?? null,
            }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const body = (await response.json().catch(() => ({}))) as {
        invoices?: ProjectInvoiceRecord[]
        error?: string
      }

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save invoice")
      }

      const updatedInvoices = Array.isArray(body.invoices) ? body.invoices : []
      setInvoices(updatedInvoices)
      updateProjectFromInvoices(updatedInvoices)

      if (invoiceMode === "create") {
        const targetIndex = updatedInvoices.findIndex(
          (entry) => entry.invoiceNumber === draftInvoice.invoiceNumber,
        )
        setActiveInvoiceIndex(targetIndex >= 0 ? targetIndex : Math.max(updatedInvoices.length - 1, 0))
        message.success("Invoice created")
      } else {
        const targetIndex = updatedInvoices.findIndex(
          (entry) => entry.invoiceNumber === draftInvoice.invoiceNumber,
        )
        setActiveInvoiceIndex(targetIndex >= 0 ? targetIndex : 0)
        message.success("Invoice updated")
      }

      setInvoiceNumberEditing(false)
      setInvoiceMode("idle")
      setDraftInvoice(null)
      itemIdRef.current = 0
    } catch (error) {
      const description = error instanceof Error ? error.message : "Unable to save invoice"
      message.error(description)
    } finally {
      setSavingInvoice(false)
    }
  }, [draftInvoice, invoiceMode, message, project, updateProjectFromInvoices])

  const itemsRows: InvoiceTableRow[] = useMemo(() => {
    if (!resolvedDraft) {
      return []
    }
    const rows: InvoiceTableRow[] = resolvedDraft.items.map((item) => ({
      key: item.key,
      kind: "item" as const,
      title: item.title,
      feeType: item.feeType,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      discount: item.discount,
    }))
    if (isEditingInvoice) {
      rows.push({ key: "adder", kind: "adder" })
    }
    return rows
  }, [isEditingInvoice, resolvedDraft])

  const itemsColumns = useMemo(
    () => [
      {
        key: "title",
        dataIndex: "title",
        title: <span className="items-heading">Item</span>,
        onCell: (record) => (record.kind === "adder" ? { colSpan: 5 } : {}),
        render: (_: unknown, record: InvoiceTableRow) => {
          if (record.kind === "adder") {
            return (
              <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem} block>
                Add item
              </Button>
            )
          }

          if (!isEditingInvoice) {
            const title = record.title?.trim() ? record.title.trim() : "N/A"
            const description = record.feeType?.trim() ? record.feeType.trim() : "N/A"
            return (
              <div className="item-display">
                <div className="item-title-text">{title}</div>
                <div className="item-fee-type">{description}</div>
              </div>
            )
          }

          return (
            <div className="item-edit">
              <div className="item-edit-fields">
                <Input
                  value={record.title}
                  placeholder="Item title"
                  bordered={false}
                  onChange={(event) => handleItemChange(record.key, "title", event.target.value)}
                />
                <Input.TextArea
                  value={record.feeType}
                  placeholder="Description"
                  bordered={false}
                  autoSize={{ minRows: 1, maxRows: 3 }}
                  onChange={(event) => handleItemChange(record.key, "feeType", event.target.value)}
                />
              </div>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveItem(record.key)}
              />
            </div>
          )
        },
      },
      {
        key: "unitPrice",
        dataIndex: "unitPrice",
        title: <span className="items-heading">Unit Price</span>,
        width: 140,
        align: "left",
        onCell: (record) => (record.kind === "adder" ? { colSpan: 0 } : {}),
        render: (value: number | undefined, record: InvoiceTableRow) => {
          if (record.kind === "adder") {
            return null
          }
          if (!isEditingInvoice) {
            return <span className="numeric-text">{amountText(value ?? 0)}</span>
          }
          return (
            <InputNumber
              value={value}
              min={-1000000}
              bordered={false}
              style={{ width: "100%" }}
              onChange={(next) => handleItemChange(record.key, "unitPrice", next ?? 0)}
            />
          )
        },
      },
      {
        key: "quantity",
        dataIndex: "quantity",
        title: <span className="items-heading">Qty</span>,
        width: 100,
        align: "left",
        onCell: (record) => (record.kind === "adder" ? { colSpan: 0 } : {}),
        render: (value: number | undefined, record: InvoiceTableRow) => {
          if (record.kind === "adder") {
            return null
          }
          if (!isEditingInvoice) {
            return <span className="numeric-text">{toNumberValue(value)}</span>
          }
          return (
            <InputNumber
              value={value}
              min={0}
              bordered={false}
              style={{ width: "100%" }}
              onChange={(next) => handleItemChange(record.key, "quantity", next ?? 0)}
            />
          )
        },
      },
      {
        key: "discount",
        dataIndex: "discount",
        title: <span className="items-heading">Discount</span>,
        width: 140,
        align: "left",
        onCell: (record) => (record.kind === "adder" ? { colSpan: 0 } : {}),
        render: (value: number | undefined, record: InvoiceTableRow) => {
          if (record.kind === "adder") {
            return null
          }
          if (!isEditingInvoice) {
            return <span className="numeric-text">{amountText(value ?? 0)}</span>
          }
          return (
            <InputNumber
              value={value}
              bordered={false}
              style={{ width: "100%" }}
              onChange={(next) => handleItemChange(record.key, "discount", next ?? 0)}
            />
          )
        },
      },
      {
        key: "total",
        dataIndex: "total",
        title: <span className="items-heading">Total</span>,
        align: "left",
        onCell: (record) => (record.kind === "adder" ? { colSpan: 0 } : {}),
        render: (_: unknown, record: InvoiceTableRow) => {
          if (record.kind === "adder") {
            return null
          }
          const lineTotal = computeLineTotal({
            unitPrice: toNumberValue(record.unitPrice),
            quantity: toNumberValue(record.quantity),
            discount: toNumberValue(record.discount),
          })
          return <span className="numeric-text">{amountText(lineTotal)}</span>
        },
      },
    ],
    [handleAddItem, handleItemChange, handleRemoveItem, isEditingInvoice],
  )

  if (loading) {
    return (
      <div className="loading-state">
        <Spin size="large" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="loading-state">
        <Empty description="Project not found" />
      </div>
    )
  }
  const isProjectEditing = projectEditMode === "edit" || projectEditMode === "saving"
  const projectEditSaving = projectEditMode === "saving"
  const showInvoiceCancel = invoiceMode !== "idle" && (invoiceMode === "edit" || hasInvoices)
  return (
    <div className="page-wrapper">
      <div className="page-inner">
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          <div className="top-row">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
              style={{ fontFamily: KARLA_FONT, fontWeight: 600 }}
            >
              Back to Projects
            </Button>
          </div>
          <div className={`header-block${isProjectEditing ? " editing" : ""}`}>
          <div className="descriptor-line">
            {isProjectEditing ? (
              <Input
                value={projectDraft.projectNumber}
                onChange={(event) => handleProjectDraftChange("projectNumber", event.target.value)}
                placeholder="Project number"
                bordered={false}
                className="descriptor-input"
                disabled={projectEditSaving}
                style={{ maxWidth: 240 }}
              />
            ) : (
              <span className="descriptor-number">{stringOrNA(project.projectNumber)}</span>
            )}
            <span className="descriptor-separator">/</span>
            <div className="descriptor-date-group">
              {isProjectEditing ? (
                <DatePicker
                  value={projectDraft.projectDateIso ? dayjs(projectDraft.projectDateIso) : null}
                  onChange={handleProjectDateChange}
                  format="MMM DD, YYYY"
                  allowClear
                  bordered={false}
                  className="descriptor-picker"
                  disabled={projectEditSaving}
                  style={{ minWidth: 160 }}
                />
              ) : (
                <span className="descriptor-date">
                  {formatProjectDate(project.projectDateIso, project.projectDateDisplay)}
                </span>
              )}
              {isProjectEditing ? (
                <div className="descriptor-actions">
                  <Button
                    className="project-cancel"
                    onClick={cancelProjectEditing}
                    disabled={projectEditSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    className="project-save"
                    onClick={saveProjectEdits}
                    loading={projectEditSaving}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="descriptor-edit-trigger"
                  onClick={startProjectEditing}
                  aria-label="Edit project details"
                >
                  <EditOutlined />
                </button>
              )}
            </div>
          </div>
          <div className="title-row">
            <div className="title-content">
              {isProjectEditing ? (
                <Input
                  value={projectDraft.presenterWorkType}
                  onChange={(event) =>
                    handleProjectDraftChange("presenterWorkType", event.target.value)
                  }
                  placeholder="Project type"
                  bordered={false}
                  className="presenter-input"
                  disabled={projectEditSaving}
                  style={{ width: "100%", maxWidth: 480 }}
                />
              ) : (
                <Text className="presenter-type">{stringOrNA(project.presenterWorkType)}</Text>
              )}
              {isProjectEditing ? (
                <Input
                  value={projectDraft.projectTitle}
                  onChange={(event) => handleProjectDraftChange("projectTitle", event.target.value)}
                  placeholder="Project title"
                  bordered={false}
                  className="project-title-input"
                  disabled={projectEditSaving}
                  style={{ width: "100%", maxWidth: 620 }}
                />
              ) : (
                <Title level={2} className="project-title">
                  {stringOrNA(project.projectTitle)}
                </Title>
              )}
              <div className={`nature-row ${isProjectEditing ? "editing" : ""}`}>
                {isProjectEditing ? (
                  <Input
                    value={projectDraft.projectNature}
                    onChange={(event) => handleProjectDraftChange("projectNature", event.target.value)}
                    placeholder="Project nature"
                    bordered={false}
                    className="project-nature-input"
                    disabled={projectEditSaving}
                    style={{ width: "100%", maxWidth: 560 }}
                  />
                ) : (
                  <Text className="project-nature">{stringOrNA(project.projectNature)}</Text>
                )}
              </div>
              {isProjectEditing ? (
                <div className="subsidiary-row">
                  <Input
                    value={projectDraft.subsidiary}
                    onChange={(event) => handleProjectDraftChange("subsidiary", event.target.value)}
                    placeholder="Subsidiary"
                    bordered={false}
                    className="subsidiary-input"
                    disabled={projectEditSaving}
                    style={{ width: "100%", maxWidth: 360 }}
                  />
                </div>
              ) : project.subsidiary ? (
                <div className="subsidiary-row">
                  <Tag className="subsidiary-chip">{stringOrNA(project.subsidiary)}</Tag>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="status-row">
          <div className="status-buttons">
            {STATUS_STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                className={`status-button ${index === 0 ? "first" : ""} ${
                  index === STATUS_STEPS.length - 1 ? "last" : ""
                } ${index <= paymentStatusIndex ? "done" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Card className="details-card billing-card" bordered={false}>
          <div className="billing-card-content">
            <div className="billing-layout">
              <div className="billing-main">
                <section className="billing-section">
                  <Title level={5} className="section-heading">
                    Billing &amp; Payments
                  </Title>
                  <div className="invoice-table">
                    <div className="invoice-row head">
                      <span className="invoice-cell heading">Invoice #</span>
                      <span className="invoice-cell heading">Amount</span>
                      <span className="invoice-cell heading">Status</span>
                      <span className="invoice-cell heading">To</span>
                      <span className="invoice-cell heading">On</span>
                    </div>
                    {invoiceEntries.length > 0 ? (
                      invoiceEntries.map((entry, index) => {
                        const isActive = index === activeEntryIndex
                        const isEditingRow = invoiceMode !== "idle" && isActive
                        const isPending = entry.pending
                        const displayNumber =
                          isEditingRow && draftInvoice ? draftInvoice.invoiceNumber : entry.invoiceNumber
                        const payToInfo = entry.payToInfo

                        return (
                          <div
                            key={`${entry.invoiceNumber}-${index}`}
                            role="button"
                            tabIndex={0}
                            className={`invoice-row selectable-row ${
                              isActive ? "active" : ""
                            } ${isPending ? "pending" : ""}`}
                            onClick={() => handleSelectInvoice(index, entry.pending)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                handleSelectInvoice(index, entry.pending)
                              }
                            }}
                          >
                            <div className="invoice-cell number">
                              {isEditingRow && invoiceNumberEditing ? (
                                <Input
                                  value={draftInvoice?.invoiceNumber ?? ""}
                                  onChange={(event) => handleInvoiceNumberInput(event.target.value)}
                                  onBlur={finalizeInvoiceNumberEdit}
                                  onKeyDown={handleInvoiceNumberKeyDown}
                                  autoFocus
                                  bordered={false}
                                  className="invoice-input editing"
                                  onClick={(event) => event.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className={[
                                    "invoice-number-text",
                                    isEditingRow ? "editing" : "",
                                    entry.pending ? "pending" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  {displayNumber}
                                </span>
                              )}
                              {!isPending && !isEditingRow ? (
                                <button
                                  type="button"
                                  className="invoice-edit-trigger"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleBeginInvoiceRowEdit(index, entry.pending)
                                  }}
                                  disabled={invoiceMode !== "idle"}
                                  aria-label="Edit invoice"
                                >
                                  <EditOutlined />
                                </button>
                              ) : null}
                            </div>
                            <div className="invoice-cell amount">
                              {amountText(isEditingRow ? total : entry.amount)}
                            </div>
                            <div className="invoice-cell status">
                              {isEditingRow && draftInvoice ? (
                                <div
                                  className="invoice-status-control"
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                >
                                  <Select
                                    value={draftInvoice.paymentStatus ?? undefined}
                                    onChange={handleInvoiceStatusChange}
                                    options={ANT_INVOICE_STATUS_OPTIONS}
                                    className="invoice-status-select"
                                    dropdownMatchSelectWidth={160}
                                    style={{ width: "100%" }}
                                  />
                                </div>
                              ) : entry.pending ? (
                                <span className="draft-pill">Draft</span>
                              ) : (
                                <Tag
                                  color={paymentPalette[entry.statusColor].backgroundColor}
                                  className="status-chip"
                                  style={{ color: paymentPalette[entry.statusColor].color }}
                                >
                                  {entry.statusLabel}
                                </Tag>
                              )}
                            </div>
                            <div
                              className={`invoice-cell pay-to${
                                isEditingRow && draftInvoice ? " editing" : ""
                              }`}
                            >
                              {isEditingRow && draftInvoice ? (
                                <Input
                                  value={draftInvoice.paidTo ?? ""}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    handlePaidToChange(e.target.value)
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  bordered={false}
                                  className="invoice-input editing"
                                  placeholder="Bank identifier (e.g., ERL-OCBC-S)"
                                />
                              ) : payToInfo ? (
                                <div className="bank-display">
                                  <span className="bank-name">
                                    {payToInfo.bankName || entry.payToText}
                                  </span>
                                  {payToInfo.accountType ? (
                                    <span className="account-chip">{payToInfo.accountType}</span>
                                  ) : null}
                                </div>
                              ) : entry.payToText ? (
                                <span className="bank-name">{entry.payToText}</span>
                              ) : (
                                "-"
                              )}
                            </div>
                            <div className="invoice-cell paid-on">
                              {isEditingRow && draftInvoice ? (
                                <DatePicker
                                  value={draftInvoice.paidOnIso ? dayjs(draftInvoice.paidOnIso) : null}
                                  onChange={(v) => {
                                    handlePaidOnChange(v)
                                  }}
                                  bordered={false}
                                  format="MMM DD, YYYY"
                                  placeholder="Select date"
                                  allowClear
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                entry.paidOnText ?? "-"
                              )}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="invoice-empty-row">No invoices yet.</div>
                    )}
                    {invoiceEntries.length > 1 ? (
                      <div className="invoice-row total" role="row">
                        <span className="invoice-cell number total-label">Total:</span>
                        <span className="invoice-cell amount">{amountText(projectTotalValue)}</span>
                        <span className="invoice-cell status total-status">{totalStatusLabel}</span>
                        <span className="invoice-cell pay-to">-</span>
                        <span className="invoice-cell paid-on">{totalPaidOnText}</span>
                      </div>
                    ) : null}
                  </div>
                  {invoiceMode === "idle" ? (
                    <div className="billing-actions">
                      <Space size={12} wrap>
                        <Button type="primary" onClick={() => prepareDraft("create")}>
                          Add Additional Invoice
                        </Button>
                      </Space>
                    </div>
                  ) : null}
                  {invoiceMode === "create" && hasInvoices ? (
                    <div className="billing-actions">
                      <Space size={12} wrap>
                        <Button onClick={handleCancelInvoice} disabled={savingInvoice}>
                          Cancel
                        </Button>
                        <Button type="primary" disabled>
                          Add Additional Invoice
                        </Button>
                      </Space>
                    </div>
                  ) : null}
                </section>
                <section className="items-section">
                  <div className="items-header">
                    <Title level={4} className="section-heading">
                      Invoice Details
                    </Title>
                  </div>
                  <Table<InvoiceTableRow>
                    dataSource={itemsRows}
                    columns={itemsColumns}
                    pagination={false}
                    rowKey="key"
                    className="invoice-items"
                  />
                  <div className="totals-panel">
                    <div className="totals-row">
                      <span className="meta-label">Sub-total</span>
                      <span className="meta-value">{amountText(subtotal)}</span>
                    </div>
                    <div className="totals-row">
                      <span className="meta-label">Tax / Discount</span>
                      {isEditingInvoice ? (
                        <InputNumber
                          value={taxPercent}
                          bordered={false}
                          onChange={handleTaxChange}
                          className="tax-input"
                        />
                      ) : (
                        <span className="meta-value">{formatPercentText(taxPercent)}</span>
                      )}
                    </div>
                    <div className="totals-row total">
                      <span className="meta-label">Total</span>
                      <span className="meta-value">{amountText(total)}</span>
                    </div>
                    {taxAmount !== 0 ? (
                      <div className="tax-hint">({amountText(taxAmount)} adjustment)</div>
                    ) : null}
                  </div>
                  {isEditingInvoice ? (
                    <div className="items-actions">
                      <Space size={12}>
                        {showInvoiceCancel ? (
                          <Button onClick={handleCancelInvoice} disabled={savingInvoice}>
                            Cancel
                          </Button>
                        ) : null}
                        <Button type="primary" onClick={handleSaveInvoice} loading={savingInvoice}>
                          {invoiceMode === "create" ? "Confirm" : "Save"}
                        </Button>
                      </Space>
                    </div>
                  ) : null}
                </section>
              </div>
              <aside className="client-panel">
                <span className="summary-label client-label">Client</span>
                <div className="company-block">
                  <div className="company-name">{stringOrNA(resolvedClient?.companyName)}</div>
                  <div className="company-line">{stringOrNA(resolvedClient?.addressLine1)}</div>
                  <div className="company-line">{stringOrNA(resolvedClient?.addressLine2)}</div>
                  <div className="company-line">{stringOrNA(companyLine3)}</div>
                  {resolvedClient?.representative ? (
                    <div className="company-line client-attn">
                      <strong>Attn: {resolvedClient.representative}</strong>
                    </div>
                  ) : null}
                </div>
              </aside>
            </div>
          </div>
        </Card>
      </Space>
      </div>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@500;600&display=swap");
        .page-wrapper {
          padding: 32px 24px 48px;
          background: #f8fafc;
          min-height: 100%;
          font-family: ${KARLA_FONT};
        }

        .page-inner {
          max-width: 1040px;
          margin: 0 auto;
          width: 100%;
        }

        .loading-state {
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 64px 16px;
        }

        .top-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .header-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .descriptor-line {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: ${KARLA_FONT};
          font-weight: 600;
          flex-wrap: wrap;
        }

        .descriptor-number {
          color: #0f172a;
          font-size: 18px;
        }

        .descriptor-input {
          padding: 0;
          background: transparent;
          border: none;
          box-shadow: none;
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
          font-size: 18px;
          height: auto;
        }

        .descriptor-separator {
          color: #94a3b8;
        }

        .descriptor-date-group {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .descriptor-date {
          color: #64748b;
          font-style: italic;
        }

        .descriptor-picker,
        .descriptor-picker:hover,
        .descriptor-picker:focus {
          background: transparent;
        }

        .descriptor-picker .ant-picker-input > input {
          font-family: ${KARLA_FONT};
          color: #64748b;
          font-style: italic;
          font-weight: 500;
        }

        .descriptor-picker .ant-picker-input > input::placeholder {
          color: #94a3b8;
          font-style: italic;
        }

        .header-block.editing {
          background: #f1f5f9;
          border-radius: 16px;
          padding: 12px 16px;
        }

        .header-block.editing .descriptor-date-group {
          background: #e2e8f0;
          border-radius: 12px;
          padding: 4px 8px;
        }

        .header-block.editing :global(.descriptor-input.ant-input),
        .header-block.editing :global(.presenter-input.ant-input),
        .header-block.editing :global(.project-title-input.ant-input),
        .header-block.editing :global(.project-nature-input.ant-input),
        .header-block.editing :global(.subsidiary-input.ant-input) {
          padding: 6px 10px;
          border-radius: 10px;
          border: 1px solid #60a5fa;
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.25);
        }

        .header-block.editing .descriptor-picker,
        .header-block.editing .descriptor-picker:hover,
        .header-block.editing .descriptor-picker:focus {
          background: #ffffff;
          border-radius: 10px;
          border: 1px solid #60a5fa;
          box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.25);
          padding: 2px 8px;
        }

        .header-block.editing .descriptor-picker .ant-picker-input > input {
          color: #0f172a;
          font-style: normal;
        }

        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
        }

        .title-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1 1 320px;
          max-width: 100%;
        }

        .presenter-type {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          line-height: 1;
          margin: 0;
        }

        .presenter-input,
        .project-title-input,
        .project-nature-input,
        .invoice-input {
          padding: 0;
          background: transparent;
          font-family: ${KARLA_FONT};
          line-height: 1.1;
          height: auto;
        }

        :global(.presenter-input.ant-input),
        :global(.project-title-input.ant-input),
        :global(.project-nature-input.ant-input) {
          padding: 2px 0;
          height: auto;
          line-height: 1.1;
        }

        .presenter-input {
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .project-title {
          margin: 0;
          font-family: ${KARLA_FONT};
          font-weight: 700;
          color: #0f172a;
          line-height: 1.01;
          padding: 0;
        }

        :global(.project-title.ant-typography) {
          margin: 0 !important;
          line-height: 1.01;
        }

        :global(.project-title.ant-typography > div) {
          margin: 0 !important;
        }

        .project-title-input {
          font-weight: 700;
          font-size: 28px;
          color: #0f172a;
          line-height: 1.02;
        }

        .project-nature {
          display: block;
          font-family: ${KARLA_FONT};
          font-weight: 500;
          font-style: italic;
          color: #475569;
          line-height: 1.1;
          margin: 0;
        }

        .project-nature-input {
          font-weight: 500;
          font-style: italic;
          color: #475569;
          line-height: 1.1;
        }

        .nature-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
        }

        .subsidiary-row {
          margin-top: 2px;
          display: flex;
          align-items: center;
        }

        .subsidiary-input {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
          padding: 0;
        }

        .subsidiary-chip {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          background: #e0f2fe;
          color: #0c4a6e;
          border-radius: 9999px;
          border: none;
          padding: 4px 14px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          width: fit-content;
          max-width: 100%;
          white-space: nowrap;
        }

        .descriptor-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .descriptor-edit-trigger {
          border: none;
          background: none;
          padding: 4px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #475569;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .descriptor-edit-trigger:hover {
          background: #e2e8f0;
        }

        .descriptor-edit-trigger:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .project-cancel {
          background: #f1f5f9;
          border-radius: 24px;
          border: 1px solid #cbd5f5;
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #1e293b;
          padding: 8px 20px;
        }

        .project-save {
          border-radius: 24px;
          font-family: ${KARLA_FONT};
          font-weight: 600;
          padding: 8px 24px;
        }

        .status-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          align-items: center;
          gap: 16px;
        }

        .status-buttons {
          display: flex;
          flex-wrap: nowrap;
        }

        .status-button {
          position: relative;
          border: none;
          background: #e2e8f0;
          color: #334155;
          padding: 10px 28px;
          font-family: ${KARLA_FONT};
          font-weight: 600;
          cursor: default;
        }

        .status-button.first {
          border-radius: 999px 0 0 999px;
        }

        .status-button.last {
          border-radius: 0 999px 999px 0;
        }

        .status-button:not(.last)::after {
          content: "";
          position: absolute;
          top: 0;
          right: -28px;
          width: 28px;
          height: 100%;
          clip-path: polygon(0 0, 100% 50%, 0 100%);
          background: inherit;
        }

        .status-button.done {
          background: #2f8f9d;
          color: #ffffff;
        }

        .status-button.done:not(.last)::after {
          background: #2f8f9d;
        }

        .details-card {
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.06);
          font-family: ${KARLA_FONT};
        }

        .company-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-end;
          text-align: right;
        }

        .company-name {
          font-family: ${KARLA_FONT};
          font-weight: 700;
          font-size: 18px;
          color: #0f172a;
        }

        .company-line {
          font-family: ${KARLA_FONT};
          color: #475569;
          font-weight: 500;
        }

        .client-attn {
          margin-top: 4px;
        }

        .client-attn strong {
          font-family: ${KARLA_FONT};
          font-weight: 700;
          color: #0f172a;
        }

        .summary-item {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          min-width: 160px;
        }

        .summary-label {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-size: 12px;
        }

        .summary-value {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
        }

        .summary-item.status {
          gap: 12px;
        }

        .summary-item.status .status-chip {
          margin-top: 0;
        }

        .invoice-summary {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .invoice-input {
          font-weight: 700;
          color: #0f172a;
          width: 100%;
        }

        .invoice-number-text {
          font-weight: 700;
          font-family: ${KARLA_FONT};
        }

        .invoice-number-text.editing {
          color: #4b5563;
          font-style: italic;
        }

        .invoice-number-text.pending {
          color: #6b7280;
          font-style: italic;
          animation: blink 1.2s infinite;
        }

        .billing-card :global(.ant-card-body) {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
        }

        .billing-card-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex: 1;
        }

        .billing-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(220px, 260px);
          gap: 24px;
          align-items: stretch;
        }

        @media (max-width: 991px) {
          .billing-layout {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        .billing-main {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 100%;
        }

        .billing-section,
        .items-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .items-section {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .client-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
          padding: 8px 0 0;
          align-items: flex-end;
          text-align: right;
        }

        .client-label {
          font-size: 11px;
          align-self: flex-end;
        }

        .invoice-table {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .invoice-row {
          display: grid;
          grid-template-columns:
            minmax(160px, 1.2fr)
            minmax(120px, 0.8fr)
            minmax(140px, 1fr)
            minmax(160px, 1.1fr)
            minmax(120px, 0.8fr);
          align-items: center;
          gap: 12px;
          font-family: ${KARLA_FONT};
          justify-items: stretch;
        }

        .invoice-row.head {
          padding: 0 8px;
          align-items: flex-end;
        }

        .invoice-row.head .invoice-cell {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-size: 12px;
        }

        .invoice-cell {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
          text-align: left;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .invoice-cell.number {
          gap: 12px;
        }

        .invoice-cell.amount {
          font-variant-numeric: tabular-nums;
        }

        .invoice-cell.status {
          align-items: center;
          gap: 8px;
        }

        .invoice-cell.pay-to {
          flex-direction: column;
          align-items: flex-start;
          color: #0f172a;
        }

        .invoice-cell.pay-to.editing {
          flex-direction: row;
          align-items: center;
        }

        .invoice-cell.paid-on {
          justify-content: flex-start;
        }

        .invoice-cell.number :global(.ant-input) {
          width: 100%;
        }

        .invoice-cell.status :global(.ant-select),
        .invoice-cell.paid-on :global(.ant-picker) {
          width: 100%;
        }

        .bank-name {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
          display: block;
        }

        .bank-display .account-chip {
          margin-top: 2px;
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 9999px;
          background: #e5e7eb;
          color: #374151;
          font-family: ${KARLA_FONT};
          font-weight: 600;
          font-size: 12px;
          line-height: 1;
        }

        .invoice-edit-trigger {
          border: none;
          background: none;
          padding: 4px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #475569;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .invoice-edit-trigger:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .invoice-edit-trigger:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .invoice-number-text.editing {
          color: #4b5563;
          font-style: italic;
        }

        .invoice-input.editing {
          font-style: italic;
          color: #4b5563;
        }

        .invoice-row.selectable-row {
          border: 1px solid transparent;
          border-radius: 16px;
          padding: 12px 16px;
          transition: border-color 0.2s ease, background 0.2s ease;
          cursor: pointer;
        }

        .invoice-row.selectable-row:hover {
          border-color: #cbd5f5;
          background: #f8fafc;
        }

        .invoice-row.selectable-row.active {
          background: #e0f2fe;
          border-color: #93c5fd;
        }

        .invoice-row.selectable-row.pending {
          cursor: default;
        }

        .invoice-row.selectable-row.pending:hover {
          border-color: transparent;
          background: transparent;
        }

        .invoice-row.selectable-row:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .invoice-row.total {
          border-radius: 16px;
          padding: 12px 16px;
          background: transparent;
        }

        .invoice-row.total .invoice-cell {
          font-weight: 700;
        }

        .invoice-row.total .total-label {
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .invoice-row.total .total-status {
          font-weight: 600;
        }

        .invoice-empty-row {
          font-family: ${KARLA_FONT};
          font-weight: 500;
          color: #94a3b8;
          padding: 16px 0;
        }

        .invoice-status-control {
          width: 160px;
        }

        .invoice-status-select :global(.ant-select-selector) {
          border-radius: 12px !important;
          font-family: ${KARLA_FONT};
          font-weight: 600;
        }

        .invoice-status-select :global(.ant-select-selection-item) {
          display: flex;
          align-items: center;
        }

        .draft-pill {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #475569;
          font-style: italic;
          animation: blink 1.2s infinite;
        }

        .billing-actions {
          margin-top: 8px;
        }

        .billing-actions :global(.ant-btn) {
          font-family: ${KARLA_FONT};
          font-weight: 600;
        }

        .items-header {
          margin-bottom: 12px;
        }

        .items-heading {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #1f2937;
        }

        .item-display {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: stretch;
          width: 100%;
        }

        .item-title-text {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
          display: block;
          line-height: 1.3;
          width: 100%;
        }

        .item-fee-type {
          font-family: 'Darker Grotesque', sans-serif;
          font-weight: 600;
          color: #4b5563;
          display: block;
          line-height: 1.25;
          white-space: normal;
          width: 100%;
        }

        .item-edit {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .item-edit-fields {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .numeric-text {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
          text-align: left;
          display: block;
        }

        .invoice-items :global(.ant-table) {
          font-family: ${KARLA_FONT};
        }
        .invoice-items :global(.ant-table-cell) {
          text-align: left;
          white-space: normal;
          vertical-align: top;
        }
        .invoice-items :global(.ant-input-number) {
          width: 100%;
        }
        .invoice-items :global(.ant-input-number-input) {
          text-align: left;
        }

        .totals-panel {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: flex-end;
        }

        .totals-row {
          display: flex;
          gap: 24px;
        }

        .totals-row.total .meta-value {
          font-size: 20px;
        }

        .tax-input {
          font-family: ${KARLA_FONT};
        }

        .tax-hint {
          font-family: ${KARLA_FONT};
          font-weight: 500;
          color: #475569;
          font-size: 12px;
        }

        .meta-label {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-size: 12px;
        }

        .meta-value {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
        }

        .meta-value.italic {
          font-style: italic;
        }

        .items-actions {
          margin-top: 16px;
          display: flex;
          justify-content: flex-start;
        }

        @keyframes blink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
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
