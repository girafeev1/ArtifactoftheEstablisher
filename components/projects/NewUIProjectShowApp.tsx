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
  Modal,
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
  AutoComplete,
  Tooltip,
} from "antd"
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined, CloseOutlined } from "@ant-design/icons"
import { fetchClientsDirectory } from "../../lib/clientDirectory"

import type { ClientDirectoryRecord } from "../../lib/clientDirectory"
import type { ProjectRecord } from "../../lib/projectsDatabase"
import type { ProjectInvoiceRecord } from "../../lib/projectInvoices"
import dayjs, { type Dayjs } from "dayjs"
import { resolveBankAccountIdentifier, listBanks, listAccounts, lookupAccount, type BankInfo, type AccountInfo } from "../../lib/erlDirectory"
import { fetchSubsidiaryById, fetchSubsidiaries, type SubsidiaryDoc } from "../../lib/subsidiaries"
import clsx from 'clsx'

import AppShell from "../new-ui/AppShell"
import {
  amountText,
  mergeLineWithRegion,
  normalizeClient,
  normalizeProject,
  paymentChipLabel,
  stringOrNA,
  type NormalizedClient,
  type NormalizedProject,
} from "./projectUtils"
import { projectsDataProvider } from "./NewUIProjectsApp"

const { Title, Text } = Typography

const KARLA_FONT = "'Karla', sans-serif"
const IANSUI_FONT = "'Iansui', 'Karla', sans-serif"
const YUJI_MAI_FONT = "'Yuji Mai', 'Karla', serif"
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
  invoices?: ProjectInvoiceRecord[]
}

type InvoiceDraftItem = {
  key: string
  title: string
  feeType: string
  unitPrice: number
  quantity: number
  discount: number
  subQuantity: string
  notes: string
  quantityUnit: string
  discountInput: string
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

const isCjk = (ch: string) => /[㐀-鿿豈-﫿]/.test(ch)

const renderMixed = (text: string | null | undefined, zhClass: string, enClass: string) => {
  const value = (text ?? '').toString()
  if (!value) return null
  const parts: Array<{ key: string; text: string; zh: boolean }> = []
  let buf = ''
  let zh = isCjk(value[0] ?? '')
  for (const ch of value) {
    const nextZh = isCjk(ch)
    if (nextZh !== zh) {
      parts.push({ key: `${parts.length}`, text: buf, zh })
      buf = ch
      zh = nextZh
    } else {
      buf += ch
    }
  }
  if (buf) parts.push({ key: `${parts.length}`, text: buf, zh })
  return parts.map((p, i) => (
    <span key={`${p.key}-${i}`} className={p.zh ? zhClass : enClass}>{p.text}</span>
  ))
}

const spaceify = (value: string) => {
  return value.split(' ').map(word => {
    return word.split('').join(' ');
  }).join('   ').trim();
}

type InvoiceTableRow = {
  key: string
  kind: "item" | "adder"
  title?: string
  feeType?: string
  unitPrice?: number
  quantity?: number
  discount?: number
  subQuantity?: string
  notes?: string
  quantityUnit?: string
  discountInput?: string
}

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
): InvoiceClientState => ({
  companyName:
    invoice?.companyName ?? normalizedClient?.companyName ?? project?.clientCompany ?? null,
  addressLine1: invoice?.addressLine1 ?? normalizedClient?.addressLine1 ?? null,
  addressLine2: invoice?.addressLine2 ?? normalizedClient?.addressLine2 ?? null,
  addressLine3: invoice?.addressLine3 ?? normalizedClient?.addressLine3 ?? null,
  region: invoice?.region ?? normalizedClient?.region ?? null,
  representative:
    invoice?.representative ?? normalizedClient?.representative ?? null,
})

