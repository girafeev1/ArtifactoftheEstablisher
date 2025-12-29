import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore"

import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from "./firebase"
import { normalizeRepresentative, parseRepresentativeString, type RepresentativeInfo } from "./representative"

const API_TIMEOUT_MS = 15000

const alphabet = "abcdefghijklmnopqrstuvwxyz"

// New nested layout (preferred):
// projects/{year}/projects/{projectId}
const PROJECTS_ROOT = "projects"
const PROJECTS_SUBCOLLECTION = "projects"
const UPDATE_LOG_COLLECTION = "updateLogs"

const POSITIVE_PAYMENT_STATUSES = new Set([
  "paid",
  "cleared",
  "received",
  "complete",
  "completed",
  "settled",
])

const NEGATIVE_PAYMENT_STATUSES = new Set([
  "unpaid",
  "due",
  "pending",
  "outstanding",
  "draft",
  "incomplete",
  "awaiting",
])

const invoiceCollectionPattern = /^invoice-([a-z]+)$/
const SINGLE_INVOICE_COLLECTION_ID = "invoice"
const legacyInvoiceDocumentIdPattern = /^#?\d{4}-\d{3}-\d{4}(?:-?[a-z]+)?$/i
const LEGACY_INVOICE_COLLECTION_IDS = new Set(["Invoice", "invoice"])

const isSupportedInvoiceCollection = (id: string): boolean =>
  id === SINGLE_INVOICE_COLLECTION_ID || invoiceCollectionPattern.test(id) || LEGACY_INVOICE_COLLECTION_IDS.has(id)

const toStringValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value.trim() || null
  }
  if (value instanceof String) {
    const trimmed = value.toString().trim()
    return trimmed || null
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    return `${value}`.trim() || null
  }
  return null
}

const toNumberValue = (value: unknown): number | null => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const toTimestamp = (value: unknown): Timestamp | null => {
  if (value instanceof Timestamp) {
    return value
  }
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    "nanoseconds" in value &&
    typeof (value as any).seconds === "number" &&
    typeof (value as any).nanoseconds === "number"
  ) {
    const { seconds, nanoseconds } = value as { seconds: number; nanoseconds: number }
    return new Timestamp(seconds, nanoseconds)
  }
  return null
}

const toIsoString = (value: unknown): string | null => {
  const ts = toTimestamp(value)
  if (ts) {
    const date = ts.toDate()
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  if (typeof value === "string") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }
  return null
}

const toBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return null
    }
    if (["true", "yes", "paid", "cleared", "1"].includes(normalized)) {
      return true
    }
    if (["false", "no", "unpaid", "due", "0", "pending"].includes(normalized)) {
      return false
    }
  }
  return null
}

const formatDisplayDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })

const toDisplayDate = (value: unknown): string | null => {
  const iso = toIsoString(value)
  if (iso) {
    const parsed = new Date(iso)
    if (!Number.isNaN(parsed.getTime())) {
      return formatDisplayDate(parsed)
    }
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null
    }
    return formatDisplayDate(value)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return null
    }
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return formatDisplayDate(parsed)
    }
    return trimmed
  }

  return null
}

const resolvePaidFlag = (value: unknown, status: string | null): boolean | null => {
  const direct = toBooleanValue(value)
  if (direct !== null) {
    return direct
  }
  if (!status) {
    return null
  }
  const normalized = status.trim().toLowerCase()
  if (POSITIVE_PAYMENT_STATUSES.has(normalized)) {
    return true
  }
  if (NEGATIVE_PAYMENT_STATUSES.has(normalized)) {
    return false
  }
  return null
}

const sanitizePaymentStatus = (status: string | null, paid: boolean | null): string | null => {
  if (status) {
    const trimmed = status.trim()
    if (trimmed.length === 0) {
      return null
    }
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }
  if (paid === true) {
    return "Cleared"
  }
  if (paid === false) {
    return "Due"
  }
  return null
}

const indexToLetters = (index: number) => {
  if (index < 0) {
    throw new Error("Index must be non-negative")
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

const normalizeLogValue = (value: unknown): unknown => {
  if (value === undefined) {
    return null
  }
  if (value === null) {
    return null
  }
  if (value instanceof Timestamp) {
    const date = value.toDate()
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeLogValue(entry))
  }
  if (typeof value === "object") {
    if ("_methodName" in (value as Record<string, unknown>)) {
      const methodName = (value as Record<string, unknown>)._methodName
      if (typeof methodName === "string" && methodName.toLowerCase().includes("delete")) {
        return null
      }
      if (typeof methodName === "string" && methodName.toLowerCase().includes("servertimestamp")) {
        return "__server_timestamp__"
      }
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, normalizeLogValue(entry)]),
    )
  }
  return value
}

