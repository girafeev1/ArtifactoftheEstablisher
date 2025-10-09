import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore"

import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from "./firebase"

const API_TIMEOUT_MS = 15000

const alphabet = "abcdefghijklmnopqrstuvwxyz"

const invoiceCollectionPattern = /^invoice-([a-z]+)$/

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
  return indexToLetters(index + 1)
}

const listInvoiceCollectionIds = async (year: string, projectId: string): Promise<string[]> => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const projectKey = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  if (!apiKey || !projectKey) {
    console.warn("[projectInvoices] Missing Firebase configuration when listing invoice collections")
    return []
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectKey}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents/${encodeURIComponent(
    year,
  )}/${encodeURIComponent(projectId)}:listCollectionIds?key=${apiKey}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageSize: 200 }),
      signal: controller.signal,
    })

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
      payload.collectionIds?.filter((id) => invoiceCollectionPattern.test(id)) ?? []
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
  items: ProjectInvoiceItemRecord[]
  createdAt?: string | null
  updatedAt?: string | null
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
  const suffixMatch = invoiceNumber.match(/-([a-z]+)$/)
  const suffix = suffixMatch ? suffixMatch[1] : ""
  const baseInvoiceNumber = suffixMatch
    ? invoiceNumber.slice(0, Math.max(0, invoiceNumber.length - suffix.length - 1))
    : invoiceNumber

  const subtotal = toNumberValue(data.subtotal) ?? null
  const taxOrDiscountPercent = toNumberValue(data.taxOrDiscountPercent) ?? null
  const total = toNumberValue(data.total) ?? subtotal

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
    amount: total,
    items: buildItemsFromData(data),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  }
}

const extractBaseInvoiceNumber = (invoiceNumber: string) => {
  const suffixMatch = invoiceNumber.match(/-([a-z]+)$/)
  if (!suffixMatch) {
    return invoiceNumber
  }
  return invoiceNumber.slice(0, Math.max(0, invoiceNumber.length - suffixMatch[1].length - 1))
}