const buildDraftFromInvoice = (
  invoice: ProjectInvoiceRecord,
  normalizedClient: NormalizedClient | null,
  project: NormalizedProject | null,
): InvoiceDraftState => ({
  invoiceNumber: invoice.invoiceNumber,
  baseInvoiceNumber: invoice.baseInvoiceNumber ?? extractBaseInvoiceNumber(invoice.invoiceNumber),
  collectionId: invoice.collectionId,
  originalInvoiceNumber: invoice.invoiceNumber,
  client: buildClientState(invoice, normalizedClient, project),
  items: (invoice.items ?? []).map((item, index) => ({
    key: `item-${index + 1}`,
    title: item.title ?? "",
    feeType: item.feeType ?? "",
    unitPrice: toNumberValue(item.unitPrice),
    quantity: toNumberValue(item.quantity),
    discount: toNumberValue(item.discount),
    subQuantity: item.subQuantity ?? "",
    notes: item.notes ?? "",
    quantityUnit: item.quantityUnit ?? "",
    discountInput: formatDiscountInput(
      toNumberValue(item.unitPrice),
      toNumberValue(item.quantity),
      toNumberValue(item.discount),
    ),
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
    client: buildClientState(null, normalizedClient, project),
    items: [],
    taxOrDiscountPercent: 0,
    paymentStatus: "Draft",
    paidTo: null,
    paidOnIso: null,
  }
}

const formatDiscountInput = (unitPrice: number, quantity: number, discount: number) => {
  const base = unitPrice * quantity
  if (!discount || discount <= 0) {
    return ""
  }
  if (base > 0) {
    const percent = (discount / base) * 100
    if (Number.isFinite(percent) && percent > 0) {
      const rounded = Math.round(percent * 10) / 10
      return `${rounded % 1 === 0 ? Math.round(rounded) : rounded}%`
    }
  }
  return `${discount}`
}

const parseDiscountInput = (raw: string, unitPrice: number, quantity: number) => {
  const base = unitPrice * quantity
  const trimmed = raw.trim()
  if (!trimmed) {
    return 0
  }
  if (trimmed.endsWith("%")) {
    const numeric = Number(trimmed.slice(0, -1).trim())
    if (!Number.isNaN(numeric) && numeric > 0 && base > 0) {
      const amount = (base * numeric) / 100
      return Math.max(0, Math.min(amount, base))
    }
    return 0
  }
  const cleaned = trimmed.replace(/[^0-9.\-]/g, "")
  const numeric = Number(cleaned)
  if (Number.isNaN(numeric) || numeric <= 0) {
    return 0
  }
  if (base > 0) {
    return Math.min(numeric, base)
  }
  return numeric
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
  return `${safe.toFixed(2)}%`
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
  const [isManagingInvoices, setIsManagingInvoices] = useState(false)
  const [isEditingInvoiceDetails, setIsEditingInvoiceDetails] = useState(false)
  const manageButtonLabel = useMemo(() => {
    if (draftInvoice) {
      return "Commit Changes"
    }
    if (isManagingInvoices || isEditingInvoiceDetails) {
      return invoices.length > 0 ? "Manage Invoices" : "Manage Invoice"
    }
    return invoices.length > 0 ? "Manage Invoices" : "Manage Invoice"
  }, [draftInvoice, invoices.length, isEditingInvoiceDetails, isManagingInvoices])
  // Equalize status button widths to the longest label
  const statusButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [statusButtonWidth, setStatusButtonWidth] = useState<number | undefined>(undefined)
  const [bankInfoMap, setBankInfoMap] = useState< Record<string, { bankName: string; bankCode?: string; accountType?: string | null }> >({})
  const [bankList, setBankList] = useState<BankInfo[] | null>(null)
  const [selectedBankCode, setSelectedBankCode] = useState<string | null>(null)
  const [accountList, setAccountList] = useState<AccountInfo[] | null>(null)
  const [clientsDirectory, setClientsDirectory] = useState<ClientDirectoryRecord[] | null>(null)
  const [flashClientFields, setFlashClientFields] = useState(false)
  const lastMatchedCompanyRef = useRef<string | null>(null)
  const itemIdRef = useRef(0)
  const [subsidiaryInfo, setSubsidiaryInfo] = useState<{
    englishName?: string
    chineseName?: string
    addressLine1?: string
    addressLine2?: string
    addressLine3?: string
    region?: string
    email?: string
    phone?: string
  } | null>(null)
  const [isSubsidiaryDropdownOpen, setIsSubsidiaryDropdownOpen] = useState(false)
  const [allSubsidiaries, setAllSubsidiaries] = useState<SubsidiaryDoc[] | null>(null)

  useEffect(() => {
    const run = async () => {
      const list = await fetchSubsidiaries()
      setAllSubsidiaries(list)
    }
    void run()
  }, [])


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
        const invoiceRecords = Array.isArray(payload.invoices) ? payload.invoices : []

        setProject(normalizedProject)
        setProjectEditMode("view")
        setClient(normalizedClient)
        setInvoices(invoiceRecords)
        if (invoiceRecords.length > 0) {
          setActiveInvoiceIndex(0)
          setInvoiceMode("idle")
          setDraftInvoice(null)
        } else {
          // Do not auto-enter create mode; surface a clear CTA instead
          setInvoiceMode("idle")
          setDraftInvoice(null)
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

  // Fetch subsidiary info for header card
  useEffect(() => {
    const run = async () => {
      const id = project?.subsidiary?.trim()
      if (!id) { setSubsidiaryInfo(null); return }
      const info = await fetchSubsidiaryById(id)
      setSubsidiaryInfo(info)
    }
    void run()
  }, [project?.subsidiary])



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
      const updates: Record<string, { bankName: string; bankCode?: string; accountType?: string | null }> = {}
      for (const id of missing) {
        try {
          const info = await resolveBankAccountIdentifier(id)
          if (controller.signal.aborted) return
          if (info) {
            updates[id] = { bankName: info.bankName, bankCode: info.bankCode, accountType: info.accountType ?? null }
          }
        } catch {
          // ignore
        }
      }
      if (Object.keys(updates).length > 0) {
        setBankInfoMap((prev) => ({ ...prev, ...updates }))
      }
    }
    void run()
    return () => controller.abort()
  }, [invoices, draftInvoice?.paidTo])

  // Load banks when editing invoice
  useEffect(() => {
    if (invoiceMode === "idle") return
    let cancelled = false
    const load = async () => {
      try {
        if (!bankList) {
          const banks = await listBanks()
          if (!cancelled) setBankList(banks)
        }
        // if we have a paidTo identifier but no selected bank, try to infer from account lookup
        if (draftInvoice?.paidTo && !selectedBankCode) {
          try {
            const info = await lookupAccount(draftInvoice.paidTo)
            if (!cancelled && info?.bankCode) {
              setSelectedBankCode(String(info.bankCode).padStart(3, '0'))
              // fetch accounts for that bank
              const banks = bankList ?? []
              const chosen = banks.find((b) => b.bankCode === String(info.bankCode).padStart(3, '0'))
              if (chosen) {
                const accounts = await listAccounts(chosen)
                if (!cancelled) setAccountList(accounts)
              }
            }
          } catch {}
        }
      } catch {}
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [invoiceMode, draftInvoice?.paidTo, bankList, selectedBankCode])

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
  }, [project])

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


  // When a bank is selected and the account list is missing, fetch accounts
  useEffect(() => {
    const run = async () => {
      if (invoiceMode === 'idle') return
      if (!selectedBankCode) return
      const found = (bankList ?? []).find((b) => b.bankCode === selectedBankCode)
      if (found) {
        const accounts = await listAccounts(found)
        setAccountList(accounts)
      }
    }
    void run()
  }, [invoiceMode, selectedBankCode, bankList])

  // Measure status buttons after render and on resize; set a uniform width
  useEffect(() => {
    const measure = () => {
      const widths = statusButtonRefs.current
        .map((el) => (el ? Math.ceil(el.getBoundingClientRect().width) : 0))
        .filter((w) => Number.isFinite(w) && w > 0)
      if (widths.length > 0) {
        const max = Math.max(...widths)
        if (!statusButtonWidth || Math.abs(max - statusButtonWidth) > 1) {
          setStatusButtonWidth(max)
        }
      }
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    statusButtonRefs.current.forEach((el) => el && ro.observe(el))
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  const handleBack = useCallback(() => {
    void router.push("/dashboard/new-ui/projects")
  }, [router])

  const isInvoiceDetailsEditable = isEditingInvoiceDetails || invoiceMode === "create"

  const currentInvoiceRecord =
    invoiceMode === "idle" && invoices.length > 0
      ? invoices[Math.min(activeInvoiceIndex, invoices.length - 1)] ?? null
      : null

  // Keep items visible in manage mode even when invoiceMode is idle by
  // falling back to the currently selected invoice when no draft exists.
  const resolvedDraft =
    draftInvoice ?? (currentInvoiceRecord ? buildDraftFromInvoice(currentInvoiceRecord, client, project) : null)

  const resolvedClient = resolvedDraft
    ? resolvedDraft.client
    : buildClientState(currentInvoiceRecord, client, project)

  const editingClient = draftInvoice?.client ?? resolvedClient
  const handleToggleInvoiceDetails = useCallback(() => {
    if (invoices.length === 0) {
      return
    }
    if (!isEditingInvoiceDetails) {
      const reference = invoices[activeInvoiceIndex] ?? null
      if (reference && project) {
        setDraftInvoice(buildDraftFromInvoice(reference, client, project))
        if (invoiceMode === "idle") {
          setInvoiceMode("edit")
        }
        setIsEditingInvoiceDetails(true)
      }
      return
    }
    setIsEditingInvoiceDetails(false)
    setDraftInvoice(null)
    if (!isManagingInvoices && invoiceMode !== "create") {
      setInvoiceMode("idle")
    }
  }, [activeInvoiceIndex, client, invoiceMode, invoices, isEditingInvoiceDetails, isManagingInvoices, project])


  // Autofill client details when company name matches our directory
  useEffect(() => {
    const run = async () => {
      if (invoiceMode === "idle") return
      const name = draftInvoice?.client?.companyName?.trim()
      if (!name) return
      try {
        const list = clientsDirectory ?? (await fetchClientsDirectory())
        if (!clientsDirectory) setClientsDirectory(list)
        const lower = name.toLowerCase()
        const match = list.find((c) => {
          const byName = typeof c.companyName === "string" && c.companyName.trim().toLowerCase() === lower
          const byId = typeof (c as any).documentId === "string" && (c as any).documentId.trim().toLowerCase() === lower
          return byName || byId
        })
          if (match) {
            setDraftInvoice((prev) => {
              if (!prev) return prev
              const current = prev.client ?? ({} as any)
              return {
                ...prev,
                client: {
                  companyName: current.companyName ?? (match.companyName ?? null),
                  addressLine1: current.addressLine1 ?? (match.addressLine1 ?? null),
                  addressLine2: current.addressLine2 ?? (match.addressLine2 ?? null),
                  addressLine3: current.addressLine3 ?? (match.addressLine3 ?? null),
                  region: current.region ?? (match.region ?? (match as any).addressLine5 ?? null),
                  representative: current.representative ?? ((match.title ? `${match.title} ` : '') + (match.representative ?? '')),
                },
              }
            })
            lastMatchedCompanyRef.current = match.companyName?.toLowerCase() ?? null
            setFlashClientFields(false)
            requestAnimationFrame(() => {
              setFlashClientFields(true)
              setTimeout(() => setFlashClientFields(false), 700)
            })
          } else {
          // If previously matched but now no longer matches, clear autofilled fields.
          if (lastMatchedCompanyRef.current) {
            lastMatchedCompanyRef.current = null
            setDraftInvoice((prev) => {
              if (!prev) return prev
              const current = prev.client ?? ({} as any)
              return {
                ...prev,
                client: {
                  companyName: current.companyName ?? null,
                  addressLine1: null,
                  addressLine2: null,
                  addressLine3: null,
                  region: null,
                  representative: null,
                },
              }
            })
            setFlashClientFields(true)
            setTimeout(() => setFlashClientFields(false), 600)
          }
        }
      } catch {
        // ignore
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftInvoice?.client?.companyName, invoiceMode])

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
    if (clearedCount === totalInvoiceCount) {
      return "All Cleared"
    }
    if (clearedCount === 0) {
      return "All Due"
    }
    return "Partially"
  }, [clearedCount, totalInvoiceCount])

  const totalPaidOnText = useMemo(() => {
    if (clearedCount === 0) {
      return "-"
    }
    return formatProjectDate(lastPaidIso, lastPaidDisplay)
  }, [clearedCount, lastPaidDisplay, lastPaidIso])

  // Toggle for compact vs. full address in client view
  const [showFullAddress, setShowFullAddress] = useState(false)
  const compactAddress = useMemo(() => {
    const parts = [
      resolvedClient?.addressLine1,
      resolvedClient?.addressLine2,
      resolvedClient?.addressLine3,
      resolvedClient?.region,
    ].filter((p) => typeof p === 'string' && (p as string).trim().length > 0) as string[]
    const text = parts.join(', ')
    return text.length > 120 ? `${text.slice(0, 120)}…` : text
  }, [resolvedClient?.addressLine1, resolvedClient?.addressLine2, resolvedClient?.addressLine3, resolvedClient?.region])

  const invoiceEntries = useMemo(() => {
    const entries = invoices.map((invoice, index) => {
      const rawAmount =
        typeof invoice.total === "number" && !Number.isNaN(invoice.total)
          ? invoice.total
          : typeof invoice.amount === "number" && !Number.isNaN(invoice.amount)
          ? invoice.amount
          : null
      const paidOnFormatted = formatProjectDate(invoice.paidOnIso ?? null, invoice.paidOnDisplay ?? null)

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
      const displayBankName = payToInfo?.bankName
        ? (() => {
            // Build acronym for long names (>=4 tokens), ignoring lower-case words.
            const tokens = payToInfo.bankName.replace(/-/g, ' ').split(/\s+/).filter(Boolean)
            if (tokens.length >= 4) {
              const letters = tokens
                .filter((t) => /^[A-Z]/.test(t[0] || ''))
                .map((t) => (t[0] || '').toUpperCase())
                .join('')
              return letters.length >= 2 ? letters : payToInfo.bankName
            }
            return payToInfo.bankName
          })()
        : null

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
        displayBankName,
        index,
      }
    })

    // In manage mode (but not currently creating), show a blinking row to add an additional invoice
    if (isManagingInvoices && invoiceMode !== 'create') {
      try { console.log('[ui] add-row-visible', { isManagingInvoices, hasDraft: !!draftInvoice, existing: invoices.length }); } catch {}
      entries.push({
        invoiceNumber: "Add additional invoice",
        pending: false,
        amount: null as any,
        paid: null as any,
        statusLabel: null as any,
        statusColor: "default" as any,
        paidOnText: null as any,
        payToText: null as any,
        payToInfo: null as any,
        displayBankName: null as any,
        collectionId: undefined as any,
        index: invoices.length,
        createNew: true as any,
      } as any)
    }

    if (invoiceMode === "create" && draftInvoice) {
      const pendingIdentifier =
        draftInvoice.paidTo && draftInvoice.paidTo.trim().length > 0
          ? draftInvoice.paidTo.trim()
          : null
      const pendingInfo = pendingIdentifier ? bankInfoMap[pendingIdentifier] ?? null : null
      const pendingDisplayBankName = pendingInfo?.bankName
        ? (() => {
            const tokens = pendingInfo.bankName.replace(/-/g, ' ').split(/\s+/).filter(Boolean)
            if (tokens.length >= 4) {
              const letters = tokens
                .filter((t) => /^[A-Z]/.test(t[0] || ''))
                .map((t) => (t[0] || '').toUpperCase())
                .join('')
              return letters.length >= 2 ? letters : pendingInfo.bankName
            }
            return pendingInfo.bankName
          })()
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
        payToInfo: pendingInfo,
        displayBankName: pendingDisplayBankName,
        collectionId: draftInvoice.collectionId,
        index: invoices.length,
      })
    }

    return entries
  }, [
    activeInvoiceIndex,
    draftInvoice,
    invoiceMode,
    isManagingInvoices,
    invoices,
    total,
    totalPaidOnText,
    bankInfoMap,
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

  // PDF export/view state
  const activeInvoice = useMemo(() => (invoices.length > 0 ? invoices[Math.min(activeInvoiceIndex, invoices.length - 1)] ?? null : null), [activeInvoiceIndex, invoices])
  const activeInvoiceHasItems = useMemo(() => {
    const items = (activeInvoice as any)?.items
    return Array.isArray(items) && items.length > 0
  }, [activeInvoice])
  const currentHashModel = useMemo(() => {
    if (!activeInvoice) return null
    return {
      invoiceNumber: activeInvoice.invoiceNumber,
      companyName: activeInvoice.companyName,
      addressLine1: activeInvoice.addressLine1,
      addressLine2: activeInvoice.addressLine2,
      addressLine3: activeInvoice.addressLine3,
      region: activeInvoice.region,
      representative: activeInvoice.representative,
      items: (activeInvoice.items || []).map((it) => ({ title: it.title, subQuantity: it.subQuantity, feeType: it.feeType, notes: it.notes, unitPrice: it.unitPrice, quantity: it.quantity, quantityUnit: it.quantityUnit, discount: it.discount })),
      amount: activeInvoice.amount,
      paymentStatus: activeInvoice.paymentStatus,
      paidTo: activeInvoice.paidTo,
    }
  }, [activeInvoice])
  const currentHash = useMemo(() => {
    if (!currentHashModel) return null
    try { return window.crypto ? null : null } catch { return null }
  }, [currentHashModel])
  const pdfMeta = activeInvoice ? { fileId: (activeInvoice as any).pdfFileId as string | undefined, hash: (activeInvoice as any).pdfHash as string | undefined } : { fileId: undefined, hash: undefined }

  const canViewPdf = !!pdfMeta.fileId && !!pdfMeta.hash
  // Since computing exact hash client-side is non-trivial (needs stable canonicalization), we conservatively show Export if no pdfHash or if editing
  const shouldShowExport = !canViewPdf || invoiceMode !== 'idle'

  const handlePreviewInvoice = useCallback(() => {
    if (!project || !activeInvoice) return
    const url = `/dashboard/new-ui/projects/show/${encodeURIComponent(project.id)}/invoice/${encodeURIComponent(activeInvoice.invoiceNumber)}/preview?year=${encodeURIComponent(project.year)}&projectNumber=${encodeURIComponent(project.projectNumber || '')}`
    window.open(url, '_self')
  }, [activeInvoice, project])

  const handleViewPdf = useCallback(() => {
    if (!pdfMeta.fileId) return
    window.open(`https://drive.google.com/file/d/${encodeURIComponent(pdfMeta.fileId)}/view`, '_blank')
  }, [pdfMeta.fileId])

  const prepareDraft = useCallback(
    (mode: "create" | "edit", targetIndex?: number) => {
      if (!project) {
        return
      }
      if (mode === "create") {
        const draft = buildDraftForNewInvoice(invoices, project, client)
        itemIdRef.current = draft.items.length
        setDraftInvoice(draft)
        setInvoiceMode("create")
        setIsEditingInvoiceDetails(true)
        setActiveInvoiceIndex(invoices.length)
        return
      }
      const index = typeof targetIndex === "number" ? targetIndex : activeInvoiceIndex
      const current = invoices[index]
      if (!current) {
        message.warning("Select an invoice to edit.")
        return
      }
      const draft = buildDraftFromInvoice(current, client, project)
      itemIdRef.current = draft.items.length
      setDraftInvoice(draft)
      setInvoiceMode("edit")
      setActiveInvoiceIndex(index)
    },
    [activeInvoiceIndex, client, invoices, message, project],
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
        } else {
          // pending here means the "create new" blinking row; start creation
          prepareDraft("create")
        }
        return
      }

      if (invoiceMode === "create") {
        // Switch from creating to editing a specific invoice
        prepareDraft("edit", index)
        return
      }

      if (invoiceMode !== "idle" && index !== activeInvoiceIndex) {
        // Switch editing target
        prepareDraft("edit", index)
        return
      }

      if (invoiceMode === "edit" && index === activeInvoiceIndex) {
        return
      }

      prepareDraft("edit", index)
    },
    [activeInvoiceIndex, invoiceMode, prepareDraft, setActiveInvoiceIndex],
  )

  const handlePrimaryInvoiceEdit = useCallback(() => {
    if (invoiceMode === "create") {
      message.warning("Finish creating the current invoice before editing.")
      return
    }
    const entry = invoiceEntries[activeEntryIndex]
    if (!entry) {
      message.warning("Select an invoice to edit.")
      return
    }
    handleBeginInvoiceRowEdit(entry.index, entry.pending)
  }, [activeEntryIndex, handleBeginInvoiceRowEdit, invoiceEntries, invoiceMode, message])

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
      field: "presenterWorkType" | "projectTitle" | "projectNature" | "projectNumber" | "subsidiary",
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
      console.log('[ProjectHeaderSave] updates keys', Object.keys(updatesPayload))
      console.log('[ProjectHeaderSave] projectDate', updatesPayload.projectDate)
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
      console.log('[ProjectHeaderSave] response', response.status)

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
    projectDraft.subsidiary,
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
            subQuantity: "",
            notes: "",
            quantityUnit: "",
            discountInput: "",
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
          if (field === "unitPrice" || field === "quantity") {
            const numericValue =
              typeof value === "number" && !Number.isNaN(value)
                ? value
                : Number(value) || 0
            const updated = {
              ...item,
              [field]: numericValue,
            }
            if (updated.discountInput) {
              const amount = parseDiscountInput(
                updated.discountInput,
                toNumberValue(updated.unitPrice),
                toNumberValue(updated.quantity),
              )
              updated.discount = amount
            }
            return updated
          }
          if (field === "quantityUnit") {
            const stringValue = typeof value === "string" ? value : `${value}`
            const cleaned = stringValue.replace(/^\s*\/+/u, "").trim()
            return { ...item, quantityUnit: cleaned }
          }
          if (field === "discount") {
            const numericValue =
              typeof value === "number" && !Number.isNaN(value)
                ? value
                : Number(value) || 0
            return {
              ...item,
              discount: Math.max(0, numericValue),
              discountInput: numericValue > 0 ? `${numericValue}` : "",
            }
          }
          return { ...item, [field]: typeof value === "string" ? value : `${value}` }
        })
        return { ...previous, items: nextItems }
      })
    },
    [],
  )

  const handleDiscountInputChange = useCallback(
    (key: string, rawValue: string) => {
      const trimmed = rawValue.replace(/\s+/g, " ").trim()
      setDraftInvoice((previous) => {
        if (!previous) {
          return previous
        }
        const nextItems = previous.items.map((item) => {
          if (item.key !== key) {
            return item
          }
          const unitPrice = toNumberValue(item.unitPrice)
          const quantity = toNumberValue(item.quantity)
          const amount = parseDiscountInput(trimmed, unitPrice, quantity)
          return {
            ...item,
            discount: amount,
            discountInput: trimmed,
          }
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


  const handleInvoiceNumberKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault()
        finalizeInvoiceNumberEdit()
      }
      if (event.key === "Escape") {
        event.preventDefault()
        setDraftInvoice((previous) => {
          if (!previous) {
            return previous
          }
          const fallback = previous.originalInvoiceNumber ?? previous.baseInvoiceNumber
          const fallbackBase = extractBaseInvoiceNumber(fallback)
          return { ...previous, invoiceNumber: fallback, baseInvoiceNumber: fallbackBase }
        })
      }
    },
    [finalizeInvoiceNumberEdit],
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
        const draft = buildDraftForNewInvoice([], project, client)
        itemIdRef.current = draft.items.length
        setDraftInvoice(draft)
        setInvoiceMode("create")
        setIsEditingInvoiceDetails(true)
        setActiveInvoiceIndex(0)
      }
      return
    }
    setInvoiceMode("idle")
    setDraftInvoice(null)
    itemIdRef.current = 0
    setActiveInvoiceIndex((previousIndex) =>
      Math.min(previousIndex, Math.max(invoices.length - 1, 0)),
    )
  }, [client, hasInvoices, invoices.length, project])

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

  const handleClientFieldChange = useCallback((field: keyof InvoiceClientState, value: string) => {
    setDraftInvoice((previous) => {
      if (!previous) {
        return previous
      }
      return {
        ...previous,
        client: {
          ...previous.client,
          [field]: value,
        },
      }
    })
  }, [])

  const handleSaveInvoice = useCallback(async () => {
    if (!project || !draftInvoice) {
      return
    }
    // Front-end guard: if nothing changed, avoid hitting the API
    try {
      const current = invoices[activeInvoiceIndex]
      if (current) {
        const sameClient = JSON.stringify({
          companyName: current.companyName ?? null,
          addressLine1: current.addressLine1 ?? null,
          addressLine2: current.addressLine2 ?? null,
          addressLine3: current.addressLine3 ?? null,
          region: current.region ?? null,
          representative: current.representative ?? null,
        }) === JSON.stringify(draftInvoice.client)

        const sameItems = JSON.stringify((current.items ?? []).map(i => ({
          title: i.title ?? '',
          feeType: i.feeType ?? '',
          unitPrice: i.unitPrice ?? 0,
          quantity: i.quantity ?? 0,
          discount: i.discount ?? 0,
          subQuantity: i.subQuantity ?? '',
          notes: i.notes ?? '',
          quantityUnit: i.quantityUnit ?? '',
        }))) === JSON.stringify(draftInvoice.items)

        const sameMeta = (
          (current.taxOrDiscountPercent ?? 0) === (draftInvoice.taxOrDiscountPercent ?? 0) &&
          (current.paymentStatus ?? null) === (draftInvoice.paymentStatus ?? null) &&
          (current.paidTo ?? null) === (draftInvoice.paidTo ?? null) &&
          (current.paidOnIso ?? null) === (draftInvoice.paidOnIso ?? null)
        )

        if (sameClient && sameItems && sameMeta && invoiceMode === 'edit') {
          message.info('No changes made.')
          setInvoiceMode('idle')
          setDraftInvoice(null)
          return
        }
      }
    } catch {}
    const normalizedPaidTo = draftInvoice.paidTo ? draftInvoice.paidTo.trim() : ""
    // Ensure invoiceNumber to save has no leading '#'
    const normalizedInvoiceNumber = (draftInvoice.invoiceNumber ?? '').replace(/^#/, '').trim()
    try {
      setSavingInvoice(true)
      const endpoint = `/api/projects/by-id/${encodeURIComponent(project.id)}/invoices`
      const method = invoiceMode === "create" ? "POST" : "PATCH"
      const payload =
        invoiceMode === "create"
          ? {
              baseInvoiceNumber: draftInvoice.baseInvoiceNumber,
              client: draftInvoice.client,
              items: draftInvoice.items,
              taxOrDiscountPercent: draftInvoice.taxOrDiscountPercent,
              paymentStatus: draftInvoice.paymentStatus,
              paidTo: normalizedPaidTo.length > 0 ? normalizedPaidTo : null,
              paidOn: draftInvoice.paidOnIso ?? null,
              onDate: draftInvoice.paidOnIso ?? null,
            }
          : {
              collectionId: draftInvoice.collectionId,
              invoiceNumber: normalizedInvoiceNumber,
              client: draftInvoice.client,
              items: draftInvoice.items,
              taxOrDiscountPercent: draftInvoice.taxOrDiscountPercent,
              paymentStatus: draftInvoice.paymentStatus,
              paidTo: normalizedPaidTo.length > 0 ? normalizedPaidTo : null,
              paidOn: draftInvoice.paidOnIso ?? null,
              onDate: draftInvoice.paidOnIso ?? null,
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

  const handleDeleteInvoice = useCallback(async (collectionId: string, invoiceNumber: string) => {
    if (!project) return
    try {
      await new Promise<void>((resolve, reject) => {
        Modal.confirm({
          title: 'Delete this invoice?',
          content: `#${invoiceNumber} — this action cannot be undone`,
          okType: 'danger',
          async onOk() {
            try {
              const endpoint = `/api/projects/by-id/${encodeURIComponent(project.id)}/invoices`
              const res = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ collectionId, invoiceNumber }),
              })
              const body = await res.json()
              if (!res.ok) throw new Error(body?.error || 'Delete failed')
              const updated = Array.isArray(body?.invoices) ? body.invoices : []
              setInvoices(updated)
              updateProjectFromInvoices(updated)
              setActiveInvoiceIndex((prev) => Math.max(0, Math.min(prev, Math.max(updated.length - 1, 0))))
              resolve()
            } catch (e) {
              reject(e)
            }
          },
          onCancel() { resolve() },
        })
      })
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }, [message, project, setInvoices, updateProjectFromInvoices])

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
      subQuantity: item.subQuantity,
      notes: item.notes,
      quantityUnit: item.quantityUnit,
      discountInput: item.discountInput,
    }))
    if (isInvoiceDetailsEditable) {
      rows.push({ key: "adder", kind: "adder" })
    }
    return rows
  }, [isInvoiceDetailsEditable, resolvedDraft])

  const itemsColumns = useMemo(
    () => [
      {
        key: "title",
        dataIndex: "title",
        title: <span className="items-heading">Item</span>,
        onCell: (record) => (record.kind === "adder" ? { colSpan: 4 } : {}),
        render: (_: unknown, record: InvoiceTableRow) => {
          if (record.kind === "adder") {
            return (
              <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem} block>
                Add item
              </Button>
            )
          }

          if (!isInvoiceDetailsEditable) {
            const title = record.title?.trim() ? record.title : "N/A"
            const description = record.feeType?.trim() ? record.feeType.trim() : null
            const subQty = record.subQuantity?.trim()
            const notes = record.notes?.trim()
            return (
              <div className="item-display">
                <div className="item-title-row">
                  <div className="item-title-text">{title}</div>
                  <div className="item-subqty-slot">
                    {subQty ? <span className="item-subqty">{subQty}</span> : null}
                  </div>
                </div>
                {description ? <div className="item-description">{description}</div> : null}
                {notes ? <div className="item-notes" style={{ whiteSpace: 'pre-wrap' }}>{notes}</div> : null}
              </div>
            )
          }

            return (
              <div className="item-edit">
                <div className="item-edit-fields">
                  <div className="item-title-row editing">
                    <div className="item-title-input">
                      <Input
                        value={record.title}
                        placeholder="Item title"
                        variant="borderless"
                        onChange={(event) => handleItemChange(record.key, "title", event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="item-subqty-row">
                    <div className="item-subqty-input">
                      <Input
                        value={record.subQuantity ?? ""}
                        placeholder="Sub-Qty"
                        variant="borderless"
                        onChange={(event) => handleItemChange(record.key, "subQuantity", event.target.value)}
                      />
                    </div>
                  </div>
                  <Input.TextArea
                    value={record.feeType}
                    placeholder="Type of Fee"
                    variant="borderless"
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    className="item-description-edit"
                    style={{ fontStyle: 'italic', fontWeight: 200, fontFamily: 'Karla, sans-serif', color: '#374151' }}
                    onFocus={(event) => {
                      try {
                        const el = event.target as HTMLTextAreaElement
                        el.style.fontStyle = 'italic'
                        el.style.fontWeight = '200'
                        el.style.fontFamily = 'Karla, sans-serif'
                        el.style.color = '#374151'
                      } catch {}
                    }}
                    onChange={(event) => handleItemChange(record.key, "feeType", event.target.value)}
                  />
                  <Input.TextArea
                    value={record.notes ?? ""}
                    placeholder="Notes"
                    variant="borderless"
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    className="item-notes-edit"
                    style={{ whiteSpace: "pre-wrap" }}
                    onChange={(event) => handleItemChange(record.key, "notes", event.target.value)}
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
        align: "right",
        onCell: (record) => (record.kind === "adder" ? { colSpan: 0 } : {}),
        render: (value: number | undefined, record: InvoiceTableRow) => {
          if (record.kind === "adder") {
            return null
          }
          if (!isInvoiceDetailsEditable) {
            const unit = record.quantityUnit?.trim()
            return (
              <div className="unit-price-cell">
                <span className="numeric-text">{amountText(value ?? 0)}</span>
                {unit ? <span className="unit-price-unit-text">/{unit}</span> : null}
              </div>
            )
          }
          return (
            <div className="unit-price-edit">
              <InputNumber
                value={value}
                min={-1000000}
                variant="borderless"
                className="numeric-input-right"
                style={{ width: "100%" }}
                onChange={(next) => handleItemChange(record.key, "unitPrice", next ?? 0)}
              />
              <div className="unit-price-unit-edit">
                <Input
                  value={record.quantityUnit ?? ""}
                  placeholder="Unit (e.g., hour)"
                  variant="borderless"
                  className="unit-price-unit-input"
                  prefix={<span className="unit-prefix">/</span>}
                  onChange={(event) => handleItemChange(record.key, "quantityUnit", event.target.value)}
                />
              </div>
            </div>
          )
        },
      },
      {
        key: "quantity",
        dataIndex: "quantity",
        title: <span className="items-heading">Qty</span>,
        width: 100,
        align: "right",
        onCell: (record) => (record.kind === "adder" ? { colSpan: 0 } : {}),
        render: (value: number | undefined, record: InvoiceTableRow) => {
          if (record.kind === "adder") {
            return null
          }
          if (!isInvoiceDetailsEditable) {
            return <span className="numeric-text">{toNumberValue(value)}</span>
          }
          return (
            <InputNumber
              value={value}
              min={0}
              variant="borderless"
              className="numeric-input-right quantity-input"
              style={{ width: "100%" }}
              onChange={(next) => handleItemChange(record.key, "quantity", next ?? 0)}
            />
          )
        },
      },
      {
        key: "total",
        dataIndex: "total",
        title: <span className="items-heading">Total</span>,
        align: "right",
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
          const discountValue = toNumberValue(record.discount)
          if (!isInvoiceDetailsEditable) {
            const hasDiscount = discountValue > 0
            let discountLabel: string | null = null
            if (hasDiscount) {
              const base = toNumberValue(record.unitPrice) * toNumberValue(record.quantity)
              if (base > 0) {
                const percent = (discountValue / base) * 100
                const rounded = Math.round(percent * 10) / 10
                discountLabel = `${rounded % 1 === 0 ? Math.round(rounded) : rounded}% OFF`
              } else {
                discountLabel = `${amountText(discountValue)} OFF`
              }
            }
            return (
              <div className="total-cell">
                <span className="numeric-text">{amountText(lineTotal)}</span>
                {discountValue > 0 && discountLabel ? (
                  <span className="item-discount-chip">{discountLabel}</span>
                ) : null}
              </div>
            )
          }
          return (
            <div className="total-edit">
              <span className="numeric-text">{amountText(lineTotal)}</span>
              <Input
                value={record.discountInput ?? ""}
                placeholder="Discount (e.g., 20% or 150)"
                variant="borderless"
                className="item-discount-input"
                style={{ width: "100%" }}
                onChange={(event) =>
                  handleDiscountInputChange(record.key, event.target.value)
                }
              />
            </div>
          )
        },
      },
    ],
    [handleAddItem, handleDiscountInputChange, handleItemChange, handleRemoveItem, isInvoiceDetailsEditable],
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
          {isProjectEditing ? (
            <div className="descriptor-actions">
                <Button danger onClick={async () => {
                  if (!project) return
                  Modal.confirm({
                    title: 'Delete this project?',
                    content: `#${project.projectNumber} — this action cannot be undone`,
                    okType: 'danger',
                    async onOk() {
                      try {
                        const res = await fetch(`/api/projects/${encodeURIComponent(project.year)}/${encodeURIComponent(project.id)}`, {
                          method: 'DELETE',
                          credentials: 'include',
                        })
                        if (!res.ok) throw new Error('Delete failed')
                        message.success('Project deleted')
                        void router.push('/dashboard/new-ui/projects')
                      } catch (e) {
                        message.error(e instanceof Error ? e.message : 'Delete failed')
                      }
                    }
                  })
                }} disabled={projectEditSaving}>
                  Delete
                </Button>
                <Button className="project-cancel" onClick={cancelProjectEditing} disabled={projectEditSaving}>
                  Cancel
                </Button>
                <Button type="primary" className="project-save" onClick={saveProjectEdits} loading={projectEditSaving}>
                  Save
                </Button>
              </div>
            ) : (
              <span className="descriptor-placeholder" aria-hidden="true" />
            )}
        </div>
        <div className="header-block">
            {subsidiaryInfo ? (
              <div
                className="subsidiary-card"
                onClick={() => isProjectEditing && setIsSubsidiaryDropdownOpen(true)}
                style={{ cursor: isProjectEditing ? "pointer" : "default" }}
              >
                {subsidiaryInfo.englishName ? (
                  <div className="sub-name-en big">{spaceify(subsidiaryInfo.englishName)}</div>
                ) : null}
                {subsidiaryInfo.chineseName ? (
                  <div className="sub-name-zh big">{spaceify(subsidiaryInfo.chineseName)}</div>
                ) : null}
                <div className="sub-address">
                  {subsidiaryInfo.addressLine1 || ''}
                  {subsidiaryInfo.addressLine2 ? (<><br />{subsidiaryInfo.addressLine2}</>) : null}
                  {subsidiaryInfo.addressLine3 ? (<><br />{subsidiaryInfo.addressLine3}</>) : null}
                  {subsidiaryInfo.region ? (<><br />{subsidiaryInfo.region}, Hong Kong</>) : null}
                </div>
                {(subsidiaryInfo.email || subsidiaryInfo.phone) ? (
                  <div className="sub-contact">
                    {subsidiaryInfo.email ? <div className="sub-email">{spaceify(subsidiaryInfo.email)}</div> : null}
                    {subsidiaryInfo.phone ? <div className="sub-phone">{spaceify(String(subsidiaryInfo.phone))}</div> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          <div className="descriptor-line">
            {isProjectEditing ? (
              <Input
                value={projectDraft.projectNumber}
                onChange={(event) => handleProjectDraftChange("projectNumber", event.target.value)}
                placeholder="Project number"
                variant="filled"
                className="descriptor-input"
                disabled={projectEditSaving}
                style={{ width: 160 }}
              />
            ) : (
              <span className="descriptor-number">{project.projectNumber ? `#${project.projectNumber}` : '-'}</span>
            )}
            <span className="descriptor-separator">/</span>
            {isProjectEditing ? (
              <DatePicker
                value={projectDraft.projectDateIso ? dayjs(projectDraft.projectDateIso) : null}
                onChange={handleProjectDateChange}
                format="MMM DD, YYYY"
                allowClear
                variant="filled"
                className="descriptor-picker"
                disabled={projectEditSaving}
                style={{ minWidth: 180 }}
              />
            ) : (
              <span className="descriptor-date">
                {formatProjectDate(project.projectDateIso, project.projectDateDisplay)}
              </span>
            )}
            {!isProjectEditing ? (
              <button
                type="button"
                className="descriptor-edit-trigger inline"
                onClick={startProjectEditing}
                aria-label="Edit project details"
              >
                <EditOutlined />
              </button>
            ) : null}
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
                variant="filled"
                className="presenter-input"
                disabled={projectEditSaving}
                style={{ width: "100%", maxWidth: 480, textAlign: 'left' }}
              />
              ) : (
                <Text className="presenter-type" style={{ display: 'block' }}>{renderMixed(project.presenterWorkType, 'iansui-text', 'karla-label')}</Text>
              )}
              {isProjectEditing ? (
                <Input
                  value={projectDraft.projectTitle}
                  onChange={(event) => handleProjectDraftChange("projectTitle", event.target.value)}
                  placeholder="Project title"
                  variant="filled"
                  className="project-title-input"
                  disabled={projectEditSaving}
                  style={{ width: "100%", maxWidth: 620, textAlign: 'left' }}
                />
              ) : (
                <Title level={2} className="project-title">{renderMixed(project.projectTitle, 'yuji-title', 'karla-label')}</Title>
              )}
              <div className={`nature-row ${isProjectEditing ? "editing" : ""}`}>
                {isProjectEditing ? (
                  <Input
                    value={projectDraft.projectNature}
                    onChange={(event) => handleProjectDraftChange("projectNature", event.target.value)}
                    placeholder="Project nature"
                    variant="filled"
                    className="project-nature-input"
                    disabled={projectEditSaving}
                    style={{ width: "100%", maxWidth: 560 }}
                  />
                ) : (
                  <Text className="project-nature"><em>{renderMixed(project.projectNature, 'yuji-title', 'karla-label')}</em></Text>
                )}
              </div>
              {isProjectEditing ? (
                <div className="subsidiary-row">
                  <Select
                    showSearch
                    value={projectDraft.subsidiary}
                    placeholder="Select Subsidiary"
                    optionFilterProp="children"
                    onChange={(value) => handleProjectDraftChange("subsidiary", value)}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={(allSubsidiaries ?? [] as SubsidiaryDoc[]).map(s => ({ value: s.identifier, label: s.englishName }))}
                    style={{ width: 240 }}
                  />
                </div>
              ) : project.subsidiary ? (
                <div className="subsidiary-row">
                  <Tag className="subsidiary-chip">{subsidiaryInfo?.englishName ? stringOrNA(subsidiaryInfo.englishName) : (project.subsidiary ? '...' : '-')}</Tag>
                </div>
              ) : null}

          </div>
        </div>
        <div className="status-row">
          <div className="status-buttons">
            {STATUS_STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                className={`status-button ${index === 0 ? "first" : ""} ${ index === STATUS_STEPS.length - 1 ? "last" : ""} ${ index <= paymentStatusIndex ? "done" : ""}`}
                ref={(el) => {
                  statusButtonRefs.current[index] = el
                }}
                style={statusButtonWidth ? { width: `${statusButtonWidth}px` } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Card className="details-card billing-card" variant="filled">
            <div className="billing-card-content">
              {(hasInvoices || isManagingInvoices || invoiceMode !== "idle") ? (
                <div className="billing-section-header">
                  <Title level={5} className="section-heading">
                    Billing &amp; Payments
                  </Title>
                  {(invoiceMode === "idle" || isProjectEditing || isManagingInvoices) ? (
                    <div className="billing-header-actions">
                      <Button
                        className="btn-outline manage-invoices"
                        disabled={savingInvoice}
                        onClick={async () => {
                          try { console.log('[ui] manage-toggle', { isManagingInvoices, invoiceMode, hasDraft: !!draftInvoice, invoiceCount: invoices.length }); } catch {}
                          if (isManagingInvoices) {
                            if (draftInvoice) {
                              await handleSaveInvoice()
                            }
                            setIsManagingInvoices(false)
                            setIsEditingInvoiceDetails(false)
                            setInvoiceMode('idle')
                            return
                          }
                          if (isEditingInvoiceDetails) {
                            if (draftInvoice) {
                              await handleSaveInvoice()
                            }
                            setIsEditingInvoiceDetails(false)
                            setDraftInvoice(null)
                            if (invoiceMode !== "create") {
                              setInvoiceMode("idle")
                            }
                            return
                          }
                          // Enter manage mode and start editing details immediately (merged controls)
                          setIsManagingInvoices(true)
                          setIsEditingInvoiceDetails(true)
                          if (invoices.length > 0) {
                            prepareDraft('edit')
                          } else {
                            prepareDraft('create')
                          }
                        }}
                      >
                        {manageButtonLabel}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {(hasInvoices || isManagingInvoices || invoiceMode !== "idle") ? (
                <div className={clsx("billing-layout", { editing: isInvoiceDetailsEditable })}>
              <aside className={clsx("client-panel", { editing: isInvoiceDetailsEditable })} data-section="client">
                <span className="summary-label client-label">Client</span>
                {isInvoiceDetailsEditable ? (
                  <div className="company-block editing">
                    <AutoComplete
                      value={editingClient?.companyName ?? ""}
                      onChange={(value) => handleClientFieldChange("companyName", value)}
                      options={(clientsDirectory ?? []).map((c) => ({ value: c.companyName }))}
                      onSelect={(value) => {
                        const list = clientsDirectory ?? []
                        const match = list.find((c) => c.companyName === value)
                        if (match) {
                          setDraftInvoice((prev) => {
                            if (!prev) return prev
                            return {
                              ...prev,
                              client: {
                                companyName: match.companyName,
                                addressLine1: match.addressLine1 ?? null,
                                addressLine2: match.addressLine2 ?? null,
                                addressLine3: match.addressLine3 ?? null,
                                region: match.region ?? (match as any).addressLine5 ?? null,
                                representative: (match.title ? `${match.title} ` : '') + (match.representative ?? ''),
                              },
                            }
                          })
                          lastMatchedCompanyRef.current = match.companyName?.toLowerCase() ?? null
                          setFlashClientFields(false)
                          requestAnimationFrame(() => {
                            setFlashClientFields(true)
                            setTimeout(() => setFlashClientFields(false), 700)
                          })
                        }
                      }}
                      placeholder="Company name"
                      className={`client-input company company-autocomplete ${flashClientFields ? 'flash-fill' : ''}`}
                      style={{ textAlign: 'left', width: '100%' }}
                      filterOption={(inputValue, option) =>
                        String(option?.value ?? '').toLowerCase().includes(inputValue.toLowerCase())
                      }
                    />
                    <div className="client-input-group">
                      <Input
                        value={editingClient?.addressLine1 ?? ""}
                        onChange={(event) => handleClientFieldChange("addressLine1", event.target.value)}
                        placeholder="Address line 1"
                        variant="borderless"
                        className={`client-input ${flashClientFields ? 'flash-fill' : ''}`}
                        style={{ textAlign: 'left' }}
                      />
                      <Input
                        value={editingClient?.addressLine2 ?? ""}
                        onChange={(event) => handleClientFieldChange("addressLine2", event.target.value)}
                        placeholder="Address line 2"
                        variant="borderless"
                        className={`client-input ${flashClientFields ? 'flash-fill' : ''}`}
                        style={{ textAlign: 'left' }}
                      />
                      <Input
                        value={editingClient?.addressLine3 ?? ""}
                        onChange={(event) => handleClientFieldChange("addressLine3", event.target.value)}
                        placeholder="Address line 3"
                        variant="borderless"
                        className={`client-input ${flashClientFields ? 'flash-fill' : ''}`}
                        style={{ textAlign: 'left' }}
                      />
                      <Input
                        value={editingClient?.region ?? ""}
                        onChange={(event) => handleClientFieldChange("region", event.target.value)}
                        placeholder="Region"
                        variant="borderless"
                        className={`client-input ${flashClientFields ? 'flash-fill' : ''}`}
                        style={{ textAlign: 'left' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Select
                        placeholder="Title"
                        size="small"
                        value={(() => {
                          const rep = editingClient?.representative ?? ''
                          const m = rep.match(/^(Mr\.|Ms\.|Mrs\.)\s+/i)
                          return m ? m[1] : undefined
                        })()}
                        onChange={(title: string) => {
                          const current = editingClient?.representative ?? ''
                          const nameOnly = current.replace(/^(Mr\.|Ms\.|Mrs\.)\s+/i, '').trim()
                          handleClientFieldChange('representative', `${title} ${nameOnly}`.trim())
                        }}
                        options={[{value:'Mr.',label:'Mr.'},{value:'Ms.',label:'Ms.'},{value:'Mrs.',label:'Mrs.'}]}
                        style={{ width: 100 }}
                        popupMatchSelectWidth={false}
                      />
                      <Input
                        value={(editingClient?.representative ?? "").replace(/^(Mr\.|Ms\.|Mrs\.)\s+/i, '').trim()}
                        onChange={(event) => {
                          const newName = event.target.value
                          const current = editingClient?.representative ?? ''
                          const titleMatch = current.match(/^(Mr\.|Ms\.|Mrs\.)\s+/i)
                          const title = titleMatch ? titleMatch[0] : ''
                          handleClientFieldChange("representative", `${title}${newName}`.trim())
                        }}
                        placeholder="Attention / Representative"
                        variant="borderless"
                        className="client-input"
                        style={{ textAlign: 'left' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="company-block">
                    <div className="company-name">{stringOrNA(resolvedClient?.companyName)}</div>
                    <div className="company-line">{stringOrNA(resolvedClient?.addressLine1)}</div>
                    <div className="company-line">{stringOrNA(resolvedClient?.addressLine2)}</div>
                    <div className="company-line">{stringOrNA(companyLine3)}</div>
                    {resolvedClient?.representative ? (
                      <div className="company-line client-attn">
                        <strong><em>Attn:</em></strong>&nbsp;<strong>{resolvedClient.representative}</strong>
                      </div>
                    ) : null}
                  </div>
                )}                  </aside>
                  <section className="billing-section" data-section="billing">
                    {(hasInvoices || isManagingInvoices || invoiceMode !== "idle") ? (
                      <>
                        <div className="billing-header-actions-container">
                          <span className="summary-label client-label">Invoice</span>
                        </div>
                        {/* Edit Invoice Details merged into Manage button */}
                        <div className="invoice-table">
                          {/* ... invoice table content ... */}
                          {invoiceEntries.length > 0 ? (
                            invoiceEntries.map((entry, index) => {
                              const isActive = index === activeEntryIndex
                              const isEditingRow = invoiceMode !== "idle" && isActive
                              const allowDetailEdit = isInvoiceDetailsEditable && isActive && draftInvoice
                              const isPending = entry.pending
                              const displayNumber =
                                isEditingRow && draftInvoice
                                  ? `#${draftInvoice.invoiceNumber ?? ''}`
                                  : `#${entry.invoiceNumber}`
                              const payToInfo = entry.payToInfo

                              // clicking behavior: in manage mode, begin editing or create new
                              const isCreateNew = (entry as any).createNew === true
                              const handleRowClick = () => {
                                if (isManagingInvoices) {
                                  if (isCreateNew) {
                                    // Start creating a new invoice from the blinking row
                                    prepareDraft("create")
                                  } else {
                                    handleBeginInvoiceRowEdit(index, entry.pending)
                                  }
                                } else {
                                  handleSelectInvoice(index, entry.pending)
                                }
                              }
                              if (isCreateNew) {
                                return (
                                  <div
                                    key={`add-row-${index}`}
                                    role="button"
                                    tabIndex={0}
                                    className={`invoice-row selectable-row pending add-row`}
                                    onClick={handleRowClick}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault()
                                        handleRowClick()
                                      }
                                    }}
                                  >
                                    <div className="invoice-cell add-cell" style={{ gridColumn: '1 / -1' }}>
                                      <span className="create-new-blink">Add additional invoice</span>
                                    </div>
                                  </div>
                                )
                              }
                              return (
                                <div
                                  key={`${entry.invoiceNumber}-${index}`}
                                  role="button"
                                  tabIndex={0}
                                  className={`invoice-row selectable-row ${isActive ? "active" : ""} ${isPending ? "pending" : ""} ${isEditingRow ? "editing" : ""}`}
                                  onClick={handleRowClick}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault()
                                      handleRowClick()
                                    }
                                  }}
                                >
                                  <div className="invoice-cell number">
                                    {allowDetailEdit ? (
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
                                          className={`invoice-number-text ${isEditingRow ? "editing" : ""}`}
                                        >
                                          {displayNumber}
                                        </span>
                                      )}
                                    {isManagingInvoices ? (
                                      <Button
                                        type="text"
                                        danger
                                        size="small"
                                        icon={isPending && invoiceMode === 'create' ? <CloseOutlined /> : <DeleteOutlined />}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (isPending && invoiceMode === 'create') {
                                            // Treat delete on pending row as cancel creation
                                            setInvoiceMode('idle')
                                            setDraftInvoice(null)
                                            setIsEditingInvoiceDetails(false)
                                          } else {
                                            handleDeleteInvoice(entry.collectionId, entry.invoiceNumber)
                                          }
                                        }}
                                      />
                                    ) : null}

                                  </div>
                                  <div className="invoice-cell amount">
                                    {amountText(allowDetailEdit ? total : entry.amount)}
                                  </div>
                                  <div className="invoice-cell status">
                                    {allowDetailEdit ? (
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
                                            popupMatchSelectWidth={false}
                                            style={{ width: 'auto', minWidth: 90 }}
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
                                  <div className="invoice-cell pay-to">
                                    {allowDetailEdit ? (
                                      <div className="bank-selectors" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                        <Select
                                          placeholder="Bank"
                                          size="small"
                                          value={selectedBankCode ?? undefined}
                                          optionLabelProp="collapsedLabel"
                                          onChange={async (code: string) => {
                                            setSelectedBankCode(code)
                                            const found = (bankList ?? []).find((b) => b.bankCode === code)
                                            if (found) {
                                              const accounts = await listAccounts(found)
                                              setAccountList(accounts)
                                            } else {
                                              setAccountList([])
                                            }
                                          }}
                                          options={(bankList ?? []).map((b) => ({
                                            value: b.bankCode,
                                            label: `${b.bankName} (${b.bankCode})`,
                                            collapsedLabel: (
                                              <div className="bank-selected" title={`${b.bankName} (${b.bankCode})`}>
                                                <span className="bank-selected-name">{b.bankName}</span>
                                                <span className="bank-selected-code">({b.bankCode})</span>
                                              </div>
                                            ),
                                          }))}
                                          style={{ width: 160 }}
                                          popupMatchSelectWidth={false}
                                        />
                                        <Select
                                          placeholder="Account"
                                          size="small"
                                          value={draftInvoice.paidTo ?? undefined}
                                          onChange={(val: string) => handlePaidToChange(val)}
                                          options={(accountList ?? []).map((a) => ({ label: a.accountType ? `${a.accountType} Account` : 'Account', value: a.accountDocId }))}
                                          style={{ width: 160 }}
                                          popupMatchSelectWidth={false}
                                        />
                                      </div>
                                    ) : payToInfo ? (
                                      <div className="bank-display">
                                        <Tooltip
                                          title={payToInfo.bankName}
                                          mouseEnterDelay={0}
                                          placement="topRight"
                                          overlayStyle={{ maxWidth: 360 }}
                                                                                     overlayInnerStyle={{ background: '#fff8c2', color: '#0f172a', boxShadow: '0 6px 16px rgba(0,0,0,0.15)', textAlign: 'right', whiteSpace: 'normal', wordBreak: 'break-word' }}                                          overlayClassName="bank-tooltip"
                                        >
                                          <span className="bank-name">{entry.displayBankName || entry.payToText}</span>
                                        </Tooltip>
                                        {payToInfo.accountType ? (
                                          <span className="account-chip">{payToInfo.accountType} Account</span>
                                        ) : null}
                                      </div>
                                    ) : entry.payToText ? (
                                      <span className="bank-name">{entry.payToText}</span>
                                    ) : (
                                      "-"
                                    )}
                                  </div>
                                  <div className="invoice-cell paid-on">
                                    {allowDetailEdit ? (
                                      <DatePicker
                                        value={draftInvoice.paidOnIso ? dayjs(draftInvoice.paidOnIso) : null}
                                        onChange={(v) => {
                                          handlePaidOnChange(v)
                                        }}
                                        variant="borderless"
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
                          {invoices.length > 1 ? (
                            <div className="invoice-row total" role="row">
                              <span className="invoice-cell number total-label">Total:</span>
                              <span className="invoice-cell amount">{amountText(projectTotalValue)}</span>
                              <span className="invoice-cell status total-status">{totalStatusLabel}</span>
                              <span className="invoice-cell pay-to">-</span>
                              <span className="invoice-cell paid-on">{totalPaidOnText}</span>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                    
                    {/* Remove separate Cancel button; use trash on pending row to cancel */}
                  </section>
                  <section className="items-section" data-section="items">
                    <Table
                      dataSource={itemsRows}
                      columns={itemsColumns as any}
                      pagination={false}
                      rowKey="key"
                      className="items-table"
                    />
                    {/* Totals summary panel */}
                    <div className="totals-panel">
                      <div className="totals-row">
                        <span className="meta-label">Sub-total</span>
                        <span className="meta-value">{amountText(subtotal)}</span>
                      </div>
                      <div className="totals-row">
                        <span className="meta-label">Tax/Discount</span>
                        {invoiceMode !== 'idle' ? (
                          <InputNumber
                            min={-100}
                            max={100}
                            step={0.5}
                            value={taxPercent}
                            onChange={(v) => handleTaxChange(typeof v === 'number' ? v : 0)}
                            className="tax-input"
                          />
                        ) : (
                          <span className="meta-value italic">{`${taxPercent}%`}</span>
                        )}
                      </div>
                      <div className="totals-row total">
                        <span className="meta-label">Total</span>
                        <span className="meta-value">{amountText(total)}</span>
                      </div>
                      <div className="totals-row pdf-actions" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        {!shouldShowExport && invoiceMode === 'idle' ? null : (
                          canViewPdf ? <span className="stale-chip" style={{ color: '#b45309', fontSize: 12 }}>Previous invoice is no longer updated.</span> : null
                        )}
                        {shouldShowExport ? (
                          <Tooltip title={activeInvoiceHasItems ? undefined : 'Add at least one item to export'}>
                            <Button size="small" type="primary" onClick={handlePreviewInvoice} disabled={!activeInvoiceHasItems} style={{ marginLeft: 'auto' }}>
                              Export Invoice
                            </Button>
                          </Tooltip>
                        ) : (
                          <Button size="small" onClick={handleViewPdf} style={{ marginLeft: 'auto' }}>View Invoice</Button>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="billing-empty-state">
                  <Empty description="No invoices yet" />
                  <Button
                    className="btn-outline get-started"
                    style={{ fontStyle: 'italic', fontWeight: 700, animation: 'blink 1.2s ease-in-out infinite' }}
                    onClick={() => prepareDraft("create")}
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </div>
        </Card>

              </Space>
                  </div>
                  {/* eslint-disable-next-line react/no-unknown-property */}
                  <style jsx>{`        .page-wrapper {
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
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .header-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
        }

        .descriptor-line {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: ${KARLA_FONT};
          font-weight: 600;
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
          font-weight: 700;
          color: #0f172a;
          line-height: 1.01;
          padding: 0;
        }

        /* Mixed font for CJK vs Latin */
        :global(.project-nature .yuji-title),
        :global(.project-title .yuji-title) {
          font-family: 'Yuji Mai', 'Cantata One', serif !important;
        }
        :global(.project-nature .karla-label),
        :global(.project-title .karla-label),
        :global(.presenter-type .karla-label) {
          font-family: 'Karla', 'Newsreader', sans-serif !important;
        }
        :global(.presenter-type .iansui-text) {
          font-family: 'Iansui', 'Yuji Mai', serif !important;
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
          color: #475569;
          line-height: 1.1;
          margin: 0;
        }
        .project-nature em {
          font-style: italic;
        }

        .project-nature-input {
          font-weight: 500;
          font-style: italic !important;
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

        .descriptor-edit-trigger.inline {
          margin-left: 8px;
        }

        .descriptor-edit-trigger:hover {
          background: #e2e8f0;
        }

        .descriptor-edit-trigger:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }

        .descriptor-placeholder {
          min-width: 40px;
          display: inline-block;
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
          align-items: flex-start;
          text-align: left;
        }

        .company-block.editing {
          align-items: flex-start;
          text-align: left;
          gap: 10px;
        }
        .company-block.editing :global(input) { text-align: left !important; direction: ltr; unicode-bidi: unset; }
        .company-block.editing :global(.ant-select-selector) { direction: ltr; unicode-bidi: unset; }

        :global(.edit-invoice-button.ant-btn) {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          border-radius: 999px;
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
          text-align: right;
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

        .client-input {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          background: #f8fafc;
          box-shadow: inset 0 0 0 1px #cbd5f5;
          border-radius: 10px;
          padding: 6px 10px;
          width: 100%;
        }

        .client-input.company {
          font-size: 18px;
        }

        :global(.client-input.ant-input),
        :global(.client-input.ant-input-affix-wrapper),
        :global(.client-input.ant-input-textarea) {
          background: #f8fafc;
          text-align: left !important;
        }
        .company-autocomplete :global(.ant-select-selector) {
          background: #f8fafc !important;
          box-shadow: inset 0 0 0 1px #cbd5f5;
          border-radius: 10px;
          padding: 3px 10px !important;
          text-align: left;
          display: flex;
          direction: ltr;
          unicode-bidi: unset;
        }
        .company-autocomplete :global(.ant-select-selection-item) { width: 100%;           text-align: left !important; display: flex !important; direction: ltr; unicode-bidi: unset; }
        .company-autocomplete :global(.ant-select-selection-item-content) {           text-align: left !important; display: block; direction: ltr; unicode-bidi: unset; }
        .company-autocomplete :global(.ant-select-selection-placeholder) { width: 100%; text-align: left !important; }
        .company-autocomplete :global(.ant-select-selection-search) { direction: ltr; unicode-bidi: unset; }
        .company-autocomplete :global(.ant-select-selection-search-input) { text-align: left !important; direction: ltr; unicode-bidi: unset; }
        .company-autocomplete :global(.ant-select-selection-search-input input) { text-align: left !important; direction: ltr; unicode-bidi: unset; }
        .company-autocomplete textarea { text-align: left !important; }
        .company-autocomplete.flash-fill :global(.ant-select-selector), .flash-fill { animation: flash-fill 900ms ease-in-out; }
        @keyframes flash-fill {
          0%, 100% { background-color: #f8fafc; }
          50% { background-color: #ffff99; }
        }


        :global(.client-input.ant-input::placeholder) {
          color: #94a3b8;
          font-weight: 500;
        }

        .invoice-number-shell {
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          border-radius: 18px;
          background: #e7f2ff;
          min-width: 0;
        }

        .invoice-number-shell.pending {
          background: #f1f5f9;
          border: 1px dashed #94a3b8;
        }

        .invoice-number-text {
          font-weight: 700;
          font-family: ${KARLA_FONT};
        }

        .invoice-number-pending {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #64748b;
          font-style: italic;
          cursor: default;
        }

        .invoice-number-edit {
          border: none;
          background: none;
          padding: 0;
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #64748b;
          font-style: italic;
          text-align: left;
          cursor: pointer;
        }

        .invoice-number-edit:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
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

        .billing-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 24px 0;
          text-align: center;
        }

        /* Subsidiary info card top-right */
        .subsidiary-card { position: absolute; top: 0; right: 0; text-align: right; }
        .sub-name-en { font-family: 'Cormorant Infant', serif; font-weight: 700; font-size: 10px; color: #000; letter-spacing: 0.08em; white-space: pre-wrap; }
        .sub-name-zh { font-family: 'Iansui', sans-serif; font-weight: 700; font-size: 8px; color: #000; letter-spacing: 0.08em; white-space: pre-wrap; }
        .sub-name-en.big { font-size: 20px; }
        .sub-name-zh.big { font-size: 16px; }
        .sub-address { font-family: 'Cormorant Infant', serif; font-weight: 400; font-size: 11px; color: #000; }
        .sub-contact { font-family: 'Cormorant Infant', serif; font-weight: 700; font-size: 11px; color: #595959; }
        .sub-email, .sub-phone { letter-spacing: 0.08em; white-space: pre-wrap; }




        .subsidiary-card.is-footer {
          position: relative;
          text-align: right;
          margin-top: 24px;
          padding: 16px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
        }


        .billing-layout {
          margin-top: 8px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-areas:
            "client billing"
            "items items";
          gap: 24px;
          align-items: start;
        }



        .billing-section,
        .items-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .billing-section {
          grid-area: billing;
          align-items: flex-start;
          text-align: left;
        }

        .billing-section-header {
          display: flex;
          align-items: flex-end;
          gap: 16px;
        }

        .items-section {
          grid-area: items;
          margin-top: 0;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
        }

        .client-label {
          font-size: 11px;
          align-self: flex-start;
          margin-top: 0;
          text-align: left;
        }

        .client-panel {
          grid-area: client;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
          padding: 8px 0 0;
          align-items: stretch;
          text-align: left;
          margin-top: 0;
        }

        .client-panel.editing { gap: 16px; padding-top: 0; }

        

        /* Outline button style (white with gray border) */
        :global(.btn-outline.ant-btn), .btn-outline {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important; /* slate-300 */
          color: #0f172a !important; /* black-ish */
          font-family: ${KARLA_FONT};
          font-weight: 600;
        }

        .get-started {
          margin-top: 8px;
          font-style: italic;
          font-weight: 700;
          color: #0f172a;
          animation: blink 1.2s ease-in-out infinite;
        }
        /* Ensure inner span inherits italic + blink from AntD Button content */
        .get-started :global(span) {
          font-style: italic !important;
          font-weight: 700 !important;
          animation: blink 1.2s ease-in-out infinite !important;
        }

        /* Blinking create-new row */
        .create-new-blink { font-family: ${KARLA_FONT}; font-weight: 700; font-style: italic; color: #0f172a; animation: blink 1.2s ease-in-out infinite; }

        /* Ensure English (Karla) part of project title is bold */
        :global(.project-title .karla-label) { font-weight: 700 !important; }

        .invoice-table {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-grow: 1;
        }

        .invoice-row {
          display: grid;
          grid-template-columns:
            minmax(140px, max-content)  /* Invoice # */
            minmax(90px, max-content)   /* Amount */
            minmax(90px, max-content)   /* Status */
            minmax(160px, 180px)        /* To (narrowed) */
            minmax(110px, max-content); /* On */
          align-items: center;
          gap: 12px;
          font-family: ${KARLA_FONT};
          justify-items: start;
        }

        .invoice-row.head {
          padding: 0 8px;
          align-items: flex-start;
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
          white-space: normal;
          overflow: visible;
          text-overflow: initial;
        }

        .invoice-cell.number {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .invoice-cell.amount {
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .invoice-cell.status {
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }

        /* Bank column and selectors should not exceed fixed width */
        .invoice-cell.pay-to { width: 160px; max-width: 180px; }
        .bank-selectors { width: 100%; display: flex; flex-direction: column; gap: 6px; }
        .bank-selectors :global(.ant-select) { width: 100%; }
        .bank-selectors :global(.ant-select-selector) { width: 100%; }

        /* Status select narrower */
        .invoice-status-select :global(.ant-select-selector) { min-width: 90px; }

        /* Bank option label with ellipsis and code visible */
        .bank-option { display: grid; grid-template-columns: 1fr auto; gap: 8px; min-width: 0; align-items: start; }
        .bank-option-name { min-width: 0; overflow: visible; white-space: normal; word-break: break-word; }
        .bank-option-code {
          flex: 0 0 auto;
          margin-left: 8px;
        }

        /* Collapsed selection: wrapped name + code at right with soft fade */
        .bank-selected { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; width: 100%; }
        .bank-selected-name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: clip; }
        .bank-selected-code { flex: 0 0 auto; }

        .invoice-cell.pay-to {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          color: #0f172a;
          white-space: normal;
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
          background: #0f766e; /* dark blue green */
          color: #ecfeff;
          font-family: ${KARLA_FONT};
          font-weight: 700;
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

        .invoice-row.head {
          padding: 12px 16px;
        }

        .invoice-row.selectable-row:hover {
          border-color: #cbd5f5;
          background: #f8fafc;
        }

        .invoice-row.selectable-row.active:not(.editing) {
          background: #e0f2fe;
          border-color: #93c5fd;
        }

        .invoice-row.selectable-row.editing {
          background: #fefce8;
          border-color: #fde68a;
          animation: invoice-highlight 1.6s ease-in-out infinite;
        }

        .invoice-row.selectable-row.editing:hover {
          background: #fefce8;
          border-color: #fde68a;
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

        .invoice-status-control { width: fit-content; }

        .invoice-status-select :global(.ant-select-selector) {
          border-radius: 12px !important;
          font-family: ${KARLA_FONT};
          font-weight: 600;
          width: auto !important;
          min-width: 110px;
        }

        .invoice-status-select :global(.ant-select-selection-item) { display: flex; align-items: center; white-space: nowrap; }

        .draft-pill {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #475569;
          font-style: italic;
          animation: blink 1.2s infinite;
        }

        .cta-blink { animation: blink 1.2s ease-in-out infinite; font-style: italic; }

        .billing-actions {
          margin-top: 8px;
        }

        .billing-actions :global(.ant-btn) {
          font-family: ${KARLA_FONT};
          font-weight: 600;
        }

        .items-header {
          margin-bottom: 12px;
          text-align: left;
        }

        .items-header .section-heading {
          text-align: left;
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
          align-items: flex-start;
        }

        .item-title-row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .item-title-text {
          font-family: ${KARLA_FONT};
          font-weight: 500;
          color: #0f172a;
          min-width: 0;
          flex: 1 1 auto;
        }

        .item-title-input {
          flex: 1 1 auto;
          min-width: 0;
        }

        .item-title-input :global(.ant-input) {
          width: 100% !important;
          font-weight: 500;
        }

        .item-subqty-slot {
          flex: 0 0 auto;
          text-align: right;
        }

        .item-subqty {
          font-family: ${KARLA_FONT};
          font-weight: 500;
          color: #475569;
          white-space: nowrap;
          display: inline-block;
        }

        .item-subqty-input {
          flex: 0 0 auto;
        }

        .item-subqty-input :global(.ant-input) {
          width: 140px !important;
          text-align: right;
        }

        .item-description {
          font-family: ${KARLA_FONT};
          font-weight: 200 !important;
          font-style: italic;
          color: #374151;
          display: block;
          white-space: normal;
        }

        .item-description-edit {
          font-style: italic;
          color: #374151;
          font-weight: 200 !important;
        }

        .item-notes {
          font-family: ${KARLA_FONT};
          color: #1f2937;
          font-weight: 300;
          white-space: pre-wrap;
          font-size: 13px;
        }

        .item-notes-edit {
          font-family: ${KARLA_FONT};
          white-space: pre-wrap;
          font-size: 13px;
          font-weight: 300;
        }

        .item-edit {
          display: flex;
          align-items: flex-end;
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
          text-align: right;
          display: block;
        }

        .unit-price-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
          align-items: flex-end;
          text-align: right;
        }

        .unit-price-unit-text {
          font-family: ${KARLA_FONT};
          font-weight: 300;
          color: #475569;
          font-size: 12px;
        }

        .unit-price-edit {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-end;
        }

        .unit-price-unit-edit {
          display: flex;
          align-items: center;
          gap: 4px;
          width: 100%;
          justify-content: flex-end;
        }

        .unit-prefix {
          font-family: ${KARLA_FONT};
          font-weight: 500;
          color: #475569;
        }

        .unit-price-unit-input {
          font-family: ${KARLA_FONT};
          font-weight: 300;
          color: #475569;
          flex: 1 1 auto;
        }

        .unit-price-unit-input :global(.ant-input) {
          font-family: ${KARLA_FONT};
          font-weight: 300;
          color: #475569;
          width: 100%;
          padding-left: 0;
          text-align: right;
        }

        .numeric-input-right :global(.ant-input-number) {
          width: 100%;
        }

        .numeric-input-right :global(.ant-input-number-input) {
          text-align: right;
        }

        .total-cell {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          text-align: right;
        }

        .item-discount-chip {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 999px;
          background: #fee2e2;
          color: #b91c1c;
          font-family: ${KARLA_FONT};
          font-weight: 700;
          font-style: italic;
          font-size: 12px;
          text-transform: uppercase;
        }

        .total-edit {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-end;
          text-align: right;
        }

        .item-discount-input {
          font-family: ${KARLA_FONT};
          width: 100%;
        }

        .item-discount-input :global(.ant-input) {
          text-align: right;
        }

        .invoice-items :global(.ant-table) {
          font-family: ${KARLA_FONT};
        }
        .invoice-items :global(.ant-table-cell) { text-align: inherit; vertical-align: top; }

        .billing-header-actions-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .invoice-detail-toggle {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 12px;
        }

        .totals-panel {
          --totals-label-width: 190px;
          margin-top: 32px;
          margin-right: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: flex-end; /* keep the whole panel on the right */
          align-self: flex-end; /* anchor the block to the right inside items-section */
          position: relative;
          left: -24px; /* nudge left visibly */
        }

        .totals-row {
          display: grid;
          grid-template-columns: var(--totals-label-width) 1fr;
          column-gap: 12px;
          align-items: center;
          justify-content: start;
          width: 100%;
        }
        .totals-row .meta-label { text-align: right; font-size: 13px; }
        .totals-row .meta-value { justify-self: start; text-align: left; font-size: 16px; }
        .totals-row .tax-input { justify-self: start; }

        .totals-row.total .meta-value { font-size: 22px; }

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
          justify-content: flex-end;
        }

        @keyframes invoice-highlight {
          0%,
          100% {
            background-color: #fefce8;
          }
          50% {
            background-color: #fdf2c9;
          }
        }

        @keyframes blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        

        /* Tooltip customizations for bank tooltip */
        :global(.bank-tooltip .ant-tooltip-arrow::before) {
          background: #fff8c2 !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        :global(.bank-tooltip) { opacity: 1; }
        .page-wrapper.flash-page::before { content: ""; position: fixed; inset: 0; background: rgba(255,255,255,1); pointer-events: none; animation: page-flash 900ms ease-in-out forwards; z-index: 9999; }
        @keyframes page-flash { 0% { opacity: 1; } 60% { opacity: 1; } 100% { opacity: 0; } }
                 `}</style>
                 <style jsx global>{`
                    @import url('https://fonts.googleapis.com/css2?family=Yuji+Mai&family=Federo&family=Iansui&family=Karla:wght@300&display=block');
                    /* Global keyframes so inline animation names resolve reliably */
                    @keyframes blink {
                      0%, 100% { opacity: 1; }
                      50% { opacity: 0.3; }
                    }
                    /* Ensure table cells can wrap content like Notes */
                    .items-table .ant-table-cell { white-space: normal; }
                    .ant-table-cell .item-description {
                      font-family: ${KARLA_FONT};
                      font-weight: 200 !important;
                      font-style: italic;
                      color: #374151;
                      display: block;
                      white-space: normal;
                    }

                .item-title-text {
                  font-weight: 500 !important;
                }
                /* Title + Sub-Qty behavior in both modes */
                .items-table .item-title-row { display: flex !important; align-items: center; gap: 8px; flex-wrap: nowrap; }
                .items-table .item-title-input .ant-input, .items-table .item-title-row .ant-input { width: 100% !important; min-width: 0; }
                .items-table .item-subqty-slot { flex: 0 0 auto; text-align: right; }
                .items-table .item-subqty { font-style: italic !important; }
                .items-table .item-subqty-row { margin-top: 4px; }
                /* View mode: inline sub-qty stays compact; Edit mode: sub-qty row aligns left */
                .items-table .item-subqty-input .ant-input { width: 140px !important; }
                .items-table .item-title-row.editing + .item-subqty-row .item-subqty-input .ant-input { text-align: left !important; }
                /* Discount input right aligned in edit mode */
                .items-table .item-discount-input { text-align: right !important; }
                .items-table .total-edit { text-align: right !important; }
                /* Divider above total row */
                .invoice-row.total { border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 12px; }
                    /* Make feeType edit textarea italic (robust selector) */
                    :global(.item-description-edit textarea),
                    :global(.item-description-edit .ant-input),
                    :global(.item-description-edit .ant-input-textarea-show-count > textarea) {
                      font-style: italic !important;
                      font-weight: 200 !important;
                      font-family: ${KARLA_FONT} !important;
                      color: #374151 !important;
                    }

                    :global(.item-notes-edit textarea),
                    :global(.item-notes-edit .ant-input),
                    :global(.item-notes-edit .ant-input-textarea-show-count > textarea) {
                      font-family: ${KARLA_FONT} !important;
                      font-weight: 300 !important;
                      color: #1f2937 !important;
                    }
              `}</style>
          </div>  )
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
