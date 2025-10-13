import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentReference,
} from "firebase/firestore"

import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from "./firebase"
import type { ProjectStoragePath } from "./projectsDatabase"

const API_TIMEOUT_MS = 15000

const alphabet = "abcdefghijklmnopqrstuvwxyz"

// New nested layout (preferred):
// projects/{year}/projects/{projectId}
const PROJECTS_ROOT = "projects"
const PROJECTS_SUBCOLLECTION = "projects"

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
const INVOICE_UPDATE_LOG_COLLECTION = "updateLogs"

const isSupportedInvoiceCollection = (id: string): boolean =>
  invoiceCollectionPattern.test(id) || LEGACY_INVOICE_COLLECTION_IDS.has(id)

const resolveProjectDocumentRefs = (year: string, projectId: string) => ({
  nested: doc(projectsDb, PROJECTS_ROOT, year, PROJECTS_SUBCOLLECTION, projectId),
  legacy: doc(projectsDb, year, projectId),
})

const orderedProjectRefs = (
  year: string,
  projectId: string,
  preference?: ProjectStoragePath,
): DocumentReference[] => {
  const refs = resolveProjectDocumentRefs(year, projectId)
  if (preference === "legacy") {
    return [refs.legacy, refs.nested]
  }
  return [refs.nested, refs.legacy]
}

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