export const fetchInvoicesForProject = async (
  year: string,
  projectId: string,
): Promise<ProjectInvoiceRecord[]> => {
  const projectRef = doc(projectsDb, year, projectId)

  const [listedIds, projectSnapshot] = await Promise.all([
    listInvoiceCollectionIds(year, projectId).catch((error) => {
      console.warn("[projectInvoices] listInvoiceCollectionIds failed", { error })
      return [] as string[]
    }),
    getDoc(projectRef).catch((error) => {
      console.warn("[projectInvoices] Failed to read project while fetching invoices", {
        projectId,
        error,
      })
      return null
    }),
  ])

  const discovered = new Set<string>()
  listedIds.forEach((id) => {
    if (invoiceCollectionPattern.test(id)) {
      discovered.add(id)
    }
  })

  if (projectSnapshot?.exists()) {
    const data = projectSnapshot.data()
    const storedCollections = Array.isArray((data as any).invoiceCollections)
      ? ((data as any).invoiceCollections as unknown[])
      : []
    storedCollections.forEach((raw) => {
      if (typeof raw === "string" && invoiceCollectionPattern.test(raw)) {
        discovered.add(raw)
      }
    })
  }

  if (discovered.size === 0) {
    return []
  }

  const invoices: ProjectInvoiceRecord[] = []

  for (const collectionId of Array.from(discovered).sort((a, b) => a.localeCompare(b))) {
    try {
      const collectionRef = collection(projectRef, collectionId)
      const snapshot = await getDocs(collectionRef)
      snapshot.forEach((document) => {
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

const computeSubtotal = (items: InvoiceItemPayload[]) =>
  items.reduce((total, item) => {
    const line = item.unitPrice * item.quantity - item.discount
    return total + (line > 0 ? line : 0)
  }, 0)

const computeTotals = (
  items: InvoiceItemPayload[],
  taxOrDiscountPercent: number | null,
): { subtotal: number; total: number } => {
  const subtotal = computeSubtotal(items)
  if (taxOrDiscountPercent === null || Number.isNaN(taxOrDiscountPercent)) {
    return { subtotal, total: subtotal }
  }
  const adjustment = subtotal * (taxOrDiscountPercent / 100)
  const total = subtotal + adjustment
  return { subtotal, total }
}

const buildInvoiceWritePayload = (
  payload: InvoiceWritePayload,
  existingItemCount = 0,
) => {
  const client = sanitizeClientPayload(payload.client)
  const items = sanitizeItemsPayload(payload.items)
  const taxOrDiscountPercent =
    payload.taxOrDiscountPercent !== null && !Number.isNaN(payload.taxOrDiscountPercent)
      ? payload.taxOrDiscountPercent
      : null
  const { subtotal, total } = computeTotals(items, taxOrDiscountPercent)

  const result: Record<string, unknown> = {
    baseInvoiceNumber: payload.baseInvoiceNumber,
    companyName: client.companyName,
    addressLine1: client.addressLine1,
    addressLine2: client.addressLine2,
    addressLine3: client.addressLine3,
    region: client.region,
    representative: client.representative,
    itemsCount: items.length,
    subtotal,
    taxOrDiscountPercent,
    total,
    amount: total,
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

  return result
}

const determineBaseInvoiceNumber = (base: string) => base.trim()

const determineInvoiceIds = (
  baseInvoiceNumber: string,
  existingIds: string[],
): { collectionId: string; invoiceNumber: string } => {
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

export interface CreateInvoiceInput extends InvoiceWritePayload {
  year: string
  projectId: string
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

  const projectRef = doc(projectsDb, input.year, input.projectId)
  const collectionRef = collection(projectRef, collectionId)
  const documentRef = doc(collectionRef, invoiceNumber)

  const payload = buildInvoiceWritePayload({
    baseInvoiceNumber,
    client: input.client,
    items: input.items,
    taxOrDiscountPercent: input.taxOrDiscountPercent,
  })

  payload.invoiceNumber = invoiceNumber
  payload.baseInvoiceNumber = baseInvoiceNumber
  payload.createdAt = serverTimestamp()
  payload.updatedAt = serverTimestamp()

  await setDoc(documentRef, payload)

  try {
    await updateDoc(projectRef, { invoiceCollections: arrayUnion(collectionId) })
  } catch (error) {
    console.warn("[projectInvoices] Failed to update invoiceCollections", {
      projectId: input.projectId,
      collectionId,
      error,
    })
  }

  const snapshot = await getDoc(documentRef)
  if (!snapshot.exists()) {
    throw new Error("Failed to read created invoice")
  }

  return buildInvoiceRecord(collectionId, snapshot.id, snapshot.data())
}

export interface UpdateInvoiceInput extends InvoiceWritePayload {
  year: string
  projectId: string
  collectionId: string
  invoiceNumber: string
}

export const updateInvoiceForProject = async (
  input: UpdateInvoiceInput,
): Promise<ProjectInvoiceRecord> => {
  const projectRef = doc(projectsDb, input.year, input.projectId)
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
    },
    existingCount,
  )

  payload.updatedAt = serverTimestamp()

  await updateDoc(documentRef, payload)

  try {
    await updateDoc(projectRef, { invoiceCollections: arrayUnion(input.collectionId) })
  } catch (error) {
    console.warn("[projectInvoices] Failed to ensure invoiceCollections membership", {
      projectId: input.projectId,
      collectionId: input.collectionId,
      error,
    })
  }

  const refreshed = await getDoc(documentRef)
  if (!refreshed.exists()) {
    throw new Error("Failed to retrieve updated invoice")
  }

  return buildInvoiceRecord(input.collectionId, refreshed.id, refreshed.data())
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
  const first = invoices[0]
  return {
    invoiceNumber: first.invoiceNumber,
    amount: first.total ?? first.amount ?? null,
    clientCompany: first.companyName ?? null,
  }
}
