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

import type { ClientDirectoryRecord } from "../../lib/clientDirectory"
import type { ProjectRecord } from "../../lib/projectsDatabase"
import type { ProjectInvoiceRecord } from "../../lib/projectInvoices"
import AppShell from "../new-ui/AppShell"
import {
  amountText,
  mergeLineWithRegion,
  normalizeClient,
  normalizeProject,
  paidDateText,
  paymentChipColor,
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

const invoiceCollectionPattern = /^invoice-([a-z]+)$/
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
  client: InvoiceClientState
  items: InvoiceDraftItem[]
  taxOrDiscountPercent: number
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

const toNumberValue = (value: number | null | undefined) =>
  typeof value === "number" && !Number.isNaN(value) ? value : 0

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
  return indexToLetters(index + 1)
}

const determineNextInvoiceIdentifiers = (
  existing: ProjectInvoiceRecord[],
  baseInvoiceNumber: string,
) => {
  const usedIndexes = new Set<number>()
  existing.forEach((invoice) => {
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
  client: buildClientState(invoice, normalizedClient, project),
  items: (invoice.items ?? []).map((item, index) => ({
    key: `item-${index + 1}`,
    title: item.title ?? "",
    feeType: item.feeType ?? "",
    unitPrice: toNumberValue(item.unitPrice),
    quantity: toNumberValue(item.quantity),
    discount: toNumberValue(item.discount),
  })),
  taxOrDiscountPercent: toNumberValue(invoice.taxOrDiscountPercent),
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
    client: buildClientState(null, normalizedClient, project),
    items: [],
    taxOrDiscountPercent: 0,
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
        const invoiceRecords = Array.isArray(payload.invoices) ? payload.invoices : []

        setProject(normalizedProject)
        setClient(normalizedClient)
        setInvoices(invoiceRecords)

        if (invoiceRecords.length > 0) {
          setActiveInvoiceIndex(0)
          setInvoiceMode("idle")
          setDraftInvoice(null)
        } else {
          const draft = buildDraftForNewInvoice(invoiceRecords, normalizedProject, normalizedClient)
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

  const handleBack = useCallback(() => {
    void router.push("/dashboard/new-ui/projects")
  }, [router])

  const isEditingInvoice = invoiceMode !== "idle"
  const hasInvoices = invoices.length > 0

  const currentInvoiceRecord =
    invoiceMode === "idle" && invoices.length > 0
      ? invoices[Math.min(activeInvoiceIndex, invoices.length - 1)] ?? null
      : null

  const resolvedDraft = isEditingInvoice
    ? draftInvoice
    : currentInvoiceRecord
    ? buildDraftFromInvoice(currentInvoiceRecord, client, project)
    : draftInvoice

  const resolvedClient = resolvedDraft
    ? resolvedDraft.client
    : buildClientState(currentInvoiceRecord, client, project)

  const activeItems = resolvedDraft?.items ?? []
  const subtotal = computeSubtotal(activeItems)
  const taxPercent = resolvedDraft?.taxOrDiscountPercent ?? 0
  const { taxAmount, total } = computeTotals(subtotal, taxPercent)

  const paymentStatusIndex = useMemo(() => {
    let index = 0
    if (hasInvoices) {
      index = 1
    }
    if (project?.paid) {
      index = 2
    }
    return index
  }, [hasInvoices, project?.paid])

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

  const invoiceEntries = useMemo(() => {
    const base = invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      pending: false,
    }))
    if (invoiceMode === "create" && draftInvoice) {
      base.push({ invoiceNumber: draftInvoice.invoiceNumber, pending: !hasInvoices })
    }
    return base
  }, [draftInvoice, hasInvoices, invoiceMode, invoices])

  const selectorHighlightIndex = useMemo(() => {
    if (invoiceMode === "create" && draftInvoice) {
      return invoiceEntries.length - 1
    }
    return Math.min(activeInvoiceIndex, invoiceEntries.length - 1)
  }, [activeInvoiceIndex, draftInvoice, invoiceEntries.length, invoiceMode])

  const selectorHighlightHeight = invoiceEntries.length > 0 ? `${100 / invoiceEntries.length}%` : "0%"

  const invoiceNumberDisplay =
    resolvedDraft?.invoiceNumber ??
    currentInvoiceRecord?.invoiceNumber ??
    baseInvoiceNumber ??
    "N/A"

  const invoiceNumberPending = invoiceMode === "create" && !hasInvoices

  const paidChipKey = paymentChipColor(project?.paid ?? null)
  const paidChipPalette = paymentPalette[paidChipKey] ?? paymentPalette.default
  const paidOnText = paidDateText(project?.paid ?? null, project?.onDateDisplay ?? null)

  const companyLine3 = mergeLineWithRegion(resolvedClient?.addressLine3, resolvedClient?.region)

  const handleSelectInvoice = useCallback(
    (index: number, pending: boolean) => {
      if (pending && invoiceMode === "create") {
        return
      }
      if (invoiceMode !== "idle") {
        message.warning("Finish editing the current invoice before switching.")
        return
      }
      setActiveInvoiceIndex(index)
    },
    [invoiceMode, message],
  )

  const prepareDraft = useCallback(
    (mode: "create" | "edit") => {
      if (!project) {
        return
      }
      if (mode === "create") {
        const draft = buildDraftForNewInvoice(invoices, project, client)
        itemIdRef.current = draft.items.length
        setDraftInvoice(draft)
        setInvoiceMode("create")
        setActiveInvoiceIndex(invoices.length)
        return
      }
      const current = invoices[activeInvoiceIndex]
      if (!current) {
        message.warning("Select an invoice to edit.")
        return
      }
      const draft = buildDraftFromInvoice(current, client, project)
      itemIdRef.current = draft.items.length
      setDraftInvoice(draft)
      setInvoiceMode("edit")
    },
    [activeInvoiceIndex, client, invoices, message, project],
  )

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

  const handleCancelInvoice = useCallback(() => {
    if (!hasInvoices) {
      if (project) {
        const draft = buildDraftForNewInvoice([], project, client)
        itemIdRef.current = draft.items.length
        setDraftInvoice(draft)
        setInvoiceMode("create")
        setActiveInvoiceIndex(0)
      }
      return
    }
    setInvoiceMode("idle")
    setDraftInvoice(null)
    itemIdRef.current = 0
  }, [client, hasInvoices, project])

  const updateProjectFromInvoices = useCallback((nextInvoices: ProjectInvoiceRecord[]) => {
    setProject((previous) => {
      if (!previous) {
        return previous
      }
      const primary = nextInvoices[0]
      if (!primary) {
        return previous
      }
      return {
        ...previous,
        invoice: primary.invoiceNumber ?? previous.invoice,
        amount: primary.total ?? previous.amount,
        clientCompany: primary.companyName ?? previous.clientCompany,
      }
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
      const payload =
        invoiceMode === "create"
          ? {
              baseInvoiceNumber: draftInvoice.baseInvoiceNumber,
              client: draftInvoice.client,
              items: draftInvoice.items,
              taxOrDiscountPercent: draftInvoice.taxOrDiscountPercent,
            }
          : {
              collectionId: draftInvoice.collectionId,
              invoiceNumber: draftInvoice.invoiceNumber,
              client: draftInvoice.client,
              items: draftInvoice.items,
              taxOrDiscountPercent: draftInvoice.taxOrDiscountPercent,
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

  const itemsColumns: ColumnsType<InvoiceTableRow> = useMemo(
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
            return (
              <div className="item-display">
                <span className="item-title-text">{record.title?.trim() ? record.title : "N/A"}</span>
                {record.feeType?.trim() ? (
                  <span className="item-fee-type">{record.feeType}</span>
                ) : null}
              </div>
            )
          }

          return (
            <div className="item-edit">
              <Input
                value={record.title}
                placeholder="Item title"
                bordered={false}
                onChange={(event) => handleItemChange(record.key, "title", event.target.value)}
              />
              <Input
                value={record.feeType}
                placeholder="Fee type"
                bordered={false}
                onChange={(event) => handleItemChange(record.key, "feeType", event.target.value)}
              />
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
        align: "right",
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
        align: "right",
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
  return (
    <div className="page-wrapper">
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          style={{ fontFamily: KARLA_FONT, fontWeight: 600 }}
        >
          Back to Projects
        </Button>
        <div className="header-block">
          <div className="descriptor-line">
            <span className="descriptor-number">{stringOrNA(project.projectNumber)}</span>
            <span className="descriptor-separator">/</span>
            <span className="descriptor-date">
              {formatProjectDateYmd(project.projectDateIso, project.projectDateDisplay)}
            </span>
          </div>
          <div className="title-row">
            <div>
              <Title level={2} className="project-title">
                {stringOrNA(project.projectTitle)}
              </Title>
              <Text className="project-nature">{stringOrNA(project.projectNature)}</Text>
              {project.subsidiary ? (
                <Tag className="subsidiary-chip">{stringOrNA(project.subsidiary)}</Tag>
              ) : null}
            </div>
            <Button
              icon={<EditOutlined />}
              onClick={() => message.info("Project editing is available in the legacy dashboard.")}
              className="project-edit"
            >
              Edit
            </Button>
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
          <Space size={12}>
            {invoiceMode === "idle" && hasInvoices ? (
              <>
                <Button onClick={() => prepareDraft("edit")} icon={<EditOutlined />}>
                  Edit Invoice
                </Button>
                <Button type="primary" onClick={() => prepareDraft("create")}>
                  Additional Invoice
                </Button>
              </>
            ) : null}
            {isEditingInvoice ? (
              <>
                <Button onClick={handleCancelInvoice} disabled={savingInvoice}>
                  Cancel
                </Button>
                <Button type="primary" onClick={handleSaveInvoice} loading={savingInvoice}>
                  {invoiceMode === "create" ? "Confirm Invoice" : "Save Invoice"}
                </Button>
              </>
            ) : null}
          </Space>
        </div>
        <Card className="details-card" bordered={false}>
          <Row gutter={[32, 32]}>
            <Col xs={24} lg={16}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div className="company-block">
                  <div className="company-name">{stringOrNA(resolvedClient?.companyName)}</div>
                  <div className="company-line">{stringOrNA(resolvedClient?.addressLine1)}</div>
                  <div className="company-line">{stringOrNA(resolvedClient?.addressLine2)}</div>
                  <div className="company-line">{stringOrNA(companyLine3)}</div>
                  <div className="company-line">{stringOrNA(resolvedClient?.representative)}</div>
                </div>
                <Divider className="section-divider" />
                <div className="project-meta">
                  <div className="meta-row">
                    <span className="meta-label">Project No.</span>
                    <span className="meta-value">{stringOrNA(project.projectNumber)}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Project</span>
                    <span className="meta-value">{stringOrNA(project.presenterWorkType)}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Project Title</span>
                    <span className="meta-value">{stringOrNA(project.projectTitle)}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Work Type</span>
                    <span className="meta-value italic">{stringOrNA(project.projectNature)}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Project Pickup Date</span>
                    <span className="meta-value">
                      {formatProjectDateYmd(project.projectDateIso, project.projectDateDisplay)}
                    </span>
                  </div>
                </div>
                <Divider className="section-divider" />
                <div className="payment-overview">
                  <Title level={5} className="section-heading">
                    Payment Overview
                  </Title>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <div className="meta-row">
                        <span className="meta-label">Amount</span>
                        <span className="meta-value">{amountText(total)}</span>
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div className="meta-row">
                        <span className="meta-label">Payment Status</span>
                        <Tag
                          color={paidChipPalette.backgroundColor}
                          className="status-chip"
                          style={{ color: paidChipPalette.color }}
                        >
                          {paymentChipLabel(project.paid)}
                        </Tag>
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div className="meta-row">
                        <span className="meta-label">Paid On</span>
                        <span className="meta-value">{paidOnText}</span>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Space>
            </Col>
            <Col xs={24} lg={8}>
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <div className="invoice-summary">
                  <div className="summary-row">
                    <span className="summary-label">Invoice Number</span>
                    <span className={`summary-value ${invoiceNumberPending ? "pending" : ""}`}>
                      {invoiceNumberDisplay}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Amount</span>
                    <span className="summary-value">{amountText(total)}</span>
                  </div>
                </div>
                <div className="invoice-selector">
                  <div
                    className="selector-highlight"
                    style={{
                      height: selectorHighlightHeight,
                      transform: `translateY(${selectorHighlightIndex * 100}%)`,
                    }}
                  />
                  {invoiceEntries.length === 0 ? (
                    <span className="selector-empty">No invoices yet</span>
                  ) : (
                    invoiceEntries.map((entry, index) => (
                      <button
                        key={entry.invoiceNumber}
                        type="button"
                        className={`selector-item ${index === selectorHighlightIndex ? "active" : ""} ${
                          entry.pending ? "pending" : ""
                        }`}
                        onClick={() => handleSelectInvoice(index, entry.pending)}
                      >
                        {entry.invoiceNumber}
                      </button>
                    ))
                  )}
                </div>
              </Space>
            </Col>
          </Row>
          <Divider className="section-divider" />
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div className="items-header">
              <Title level={4} className="section-heading">
                Items / Services
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
          </Space>
        </Card>
      </Space>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx>{`
        .page-wrapper {
          padding: 32px 24px 48px;
          background: #f8fafc;
          min-height: 100%;
          font-family: ${KARLA_FONT};
        }

        .loading-state {
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 64px 16px;
        }

        .header-block {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .descriptor-line {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-family: ${KARLA_FONT};
          font-weight: 600;
        }

        .descriptor-number {
          color: #0f172a;
          font-size: 18px;
        }

        .descriptor-separator {
          color: #94a3b8;
        }

        .descriptor-date {
          color: #64748b;
          font-style: italic;
        }

        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          flex-wrap: wrap;
        }

        .project-title {
          margin: 0;
          font-family: ${KARLA_FONT};
          font-weight: 700;
          color: #0f172a;
        }

        .project-nature {
          display: block;
          margin-top: 4px;
          font-family: ${KARLA_FONT};
          font-weight: 500;
          font-style: italic;
          color: #475569;
        }

        .subsidiary-chip {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          background: #e0f2fe;
          color: #0c4a6e;
          border-radius: 999px;
          border: none;
          margin-top: 8px;
          padding: 4px 14px;
        }

        .project-edit {
          background: #ffffff;
          border-radius: 24px;
          border: 1px solid #cbd5f5;
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #1e293b;
        }

        .status-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
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

        .project-meta {
          display: grid;
          gap: 12px;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
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

        .payment-overview {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .section-heading {
          font-family: ${KARLA_FONT};
          font-weight: 700;
          margin: 0;
          color: #0f172a;
        }

        .status-chip {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          border-radius: 999px;
          border: none;
          padding: 2px 16px;
        }

        .invoice-summary {
          background: #f8fafc;
          border-radius: 18px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
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
          font-weight: 700;
          color: #0f172a;
        }

        .summary-value.pending {
          color: #94a3b8;
          font-style: italic;
          animation: blink 1.2s ease-in-out infinite;
        }

        .invoice-selector {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 18px;
          background: #f1f5f9;
          overflow: hidden;
        }

        .selector-highlight {
          position: absolute;
          left: 8px;
          right: 8px;
          top: 8px;
          border-radius: 999px;
          background: rgba(47, 143, 157, 0.12);
          transition: transform 0.3s ease;
        }

        .selector-item {
          position: relative;
          background: none;
          border: none;
          text-align: left;
          padding: 8px 12px;
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
          z-index: 1;
          border-radius: 999px;
        }

        .selector-item.pending {
          color: #94a3b8;
        }

        .selector-item.active {
          color: #0f172a;
        }

        .selector-empty {
          font-family: ${KARLA_FONT};
          font-weight: 500;
          color: #94a3b8;
          z-index: 1;
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
        }

        .item-title-text {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
        }

        .item-fee-type {
          font-family: ${KARLA_FONT};
          font-weight: 500;
          color: #475569;
          font-style: italic;
        }

        .item-edit {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          align-items: center;
          gap: 8px;
        }

        .numeric-text {
          font-family: ${KARLA_FONT};
          font-weight: 600;
          color: #0f172a;
        }

        .invoice-items :global(.ant-table) {
          font-family: ${KARLA_FONT};
        }

        .totals-panel {
          margin-top: 8px;
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

        .section-divider {
          margin: 12px 0;
          border-block-start-color: #e2e8f0;
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