const listInvoiceCollectionIds = async (
  year: string,
  projectId: string,
  preferredPath?: ProjectStoragePath,
): Promise<string[]> => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const projectKey = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  if (!apiKey || !projectKey) {
    console.warn("[projectInvoices] Missing Firebase configuration when listing invoice collections")
    return []
  }

  const buildUrl = (path: ProjectStoragePath) =>
    path === "legacy"
      ? `https://firestore.googleapis.com/v1/projects/${projectKey}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents/${encodeURIComponent(
          year,
        )}/${encodeURIComponent(projectId)}:listCollectionIds?key=${apiKey}`
      : `https://firestore.googleapis.com/v1/projects/${projectKey}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents/${encodeURIComponent(
          PROJECTS_ROOT,
        )}/${encodeURIComponent(year)}/${encodeURIComponent(PROJECTS_SUBCOLLECTION)}/${encodeURIComponent(
          projectId,
        )}:listCollectionIds?key=${apiKey}`

  const order: ProjectStoragePath[] =
    preferredPath === "legacy" ? ["legacy", "nested"] : ["nested", "legacy"]

  const discovered = new Set<string>()

  for (const pathType of order) {
    const url = buildUrl(pathType)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageSize: 200 }),
        signal: controller.signal,
      })

      if (!response.ok) {
        console.warn(
          "[projectInvoices] Failed to list invoice collection IDs",
          { projectId, pathType, status: response.status, statusText: response.statusText },
        )
        continue
      }

      const payload = (await response.json().catch(() => ({}))) as {
        collectionIds?: string[]
        error?: { message?: string }
      }

      if (payload.error) {
        console.warn("[projectInvoices] listCollectionIds returned error", {
          projectId,
          pathType,
          error: payload.error,
        })
        continue
      }

      payload.collectionIds
        ?.filter((id) => isSupportedInvoiceCollection(id))
        .forEach((id) => discovered.add(id))
    } catch (error) {
      console.warn("[projectInvoices] listInvoiceCollectionIds failed", {
        projectId,
        pathType,
        error,
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  return Array.from(discovered).sort((a, b) => a.localeCompare(b))
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
  storagePreference?: ProjectStoragePath,
): Promise<ProjectInvoiceRecord[]> => {
  const projectRefs = orderedProjectRefs(year, projectId, storagePreference)

  const listedIds = await listInvoiceCollectionIds(year, projectId, storagePreference).catch((error) => {
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
    let fetched = false
    for (const projectRef of projectRefs) {
      try {
        const collectionRef = collection(projectRef, collectionId)
        const snapshot = await getDocs(collectionRef)
        if (snapshot.empty) {
          continue
        }
        snapshot.forEach((document) => {
          if (
            LEGACY_INVOICE_COLLECTION_IDS.has(collectionId) &&
            !legacyInvoiceDocumentIdPattern.test(document.id)
          ) {
            return
          }
          invoices.push(buildInvoiceRecord(collectionId, document.id, document.data()))
        })
        fetched = true
        break
      } catch (error) {
        console.warn("[projectInvoices] Failed to fetch invoices", {
          projectId,
          collectionId,
          path: projectRef.path,
          error,
        })
      }
    }
    if (!fetched) {
      console.warn("[projectInvoices] Unable to load invoice collection", {
        projectId,
        collectionId,
      })
    }
  }

  invoices.sort((a, b) => a.collectionId.localeCompare(b.collectionId))

  return invoices
}

export interface InvoiceClientPayload {
  companyName: string | null
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
}

const sanitizeClientPayload = (client: InvoiceClientPayload) => ({
  companyName: toStringValue(client.companyName) ?? null,
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
  options?: { removeAggregates?: boolean; clearClientDetails?: boolean },
) => {
  const client = sanitizeClientPayload(payload.client)
  const items = sanitizeItemsPayload(payload.items)
  const taxOrDiscountPercent =
    payload.taxOrDiscountPercent !== null && !Number.isNaN(payload.taxOrDiscountPercent)
      ? payload.taxOrDiscountPercent
      : null
  const paymentStatus = toStringValue(payload.paymentStatus) ?? null

  const removedFields: string[] = []

  const result: Record<string, unknown> = {
    baseInvoiceNumber: payload.baseInvoiceNumber,
    companyName: client.companyName,
    itemsCount: items.length,
    taxOrDiscountPercent,
    paymentStatus,
  }

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

  items.forEach((item, index) => {
    const position = index + 1
    result[`item${position}Title`] = item.title || null
    result[`item${position}FeeType`] = item.feeType || null
    result[`item${position}UnitPrice`] = item.unitPrice
    result[`item${position}Quantity`] = item.quantity
    result[`item${position}Discount`] = item.discount
  })

  for (let index = items.length + 1; index <= existingItemCount; index += 1) {
    const titleKey = `item${index}Title`
    const feeTypeKey = `item${index}FeeType`
    const unitPriceKey = `item${index}UnitPrice`
    const quantityKey = `item${index}Quantity`
    const discountKey = `item${index}Discount`
    result[titleKey] = deleteField()
    result[feeTypeKey] = deleteField()
    result[unitPriceKey] = deleteField()
    result[quantityKey] = deleteField()
    result[discountKey] = deleteField()
    removedFields.push(titleKey, feeTypeKey, unitPriceKey, quantityKey, discountKey)
  }

  if (options?.removeAggregates) {
    result.subtotal = deleteField()
    result.total = deleteField()
    result.amount = deleteField()
    removedFields.push("subtotal", "total", "amount")
  }

  if (options?.clearClientDetails) {
    const clientFields = [
      "addressLine1",
      "addressLine2",
      "addressLine3",
      "region",
      "representative",
    ] as const
    clientFields.forEach((field) => {
      result[field] = deleteField()
      removedFields.push(field)
    })
  }

  return { data: result, removedFields }
}

const determineBaseInvoiceNumber = (base: string) => base.trim()

const determineInvoiceIds = (
  baseInvoiceNumber: string,
  existingIds: string[],
): { collectionId: string; invoiceNumber: string } => {
  const legacyCollection = existingIds.find((id) => LEGACY_INVOICE_COLLECTION_IDS.has(id))
  if (legacyCollection) {
    return { collectionId: legacyCollection, invoiceNumber: baseInvoiceNumber }
  }

  if (existingIds.length === 0) {
    // Preserve legacy structure so new invoices appear under the expected
    // `invoice` collection unless a specific suffixed collection already
    // exists for the project.
    return { collectionId: "invoice", invoiceNumber: baseInvoiceNumber }
  }

  const usedIndexes = new Set<number>()
  existingIds.forEach((id) => {
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

type InvoiceChangeLogEntry = {
  field: string
  previousValue: unknown
  newValue: unknown
}

const toLogValue = (value: unknown): unknown => {
  if (value === undefined) {
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
    return value.map((entry) => toLogValue(entry))
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        toLogValue(entryValue),
      ]),
    )
  }
  return value
}

const areValuesEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) {
    return true
  }
  if (left == null || right == null) {
    return left === right
  }
  if (typeof left === "number" && typeof right === "number") {
    if (Number.isNaN(left) && Number.isNaN(right)) {
      return true
    }
    return left === right
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false
    }
    return left.every((entry, index) => areValuesEqual(entry, right[index]))
  }
  if (typeof left === "object" && typeof right === "object") {
    const leftEntries = Object.entries(left as Record<string, unknown>)
    const rightEntries = Object.entries(right as Record<string, unknown>)
    if (leftEntries.length !== rightEntries.length) {
      return false
    }
    return leftEntries.every(([key, value]) =>
      areValuesEqual(value, (right as Record<string, unknown>)[key])
    )
  }
  return false
}

const collectInvoiceChangeEntries = (
  before: ProjectInvoiceRecord,
  after: ProjectInvoiceRecord,
): InvoiceChangeLogEntry[] => {
  const entries: InvoiceChangeLogEntry[] = []
  const compare = (field: string, previous: unknown, next: unknown) => {
    if (!areValuesEqual(previous, next)) {
      entries.push({
        field,
        previousValue: toLogValue(previous),
        newValue: toLogValue(next),
      })
    }
  }

  compare("companyName", before.companyName, after.companyName)
  compare("taxOrDiscountPercent", before.taxOrDiscountPercent, after.taxOrDiscountPercent)
  compare("paymentStatus", before.paymentStatus, after.paymentStatus)
  compare("paidTo", before.paidTo, after.paidTo)
  compare("paidOnIso", before.paidOnIso, after.paidOnIso)
  compare("paidOnDisplay", before.paidOnDisplay, after.paidOnDisplay)
  compare("paid", before.paid, after.paid)
  compare("subtotal", before.subtotal, after.subtotal)
  compare("total", before.total, after.total)
  compare("amount", before.amount, after.amount)

  const maxItems = Math.max(before.items.length, after.items.length)
  for (let index = 0; index < maxItems; index += 1) {
    const previousItem = before.items[index]
    const nextItem = after.items[index]
    const baseField = `items[${index + 1}]`
    if (!previousItem && nextItem) {
      entries.push({
        field: baseField,
        previousValue: null,
        newValue: toLogValue(nextItem),
      })
      continue
    }
    if (previousItem && !nextItem) {
      entries.push({
        field: baseField,
        previousValue: toLogValue(previousItem),
        newValue: null,
      })
      continue
    }
    if (previousItem && nextItem) {
      compare(`${baseField}.title`, previousItem.title, nextItem.title)
      compare(`${baseField}.feeType`, previousItem.feeType, nextItem.feeType)
      compare(`${baseField}.unitPrice`, previousItem.unitPrice, nextItem.unitPrice)
      compare(`${baseField}.quantity`, previousItem.quantity, nextItem.quantity)
      compare(`${baseField}.discount`, previousItem.discount, nextItem.discount)
    }
  }

  return entries
}

export interface CreateInvoiceInput extends InvoiceWritePayload {
  year: string
  projectId: string
  storagePath: ProjectStoragePath
  editedBy: string
}

export const createInvoiceForProject = async (
  input: CreateInvoiceInput,
): Promise<ProjectInvoiceRecord> => {
  const baseInvoiceNumber = determineBaseInvoiceNumber(input.baseInvoiceNumber)
  if (!baseInvoiceNumber) {
    throw new Error("Base invoice number is required")
  }

  const existingCollections = await listInvoiceCollectionIds(
    input.year,
    input.projectId,
    input.storagePath,
  )
  const { collectionId, invoiceNumber } = determineInvoiceIds(
    baseInvoiceNumber,
    existingCollections,
  )

  const projectRefs = orderedProjectRefs(input.year, input.projectId, input.storagePath)

  const { data: basePayload } = buildInvoiceWritePayload({
    baseInvoiceNumber,
    client: input.client,
    items: input.items,
    taxOrDiscountPercent: input.taxOrDiscountPercent,
    paymentStatus: input.paymentStatus,
    paidTo: input.paidTo ?? null,
    paidOn: input.paidOn ?? null,
  })

  let lastError: unknown = null

  for (const projectRef of projectRefs) {
    const collectionRef = collection(projectRef, collectionId)
    const documentRef = doc(collectionRef, invoiceNumber)
    const payload: Record<string, unknown> = {
      ...basePayload,
      invoiceNumber,
      baseInvoiceNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    try {
      await setDoc(documentRef, payload)
      await addDoc(collection(documentRef, INVOICE_UPDATE_LOG_COLLECTION), {
        field: "created",
        editedBy: input.editedBy,
        timestamp: serverTimestamp(),
        newValue: invoiceNumber,
      })

      const snapshot = await getDoc(documentRef)
      if (!snapshot.exists()) {
        throw new Error("Failed to read created invoice")
      }

      return buildInvoiceRecord(collectionId, snapshot.id, snapshot.data())
    } catch (error) {
      lastError = error
      console.warn("[projectInvoices] Failed to create invoice", {
        projectId: input.projectId,
        collectionId,
        invoiceNumber,
        path: projectRef.path,
        error,
      })
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to create invoice for project")
}

export interface UpdateInvoiceInput extends InvoiceWritePayload {
  year: string
  projectId: string
  storagePath: ProjectStoragePath
  collectionId: string
  invoiceNumber: string
  editedBy: string
}

export const updateInvoiceForProject = async (
  input: UpdateInvoiceInput,
): Promise<ProjectInvoiceRecord> => {
  const projectRefs = orderedProjectRefs(input.year, input.projectId, input.storagePath)
  const baseInvoiceNumber = extractBaseInvoiceNumber(input.invoiceNumber)

  let lastError: unknown = null

  for (const projectRef of projectRefs) {
    try {
      const collectionRef = collection(projectRef, input.collectionId)
      const documentRef = doc(collectionRef, input.invoiceNumber)
      const existing = await getDoc(documentRef)

      if (!existing.exists()) {
        lastError = new Error("Invoice not found")
        continue
      }

      const existingData = existing.data()
      const existingCount = Number(existingData.itemsCount) || 0
      const beforeRecord = buildInvoiceRecord(input.collectionId, existing.id, existingData)

      const { data: payload } = buildInvoiceWritePayload(
        {
          baseInvoiceNumber,
          client: input.client,
          items: input.items,
          taxOrDiscountPercent: input.taxOrDiscountPercent,
          paymentStatus: input.paymentStatus,
          paidTo: input.paidTo ?? null,
          paidOn: input.paidOn ?? null,
        },
        existingCount,
        { removeAggregates: true, clearClientDetails: true },
      )

      payload.updatedAt = serverTimestamp()

      await updateDoc(documentRef, payload)

      const refreshed = await getDoc(documentRef)
      if (!refreshed.exists()) {
        throw new Error("Failed to retrieve updated invoice")
      }

      const updatedRecord = buildInvoiceRecord(input.collectionId, refreshed.id, refreshed.data())
      const changes = collectInvoiceChangeEntries(beforeRecord, updatedRecord)

      if (changes.length > 0) {
        const logsCollection = collection(documentRef, INVOICE_UPDATE_LOG_COLLECTION)
        await Promise.all(
          changes.map((entry) =>
            addDoc(logsCollection, {
              field: entry.field,
              editedBy: input.editedBy,
              timestamp: serverTimestamp(),
              previousValue: entry.previousValue,
              newValue: entry.newValue,
            }),
          ),
        )
      }

      return updatedRecord
    } catch (error) {
      lastError = error
      console.warn("[projectInvoices] Failed to update invoice", {
        projectId: input.projectId,
        collectionId: input.collectionId,
        invoiceNumber: input.invoiceNumber,
        path: projectRef.path,
        error,
      })
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to update invoice for project")
}

export interface InvoiceSummaryResult {
  invoiceNumber: string | null
  amount: number | null
  clientCompany: string | null
}

export const fetchPrimaryInvoiceSummary = async (
  year: string,
  projectId: string,
  storagePreference?: ProjectStoragePath,
): Promise<InvoiceSummaryResult | null> => {
  const invoices = await fetchInvoicesForProject(year, projectId, storagePreference)
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