const computeDocumentDiff = (
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): Array<{ field: string; before: unknown; after: unknown }> => {
  const fields = new Set([...Object.keys(previous), ...Object.keys(next)])
  const diffs: Array<{ field: string; before: unknown; after: unknown }> = []

  fields.forEach((field) => {
    const before = normalizeLogValue(field in previous ? previous[field] : null)
    const after = normalizeLogValue(field in next ? next[field] : null)
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diffs.push({ field, before, after })
    }
  })

  return diffs
}

const logInvoiceChanges = async (
  invoiceRef: ReturnType<typeof doc>,
  changes: Array<{ field: string; before: unknown; after: unknown }>,
  editedBy: string,
) => {
  const filtered = changes.filter(
    (change) => change.field !== 'updatedAt' && change.field !== 'updatedBy',
  )
  if (filtered.length === 0) {
    return
  }

  const logsCollection = collection(invoiceRef, UPDATE_LOG_COLLECTION)
  await Promise.all(
    filtered.map((change) =>
      addDoc(logsCollection, {
        field: change.field,
        previousValue: change.before,
        newValue: change.after,
        editedBy,
        timestamp: serverTimestamp(),
      }),
    ),
  )
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

const indexToSuffix = (index: number) => {
  if (index <= 0) {
    return ""
  }
  return indexToLetters(index)
}

export const listInvoiceCollectionIds = async (year: string, projectId: string): Promise<string[]> => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const projectKey = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  if (!apiKey || !projectKey) {
    console.warn("[projectInvoices] Missing Firebase configuration when listing invoice collections")
    return []
  }

  // Try nested document path first: projects/{year}/projects/{projectId}
  const nestedUrl = `https://firestore.googleapis.com/v1/projects/${projectKey}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents/${encodeURIComponent(
    PROJECTS_ROOT,
  )}/${encodeURIComponent(year)}/${encodeURIComponent(PROJECTS_SUBCOLLECTION)}/${encodeURIComponent(
    projectId,
  )}:listCollectionIds?key=${apiKey}`
  const legacyUrl = `https://firestore.googleapis.com/v1/projects/${projectKey}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents/${encodeURIComponent(
    year,
  )}/${encodeURIComponent(projectId)}:listCollectionIds?key=${apiKey}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    let response = await fetch(nestedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageSize: 200 }),
      signal: controller.signal,
    })
    // If nested path fails (404), try legacy
    if (!response.ok) {
      try {
        response = await fetch(legacyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageSize: 200 }),
          signal: controller.signal,
        })
      } catch {
        // swallow; we'll handle below
      }
    }

    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(
        "[projectInvoices] Failed to list invoice collection IDs",
        response.status,
        response.statusText,
      )
      return []
    }

    const payload = (await response.json().catch(() => ({}))) as {
      collectionIds?: string[]
      error?: { message?: string }
    }

    if (payload.error) {
      console.warn("[projectInvoices] listCollectionIds returned error", payload.error)
      return []
    }

    const ids = payload.collectionIds?.filter((id) => isSupportedInvoiceCollection(id)) ?? []
    const set = new Set<string>([SINGLE_INVOICE_COLLECTION_ID, ...ids])
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  } catch (error) {
    console.warn("[projectInvoices] listInvoiceCollectionIds failed", error)
    return []
  }
}

export interface ProjectInvoiceItemRecord {
  title: string | null
  feeType: string | null
  unitPrice: number | null
  quantity: number | null
  discount: number | null
  subQuantity: string | null
  notes: string | null
  quantityUnit: string | null
}

export type InvoiceRecordStatus = 'active' | 'deleted'

/**
 * @deprecated Payment data is now derived from transactions at API time.
 * This type is kept for backwards compatibility but is no longer stored on invoices.
 * See enrichInvoicesWithPaymentData() in the invoice API.
 */
export interface LinkedTransaction {
  transactionId: string    // ID in accounting/transactions/entries
  amount: number           // Amount applied from this transaction
  linkedAt: string         // ISO timestamp
  linkedBy: string         // User who performed match
}

export interface ProjectInvoiceRecord {
  collectionId: string
  invoiceNumber: string
  baseInvoiceNumber: string
  suffix: string
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  region: string | null
  representative: RepresentativeInfo | null
  subtotal: number | null
  taxOrDiscountPercent: number | null
  total: number | null
  amount: number | null
  paid: boolean | null
  paidOnIso: string | null
  paidOnDisplay: string | null
  paidTo: string | null
  paymentStatus: string | null
  items: ProjectInvoiceItemRecord[]
  createdAt?: string | null
  updatedAt?: string | null
  // Optional PDF metadata
  pdfFileId?: string | null
  pdfHash?: string | null
  pdfGeneratedAt?: string | null
  // Soft delete fields
  recordStatus?: InvoiceRecordStatus
  deletedAt?: string | null
  deletedBy?: string | null
  // Payment fields - DERIVED from transactions at API time, not stored on invoice
  // See enrichInvoicesWithPaymentData() in invoice API
  linkedTransactions?: LinkedTransaction[]  // Deprecated - no longer stored
  amountPaid?: number  // Derived from transaction matchedInvoices
}

const computeRecordLineTotal = (item: ProjectInvoiceItemRecord) => {
  const unitPrice = toNumberValue(item.unitPrice) ?? 0
  const quantity = toNumberValue(item.quantity) ?? 0
  const discount = toNumberValue(item.discount) ?? 0
  const total = unitPrice * quantity - discount
  return total > 0 ? total : 0
}

const computeRecordSubtotal = (items: ProjectInvoiceItemRecord[]) =>
  items.reduce((sum, item) => sum + computeRecordLineTotal(item), 0)

const computeRecordTotals = (
  items: ProjectInvoiceItemRecord[],
  taxOrDiscountPercent: number | null | undefined,
) => {
  const subtotal = computeRecordSubtotal(items)
  if (taxOrDiscountPercent === null || taxOrDiscountPercent === undefined) {
    return { subtotal, total: subtotal }
  }
  const adjustment = subtotal * (taxOrDiscountPercent / 100)
  return { subtotal, total: subtotal + adjustment }
}

const buildItemsFromData = (data: Record<string, unknown>): ProjectInvoiceItemRecord[] => {
  const items: ProjectInvoiceItemRecord[] = []
  const count = toNumberValue(data.itemsCount) ?? undefined
  let index = 1
  const maxIterations = count && count > 0 ? count : 25

  for (; index <= maxIterations; index += 1) {
    const title = toStringValue(data[`item${index}Title`])
    const feeType = toStringValue(data[`item${index}FeeType`])
    const unitPrice = toNumberValue(data[`item${index}UnitPrice`])
    const quantity = toNumberValue(data[`item${index}Quantity`])
    const discount = toNumberValue(data[`item${index}Discount`])
    const subQuantity = toStringValue(data[`item${index}SubQuantity`])
    const notes = toStringValue(data[`item${index}Notes`])
    const quantityUnit = toStringValue(data[`item${index}QuantityUnit`])

    const hasValue =
      title !== null ||
      feeType !== null ||
      unitPrice !== null ||
      quantity !== null ||
      discount !== null ||
      subQuantity !== null ||
      notes !== null ||
      quantityUnit !== null

    if (!hasValue) {
      if (count) {
        continue
      }
      break
    }

    items.push({ title, feeType, unitPrice, quantity, discount, subQuantity, notes, quantityUnit })
  }

  return items
}

const buildInvoiceRecord = (
  collectionId: string,
  invoiceNumber: string,
  data: Record<string, unknown>,
): ProjectInvoiceRecord => {
  let suffix = ""
  let baseInvoiceNumber = invoiceNumber

  const hyphenatedMatch = invoiceNumber.match(/^(#?.*?)-([a-z]+)$/i)
  if (hyphenatedMatch) {
    baseInvoiceNumber = hyphenatedMatch[1]
    suffix = hyphenatedMatch[2]
  } else {
    const trailingMatch = invoiceNumber.match(/^(#?\d{4}-\d{3}-\d{4})([a-z]+)$/i)
    if (trailingMatch) {
      baseInvoiceNumber = trailingMatch[1]
      suffix = trailingMatch[2]
    }
  }

  const items = buildItemsFromData(data)
  const taxOrDiscountPercent = toNumberValue(data.taxOrDiscountPercent) ?? null
  const aggregates = computeRecordTotals(items, taxOrDiscountPercent)
  const subtotal = toNumberValue(data.subtotal) ?? aggregates.subtotal
  const total = toNumberValue(data.total) ?? aggregates.total
  const amount = toNumberValue(data.amount) ?? total
  const rawPaymentStatus = toStringValue(
    data.paymentStatus ??
      data.status ??
      data.invoiceStatus ??
      data.payment_status ??
      data.paymentStatusLabel ??
      null,
  )
  const paid = resolvePaidFlag(
    data.paid ?? data.paymentReceived ?? data.invoicePaid ?? data.paymentComplete,
    rawPaymentStatus,
  )
  const paidOnSource =
    data.paidOn ??
    data.paidOnDate ??
    data.paymentReceivedOn ??
    data.paymentDate ??
    data.onDate ??
    data.paidDate ??
    data.receivedOn
  const paidOnIso = toIsoString(paidOnSource)
  const paidOnDisplay =
    toDisplayDate(data.paidOnDisplay ?? paidOnSource) ?? (paidOnIso ? toDisplayDate(paidOnIso) : null)
  const paidTo = toStringValue(data.paidTo ?? data.paymentRecipient ?? data.payTo)
  const paymentStatus = sanitizePaymentStatus(rawPaymentStatus, paid)

  // Representative is now stored as a map:
  // representative: { title, firstName, lastName }
  // Legacy records stored a single string (often including the title) and/or a
  // separate `title` field. Normalize both shapes into RepresentativeInfo.
  let representative: RepresentativeInfo | null = normalizeRepresentative(data.representative) ?? null
  const legacyTitle = toStringValue((data as any).title)
  if (representative && !representative.title && legacyTitle) {
    representative = { ...representative, title: legacyTitle }
  }

  if (!representative) {
    let legacyName = toStringValue((data as any).representative)

    if (legacyTitle && legacyName) {
      const normalizedTitle = legacyTitle.toLowerCase()
      if (legacyName.toLowerCase().startsWith(normalizedTitle)) {
        legacyName = legacyName.slice(legacyTitle.length).trimStart()
      }
    }

    if (legacyTitle || legacyName) {
      representative = parseRepresentativeString(
        `${legacyTitle ? `${legacyTitle} ` : ""}${legacyName ?? ""}`.trim(),
      )
    }
  }

  return {
    collectionId,
    invoiceNumber,
    baseInvoiceNumber,
    suffix,
    companyName: toStringValue(data.companyName),
    addressLine1: toStringValue(data.addressLine1),
    addressLine2: toStringValue(data.addressLine2),
    addressLine3: toStringValue(data.addressLine3),
    region: toStringValue(data.region),
    representative,
    subtotal,
    taxOrDiscountPercent,
    total,
    amount,
    paid,
    paidOnIso,
    paidOnDisplay,
    paidTo,
    paymentStatus,
    items,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    // Optional PDF metadata for UI (if present)
    pdfFileId: toStringValue((data as any).pdfFileId),
    pdfHash: toStringValue((data as any).pdfHash),
    pdfGeneratedAt: toIsoString((data as any).pdfGeneratedAt),
    // Note: linkedTransactions and amountPaid are now derived from transactions
    // at the API layer, not stored on invoices. See enrichInvoicesWithPaymentData()
  }
}

const extractBaseInvoiceNumber = (invoiceNumber: string) => {
  const trailingMatch = invoiceNumber.match(/^(#?\d{4}-\d{3}-\d{4})([a-z]+)$/i)
  if (trailingMatch) {
    return trailingMatch[1]
  }
  const suffixMatch = invoiceNumber.match(/^(#?.*?)-([a-z]+)$/i)
  if (suffixMatch) {
    return suffixMatch[1]
  }
  return invoiceNumber
}

export interface FetchInvoicesOptions {
  includeDeleted?: boolean
}

export const fetchInvoicesForProject = async (
  year: string,
  projectId: string,
  options?: FetchInvoicesOptions,
): Promise<(ProjectInvoiceRecord & InvoicePdfMeta)[]> => {
  const { includeDeleted = false } = options || {}

  // Prefer nested doc; fallback to legacy path
  const nestedRef = doc(projectsDb, PROJECTS_ROOT, year, PROJECTS_SUBCOLLECTION, projectId)
  let projectRef = nestedRef
  try {
    const exists = await getDoc(nestedRef)
    if (!exists.exists()) {
      projectRef = doc(projectsDb, year, projectId)
    }
  } catch {
    projectRef = doc(projectsDb, year, projectId)
  }

  const invoices: (ProjectInvoiceRecord & InvoicePdfMeta)[] = []
  try {
    const collectionRef = collection(projectRef, SINGLE_INVOICE_COLLECTION_ID)
    const snapshot = await getDocs(collectionRef)
    snapshot.forEach((document) => {
      const data = document.data()
      // Skip deleted records unless includeDeleted is true
      if (!includeDeleted && data.recordStatus === 'deleted') {
        return
      }
      invoices.push(buildInvoiceRecord(SINGLE_INVOICE_COLLECTION_ID, document.id, data) as any)
    })
  } catch (error) {
    console.warn("[projectInvoices] Failed to fetch invoices from unified collection", {
      projectId,
      error,
    })
  }

  invoices.sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber))
  return invoices
}

export interface InvoiceClientPayload {
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  region: string | null
  representative: RepresentativeInfo | string | null
}

export interface InvoiceItemPayload {
  title: string
  feeType: string
  unitPrice: number
  quantity: number
  discount: number
  subQuantity: string
  notes: string
  quantityUnit: string
}

// Optional PDF metadata surfaced to UI when present
export interface InvoicePdfMeta {
  pdfFileId?: string | null
  pdfHash?: string | null
  pdfGeneratedAt?: string | null
}

interface InvoiceWritePayload {
  baseInvoiceNumber: string
  client: InvoiceClientPayload
  items: InvoiceItemPayload[]
  taxOrDiscountPercent: number | null
  paymentStatus: string | null
  // Note: paidTo and paidOn are now derived from transactions, not stored on invoice
  onDate?: unknown
}

const sanitizeClientPayload = (client: InvoiceClientPayload) => ({
  companyName: toStringValue(client.companyName) ?? null,
  addressLine1: toStringValue(client.addressLine1) ?? null,
  addressLine2: toStringValue(client.addressLine2) ?? null,
  addressLine3: toStringValue(client.addressLine3) ?? null,
  region: toStringValue(client.region) ?? null,
  representative: (() => {
    const normalized = normalizeRepresentative((client as any).representative)
    const legacyTitle = toStringValue((client as any).title)
    if (normalized && !normalized.title && legacyTitle) {
      return { ...normalized, title: legacyTitle }
    }
    if (normalized) return normalized

    // Support legacy payloads where title and representative were sent separately.
    let legacyName = toStringValue((client as any).representative)
    if (legacyTitle && legacyName) {
      const normalizedTitle = legacyTitle.toLowerCase()
      if (legacyName.toLowerCase().startsWith(normalizedTitle)) {
        legacyName = legacyName.slice(legacyTitle.length).trimStart()
      }
    }
    if (!legacyTitle && !legacyName) return null
    return parseRepresentativeString(`${legacyTitle ? `${legacyTitle} ` : ''}${legacyName ?? ''}`.trim())
  })(),
})

const sanitizeItemsPayload = (items: InvoiceItemPayload[]): InvoiceItemPayload[] =>
  items
    .map((item) => ({
      title: item.title?.trim() ?? "",
      feeType: item.feeType?.trim() ?? "",
      unitPrice:
        typeof item.unitPrice === "number" && !Number.isNaN(item.unitPrice)
          ? item.unitPrice
          : 0,
      quantity:
        typeof item.quantity === "number" && !Number.isNaN(item.quantity)
          ? item.quantity
          : 0,
      discount:
        typeof item.discount === "number" && !Number.isNaN(item.discount)
          ? item.discount
          : 0,
      subQuantity: item.subQuantity?.trim() ?? "",
      notes: item.notes?.trim() ?? "",
      quantityUnit: item.quantityUnit?.trim() ?? "",
    }))
    .filter((item) =>
      item.title.length > 0 ||
      item.feeType.length > 0 ||
      item.unitPrice > 0 ||
      item.quantity > 0 ||
      item.discount > 0 ||
      item.subQuantity.length > 0 ||
      item.notes.length > 0 ||
      item.quantityUnit.length > 0,
    )

const buildInvoiceWritePayload = (
  payload: InvoiceWritePayload,
  existingItemCount = 0,
  options?: { removeAggregates?: boolean },
) => {
  const client = sanitizeClientPayload(payload.client)
  const items = sanitizeItemsPayload(payload.items)
  const taxOrDiscountPercent =
    payload.taxOrDiscountPercent !== null && !Number.isNaN(payload.taxOrDiscountPercent)
      ? payload.taxOrDiscountPercent
      : null
  const paymentStatus = toStringValue(payload.paymentStatus) ?? null

  const result: Record<string, unknown> = {
    baseInvoiceNumber: payload.baseInvoiceNumber,
    companyName: client.companyName,
    addressLine1: client.addressLine1,
    addressLine2: client.addressLine2,
    addressLine3: client.addressLine3,
    region: client.region,
    representative: client.representative,
    itemsCount: items.length,
    taxOrDiscountPercent,
    paymentStatus,
  }

  // Note: paidTo and paidOn are no longer stored on invoices.
  // Payment info is now derived from matched transactions.

  const onDateIso = toIsoString(payload.onDate as any)
  if (onDateIso) {
    const dt = new Date(onDateIso)
    if (!Number.isNaN(dt.getTime())) {
      result.onDate = dt
    }
  } else if (payload.onDate === null) {
    result.onDate = null
  }

  items.forEach((item, index) => {
    const position = index + 1
    result[`item${position}Title`] = item.title || null
    result[`item${position}FeeType`] = item.feeType || null
    result[`item${position}UnitPrice`] = item.unitPrice
    result[`item${position}Quantity`] = item.quantity
    result[`item${position}Discount`] = item.discount
    result[`item${position}SubQuantity`] = item.subQuantity || null
    result[`item${position}Notes`] = item.notes || null
    result[`item${position}QuantityUnit`] = item.quantityUnit || null
  })

  for (let index = items.length + 1; index <= existingItemCount; index += 1) {
    result[`item${index}Title`] = deleteField()
    result[`item${index}FeeType`] = deleteField()
    result[`item${index}UnitPrice`] = deleteField()
    result[`item${index}Quantity`] = deleteField()
    result[`item${index}Discount`] = deleteField()
    result[`item${index}SubQuantity`] = deleteField()
    result[`item${index}Notes`] = deleteField()
    result[`item${index}QuantityUnit`] = deleteField()
  }

  if (options?.removeAggregates) {
    result.subtotal = deleteField()
    result.total = deleteField()
    result.amount = deleteField()
  }

  return result
}

const determineBaseInvoiceNumber = (base: string) => base.replace(/^#/, '').trim()

// Choose a unique invoice number within the unified 'invoice' collection.
const determineInvoiceNumberInUnifiedCollection = (
  baseInvoiceNumber: string,
  existingDocIds: string[],
): string => {
  const used = new Set<number>()
  existingDocIds.forEach((id) => {
    if (id === baseInvoiceNumber) {
      used.add(0)
      return
    }
    const m = id.match(new RegExp(`^${baseInvoiceNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-([a-z]+)$`, "i"))
    if (m) {
      used.add(lettersToIndex(m[1]))
    }
  })
  let idx = 0
  while (used.has(idx)) idx += 1
  const suffix = indexToSuffix(idx)
  return suffix ? `${baseInvoiceNumber}-${suffix}` : baseInvoiceNumber
}

export interface CreateInvoiceInput extends InvoiceWritePayload {
  year: string
  projectId: string
  editedBy: string
}

export const createInvoiceForProject = async (
  input: CreateInvoiceInput,
): Promise<ProjectInvoiceRecord> => {
  const baseInvoiceNumber = determineBaseInvoiceNumber(input.baseInvoiceNumber)
  if (!baseInvoiceNumber) {
    throw new Error("Base invoice number is required")
  }

  // Create under nested doc; if it doesn't exist yet, fallback to legacy doc
  let projectRef = doc(projectsDb, PROJECTS_ROOT, input.year, PROJECTS_SUBCOLLECTION, input.projectId)
  try {
    const exists = await getDoc(projectRef)
    if (!exists.exists()) {
      projectRef = doc(projectsDb, input.year, input.projectId)
    }
  } catch {
    projectRef = doc(projectsDb, input.year, input.projectId)
  }
  const collectionRef = collection(projectRef, SINGLE_INVOICE_COLLECTION_ID)
  const existingSnap = await getDocs(collectionRef)
  const existingIds = existingSnap.docs.map((d) => d.id)
  const invoiceNumber = determineInvoiceNumberInUnifiedCollection(baseInvoiceNumber, existingIds)
  const documentRef = doc(collectionRef, invoiceNumber)

  const payload = buildInvoiceWritePayload({
    baseInvoiceNumber,
    client: input.client,
    items: input.items,
    taxOrDiscountPercent: input.taxOrDiscountPercent,
    paymentStatus: input.paymentStatus,
    onDate: input.onDate,
  })

  payload.invoiceNumber = invoiceNumber
  payload.baseInvoiceNumber = baseInvoiceNumber
  payload.createdAt = serverTimestamp()

  await setDoc(documentRef, payload)

  const snapshot = await getDoc(documentRef)
  if (!snapshot.exists()) {
    throw new Error("Failed to read created invoice")
  }

  const creationDiff = computeDocumentDiff({}, snapshot.data() ?? {})
  await logInvoiceChanges(documentRef, creationDiff, input.editedBy)

  return buildInvoiceRecord(SINGLE_INVOICE_COLLECTION_ID, snapshot.id, snapshot.data())
}

export interface UpdateInvoiceInput extends InvoiceWritePayload {
  year: string
  projectId: string
  collectionId: string
  invoiceNumber: string
  originalInvoiceNumber?: string
  editedBy: string
}

export const updateInvoiceForProject = async (
  input: UpdateInvoiceInput,
): Promise<ProjectInvoiceRecord & InvoicePdfMeta> => {
  // Prefer nested; fallback to legacy path
  let projectRef = doc(projectsDb, PROJECTS_ROOT, input.year, PROJECTS_SUBCOLLECTION, input.projectId)
  try {
    const exists = await getDoc(projectRef)
    if (!exists.exists()) {
      projectRef = doc(projectsDb, input.year, input.projectId)
    }
  } catch {
    projectRef = doc(projectsDb, input.year, input.projectId)
  }
  const locateInvoice = async (collectionId: string, invoiceId: string) => {
    const colRef = collection(projectRef, collectionId)
    const docRef = doc(colRef, invoiceId)
    const snapshot = await getDoc(docRef)
    return { collectionId, collectionRef: colRef, documentRef: docRef, snapshot }
  }

  const tryFallbackCollection = async (invoiceId: string) => {
    if (input.collectionId === SINGLE_INVOICE_COLLECTION_ID) {
      return null
    }
    const fallback = await locateInvoice(SINGLE_INVOICE_COLLECTION_ID, invoiceId)
    return fallback.snapshot.exists() ? fallback : null
  }

  let resolvedCollectionId = input.collectionId
  let initial = await locateInvoice(resolvedCollectionId, input.invoiceNumber)
  let { collectionRef, documentRef, snapshot: existing } = initial

  if (!existing.exists()) {
    const fallback = await tryFallbackCollection(input.invoiceNumber)
    if (fallback) {
      resolvedCollectionId = fallback.collectionId
      collectionRef = fallback.collectionRef
      documentRef = fallback.documentRef
      existing = fallback.snapshot
    }
  }

  const normalizedOriginal =
    typeof input.originalInvoiceNumber === "string" && input.originalInvoiceNumber.trim().length > 0
      ? input.originalInvoiceNumber.trim()
      : null

  if (!existing.exists() && normalizedOriginal) {
    const originalAttempt = await locateInvoice(resolvedCollectionId, normalizedOriginal)
    if (originalAttempt.snapshot.exists()) {
      resolvedCollectionId = originalAttempt.collectionId
      collectionRef = originalAttempt.collectionRef
      documentRef = originalAttempt.documentRef
      existing = originalAttempt.snapshot
    } else {
      const fallbackOriginal = await tryFallbackCollection(normalizedOriginal)
      if (fallbackOriginal) {
        resolvedCollectionId = fallbackOriginal.collectionId
        collectionRef = fallbackOriginal.collectionRef
        documentRef = fallbackOriginal.documentRef
        existing = fallbackOriginal.snapshot
      }
    }
  }

  if (!existing.exists()) {
    throw new Error("Invoice not found")
  }

  const existingData = existing.data()
  const existingCount = Number(existingData.itemsCount) || 0

  // If the invoice number (document id) has changed, rename the document first
  if (input.invoiceNumber !== existing.id) {
    const renamed = await renameInvoiceForProject({
      year: input.year,
      projectId: input.projectId,
      fromInvoiceNumber: existing.id,
      toInvoiceNumber: input.invoiceNumber,
      editedBy: input.editedBy,
    })
    // Point our refs to the renamed document in the unified collection
    resolvedCollectionId = SINGLE_INVOICE_COLLECTION_ID
    collectionRef = collection(projectRef, SINGLE_INVOICE_COLLECTION_ID)
    documentRef = doc(collectionRef, renamed.invoiceNumber)
    existing = await getDoc(documentRef)
  }

  const payload = buildInvoiceWritePayload(
    {
      baseInvoiceNumber: extractBaseInvoiceNumber(input.invoiceNumber),
      client: input.client,
      items: input.items,
      taxOrDiscountPercent: input.taxOrDiscountPercent,
      paymentStatus: input.paymentStatus,
      onDate: input.onDate,
    },
    existingCount,
    { removeAggregates: true },
  )

  // Compute diffs BEFORE writing; skip write/log if nothing changed
  const proposedData = { ...existingData, ...payload }
  const diffs = computeDocumentDiff(existingData, proposedData)
  if (diffs.length === 0) {
    return buildInvoiceRecord(resolvedCollectionId, existing.id, existingData ?? {})
  }

  await updateDoc(documentRef, payload)

  const refreshedSnapshot = await getDoc(documentRef)
  if (!refreshedSnapshot.exists()) {
    throw new Error("Failed to retrieve updated invoice")
  }

  const refreshedData = refreshedSnapshot.data()
  const writeDiffs = computeDocumentDiff(existingData, refreshedData ?? {})
  await logInvoiceChanges(documentRef, writeDiffs, input.editedBy)

  return buildInvoiceRecord(resolvedCollectionId, refreshedSnapshot.id, refreshedData ?? {}) as any
}

export interface DeleteInvoiceInput {
  year: string
  projectId: string
  collectionId: string
  invoiceNumber: string
  editedBy: string
}

export interface DeleteInvoiceResult {
  invoicePath: string
  previousStatus: InvoiceRecordStatus | undefined
  hardDeleted: boolean
}

/**
 * Delete an invoice.
 * - If the invoice is not issued (paymentStatus is "Draft" or null), hard delete it.
 * - If the invoice has been issued, soft delete it (marks as deleted instead of permanent erasure).
 * Returns the invoice path for GL voiding by the caller.
 */
export const deleteInvoiceForProject = async (
  input: DeleteInvoiceInput,
): Promise<DeleteInvoiceResult> => {
  // Prefer nested; fallback to legacy path
  let projectRef = doc(projectsDb, PROJECTS_ROOT, input.year, PROJECTS_SUBCOLLECTION, input.projectId)
  try {
    const exists = await getDoc(projectRef)
    if (!exists.exists()) {
      projectRef = doc(projectsDb, input.year, input.projectId)
    }
  } catch {
    projectRef = doc(projectsDb, input.year, input.projectId)
  }

  // Try requested collection first, then unified collection
  let collectionRef = collection(projectRef, input.collectionId)
  let documentRef = doc(collectionRef, input.invoiceNumber)
  let existing = await getDoc(documentRef)
  if (!existing.exists()) {
    collectionRef = collection(projectRef, SINGLE_INVOICE_COLLECTION_ID)
    documentRef = doc(collectionRef, input.invoiceNumber)
    existing = await getDoc(documentRef)
    if (!existing.exists()) {
      throw new Error('Invoice not found')
    }
  }

  const existingData = existing.data() as ProjectInvoiceRecord
  const previousStatus = existingData?.recordStatus
  const paymentStatus = existingData?.paymentStatus?.toLowerCase() || null

  // Check if invoice is a draft (not issued)
  const isDraft = !paymentStatus || paymentStatus === 'draft'

  if (isDraft) {
    // Hard delete: permanently remove the invoice document and its subcollections
    // First delete updateLogs subcollection
    const updateLogsRef = collection(documentRef, UPDATE_LOG_COLLECTION)
    const updateLogsDocs = await getDocs(updateLogsRef)
    for (const logDoc of updateLogsDocs.docs) {
      await deleteDoc(logDoc.ref)
    }
    // Then delete the invoice document itself
    await deleteDoc(documentRef)

    return {
      invoicePath: documentRef.path,
      previousStatus,
      hardDeleted: true,
    }
  }

  // Soft delete: mark as deleted instead of erasing (for issued invoices)
  await updateDoc(documentRef, {
    recordStatus: 'deleted',
    deletedAt: new Date().toISOString(),
    deletedBy: input.editedBy,
    updatedAt: new Date().toISOString(),
  })

  // Log the deletion to updateLogs
  await logInvoiceChanges(documentRef, [
    { field: 'recordStatus', before: previousStatus || 'active', after: 'deleted' },
  ], input.editedBy)

  // Return the invoice path for GL voiding
  return {
    invoicePath: documentRef.path,
    previousStatus,
    hardDeleted: false,
  }
}

export interface RenameInvoiceInput {
  year: string
  projectId: string
  fromInvoiceNumber: string
  toInvoiceNumber: string
  editedBy: string
}

// Rename (rekey) an invoice document within the unified 'invoice' collection.
// Copies data to the new doc id and deletes the old doc.
export const renameInvoiceForProject = async (
  input: RenameInvoiceInput,
): Promise<ProjectInvoiceRecord> => {
  // Prefer nested; fallback to legacy path
  let projectRef = doc(projectsDb, PROJECTS_ROOT, input.year, PROJECTS_SUBCOLLECTION, input.projectId)
  try {
    const exists = await getDoc(projectRef)
    if (!exists.exists()) {
      projectRef = doc(projectsDb, input.year, input.projectId)
    }
  } catch {
    projectRef = doc(projectsDb, input.year, input.projectId)
  }

  const collectionRef = collection(projectRef, SINGLE_INVOICE_COLLECTION_ID)
  const fromRef = doc(collectionRef, input.fromInvoiceNumber)
  const fromSnap = await getDoc(fromRef)
  if (!fromSnap.exists()) {
    throw new Error('Invoice not found')
  }

  const toRef = doc(collectionRef, input.toInvoiceNumber)
  const toSnap = await getDoc(toRef)
  if (toSnap.exists()) {
    throw new Error('Target invoice number already exists')
  }

  const data = fromSnap.data() || {}
  const baseInvoiceNumber = extractBaseInvoiceNumber(input.toInvoiceNumber)
  const payload: Record<string, unknown> = {
    ...data,
    invoiceNumber: input.toInvoiceNumber,
    baseInvoiceNumber,
    updatedAt: serverTimestamp(),
    updatedBy: input.editedBy,
  }

  await setDoc(toRef, payload)
  await deleteDoc(fromRef)

  const newSnap = await getDoc(toRef)
  if (!newSnap.exists()) {
    throw new Error('Failed to read renamed invoice')
  }
  return buildInvoiceRecord(SINGLE_INVOICE_COLLECTION_ID, newSnap.id, newSnap.data() || {})
}
