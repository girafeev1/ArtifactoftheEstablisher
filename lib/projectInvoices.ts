import { addDoc, collection, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore"

import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from "./firebase"

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
const legacyInvoiceDocumentIdPattern = /^#?\d{4}-\d{3}-\d{4}(?:-?[a-z]+)?$/i
const LEGACY_INVOICE_COLLECTION_IDS = new Set(["Invoice", "invoice"])

const isSupportedInvoiceCollection = (id: string): boolean =>
  invoiceCollectionPattern.test(id) || LEGACY_INVOICE_COLLECTION_IDS.has(id)

const toStringValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value.trim() || null
  }
  if (value instanceof String) {
    const trimmed = value.toString().trim()
    return trimmed || null
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
  if (changes.length === 0) {
    return
  }

  const logsCollection = collection(invoiceRef, UPDATE_LOG_COLLECTION)
  await Promise.all(
    changes.map((change) =>
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

const listInvoiceCollectionIds = async (year: string, projectId: string): Promise<string[]> => {
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

    return (
      payload.collectionIds?.filter((id) => isSupportedInvoiceCollection(id)) ?? []
    ).sort((a, b) => a.localeCompare(b))
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
  representative: string | null
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

    const hasValue =
      title !== null ||
      feeType !== null ||
      unitPrice !== null ||
      quantity !== null ||
      discount !== null

    if (!hasValue) {
      if (count) {
        continue
      }
      break
    }

    items.push({ title, feeType, unitPrice, quantity, discount })
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
    representative: toStringValue(data.representative),
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

export const fetchInvoicesForProject = async (
  year: string,
  projectId: string,
): Promise<ProjectInvoiceRecord[]> => {
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

  const listedIds = await listInvoiceCollectionIds(year, projectId).catch((error) => {
    console.warn("[projectInvoices] listInvoiceCollectionIds failed", { error })
    return [] as string[]
  })

  const discovered = new Set<string>()
  listedIds.forEach((id) => {
    if (isSupportedInvoiceCollection(id)) {
      discovered.add(id)
    }
  })

  LEGACY_INVOICE_COLLECTION_IDS.forEach((id) => {
    discovered.add(id)
  })

  if (discovered.size === 0) {
    return []
  }

  const invoices: ProjectInvoiceRecord[] = []

  for (const collectionId of Array.from(discovered).sort((a, b) => a.localeCompare(b))) {
    try {
      const collectionRef = collection(projectRef, collectionId)
      const snapshot = await getDocs(collectionRef)
      snapshot.forEach((document) => {
        if (
          LEGACY_INVOICE_COLLECTION_IDS.has(collectionId) &&
          !legacyInvoiceDocumentIdPattern.test(document.id)
        ) {
          return
        }
        invoices.push(buildInvoiceRecord(collectionId, document.id, document.data()))
      })
    } catch (error) {
      console.warn("[projectInvoices] Failed to fetch invoices", {
        projectId,
        collectionId,
        error,
      })
    }
  }

  invoices.sort((a, b) => a.collectionId.localeCompare(b.collectionId))

  return invoices
}

export interface InvoiceClientPayload {
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  region: string | null
  representative: string | null
}

export interface InvoiceItemPayload {
  title: string
  feeType: string
  unitPrice: number
  quantity: number
  discount: number
}

interface InvoiceWritePayload {
  baseInvoiceNumber: string
  client: InvoiceClientPayload
  items: InvoiceItemPayload[]
  taxOrDiscountPercent: number | null
  paymentStatus: string | null
  paidTo?: string | null
  paidOn?: unknown
  onDate?: unknown
}

const sanitizeClientPayload = (client: InvoiceClientPayload) => ({
  companyName: toStringValue(client.companyName) ?? null,
  addressLine1: toStringValue(client.addressLine1) ?? null,
  addressLine2: toStringValue(client.addressLine2) ?? null,
  addressLine3: toStringValue(client.addressLine3) ?? null,
  region: toStringValue(client.region) ?? null,
  representative: toStringValue(client.representative) ?? null,
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
    }))
    .filter((item) =>
      item.title.length > 0 || item.feeType.length > 0 || item.unitPrice > 0 || item.quantity > 0,
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

  // Optional: paidTo (identifier) and paidOn (date)
  if (typeof payload.paidTo === "string") {
    const trimmed = payload.paidTo.trim()
    result.paidTo = trimmed.length > 0 ? trimmed : null
  } else if (payload.paidTo === null) {
    result.paidTo = null
  }

  const paidOnIso = toIsoString(payload.paidOn as any)
  if (paidOnIso) {
    const dt = new Date(paidOnIso)
    if (!Number.isNaN(dt.getTime())) {
      result.paidOn = dt
    }
  } else if (payload.paidOn === null) {
    result.paidOn = null
  }

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
  })

  for (let index = items.length + 1; index <= existingItemCount; index += 1) {
    result[`item${index}Title`] = deleteField()
    result[`item${index}FeeType`] = deleteField()
    result[`item${index}UnitPrice`] = deleteField()
    result[`item${index}Quantity`] = deleteField()
    result[`item${index}Discount`] = deleteField()
  }

  if (options?.removeAggregates) {
    result.subtotal = deleteField()
    result.total = deleteField()
    result.amount = deleteField()
  }

  return result
}

const determineBaseInvoiceNumber = (base: string) => base.trim()

const determineInvoiceIds = (
  baseInvoiceNumber: string,
  existingIds: string[],
): { collectionId: string; invoiceNumber: string } => {
  const usedIndexes = new Set<number>()
  existingIds.forEach((id) => {
    if (LEGACY_INVOICE_COLLECTION_IDS.has(id)) {
      usedIndexes.add(0)
      return
    }
    const match = invoiceCollectionPattern.exec(id)
    if (!match) {
      return
    }
    const index = lettersToIndex(match[1])
    usedIndexes.add(index)
  })

  let candidateIndex = 0
  while (usedIndexes.has(candidateIndex)) {
    candidateIndex += 1
  }

  const letters = indexToLetters(candidateIndex)
  const suffix = indexToSuffix(candidateIndex)
  const collectionId = `invoice-${letters}`
  const invoiceNumber = suffix ? `${baseInvoiceNumber}-${suffix}` : baseInvoiceNumber

  return { collectionId, invoiceNumber }
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

  const existingCollections = await listInvoiceCollectionIds(input.year, input.projectId)
  const { collectionId, invoiceNumber } = determineInvoiceIds(
    baseInvoiceNumber,
    existingCollections,
  )

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
  const collectionRef = collection(projectRef, collectionId)
  const documentRef = doc(collectionRef, invoiceNumber)

  const payload = buildInvoiceWritePayload({
    baseInvoiceNumber,
    client: input.client,
    items: input.items,
    taxOrDiscountPercent: input.taxOrDiscountPercent,
    paymentStatus: input.paymentStatus,
  })

  payload.invoiceNumber = invoiceNumber
  payload.baseInvoiceNumber = baseInvoiceNumber
  payload.createdAt = serverTimestamp()
  payload.updatedAt = serverTimestamp()

  await setDoc(documentRef, payload)

  const snapshot = await getDoc(documentRef)
  if (!snapshot.exists()) {
    throw new Error("Failed to read created invoice")
  }

  const creationDiff = computeDocumentDiff({}, snapshot.data() ?? {})
  await logInvoiceChanges(documentRef, creationDiff, input.editedBy)

  return buildInvoiceRecord(collectionId, snapshot.id, snapshot.data())
}

export interface UpdateInvoiceInput extends InvoiceWritePayload {
  year: string
  projectId: string
  collectionId: string
  invoiceNumber: string
  editedBy: string
}

export const updateInvoiceForProject = async (
  input: UpdateInvoiceInput,
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
  const collectionRef = collection(projectRef, input.collectionId)
  const documentRef = doc(collectionRef, input.invoiceNumber)

  const existing = await getDoc(documentRef)
  if (!existing.exists()) {
    throw new Error("Invoice not found")
  }

  const existingData = existing.data()
  const existingCount = Number(existingData.itemsCount) || 0

  const payload = buildInvoiceWritePayload(
    {
      baseInvoiceNumber: extractBaseInvoiceNumber(input.invoiceNumber),
      client: input.client,
      items: input.items,
      taxOrDiscountPercent: input.taxOrDiscountPercent,
      paymentStatus: input.paymentStatus,
    },
    existingCount,
    { removeAggregates: true },
  )

  payload.updatedAt = serverTimestamp()

  await updateDoc(documentRef, payload)

  const refreshedSnapshot = await getDoc(documentRef)
  if (!refreshedSnapshot.exists()) {
    throw new Error("Failed to retrieve updated invoice")
  }

  const refreshedData = refreshedSnapshot.data()
  const diffs = computeDocumentDiff(existingData, refreshedData ?? {})
  await logInvoiceChanges(documentRef, diffs, input.editedBy)

  return buildInvoiceRecord(input.collectionId, refreshedSnapshot.id, refreshedData ?? {})
}

export interface InvoiceSummaryResult {
  invoiceNumber: string | null
  amount: number | null
  clientCompany: string | null
}

export const fetchPrimaryInvoiceSummary = async (
  year: string,
  projectId: string,
): Promise<InvoiceSummaryResult | null> => {
  const invoices = await fetchInvoicesForProject(year, projectId)
  if (!invoices.length) {
    return null
  }
  let aggregatedTotal = 0
  let hasAmount = false
  invoices.forEach((invoice) => {
    let value: number | null = null
    if (typeof invoice.total === "number" && !Number.isNaN(invoice.total)) {
      value = invoice.total
    } else if (typeof invoice.amount === "number" && !Number.isNaN(invoice.amount)) {
      value = invoice.amount
    }
    if (value !== null) {
      aggregatedTotal += value
      hasAmount = true
    }
  })
  const first = invoices[0]
  return {
    invoiceNumber: first.invoiceNumber,
    amount: hasAmount ? aggregatedTotal : first.total ?? first.amount ?? null,
    clientCompany: first.companyName ?? null,
  }
}
