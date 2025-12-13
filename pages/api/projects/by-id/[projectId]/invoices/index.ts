import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"

import { fetchProjectsFromDatabase, type ProjectRecord } from "../../../../../../lib/projectsDatabase"
import {
  createInvoiceForProject,
  fetchInvoicesForProject,
  type InvoiceClientPayload,
  type InvoiceItemPayload,
  updateInvoiceForProject,
  deleteInvoiceForProject,
} from "../../../../../../lib/projectInvoices"
import { getAuthOptions } from "../../../../auth/[...nextauth]"

const toStringValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (value instanceof String) {
    const trimmed = value.toString().trim()
    return trimmed.length > 0 ? trimmed : null
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

const buildBaseInvoiceNumber = (project: ProjectRecord) => {
  const projectNumber = project.projectNumber?.trim() ?? project.id
  const iso = project.projectDateIso ?? project.onDateIso
  if (!iso) {
    return projectNumber
  }
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return projectNumber
  }
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0")
  const day = `${parsed.getDate()}`.padStart(2, "0")
  return `${projectNumber}-${month}${day}`
}

const normalizeClientPayload = (value: unknown, fallbackCompany: string | null): InvoiceClientPayload => {
  const input = (value && typeof value === "object") ? (value as Record<string, unknown>) : {}
  const representativeRaw = (input as any).representative
  const representative =
    representativeRaw && typeof representativeRaw === "object"
      ? representativeRaw
      : toStringValue(representativeRaw)

  // Keep accepting legacy payloads where title + representative were separate fields.
  // The server-side sanitizer will normalize these into the representative map.
  return {
    companyName: toStringValue(input.companyName) ?? fallbackCompany ?? null,
    addressLine1: toStringValue(input.addressLine1),
    addressLine2: toStringValue(input.addressLine2),
    addressLine3: toStringValue(input.addressLine3),
    region: toStringValue(input.region),
    representative: (representative as any) ?? null,
    ...(toStringValue((input as any).title) ? { title: toStringValue((input as any).title) } : {}),
  } as any
}

const normalizeItemsPayload = (value: unknown): InvoiceItemPayload[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null
      }
      const record = entry as Record<string, unknown>
      return {
        title: toStringValue(record.title ?? record.name) ?? "",
        feeType: toStringValue(record.feeType ?? record.description) ?? "",
        unitPrice: toNumberValue(record.unitPrice) ?? 0,
        quantity: toNumberValue(record.quantity) ?? 0,
        discount: toNumberValue(record.discount) ?? 0,
        subQuantity: toStringValue(record.subQuantity ?? record.subQty) ?? "",
        notes: toStringValue(record.notes) ?? "",
        quantityUnit: toStringValue(record.quantityUnit ?? record.unit ?? record.unitType) ?? "",
      }
    })
    .filter((item): item is InvoiceItemPayload => Boolean(item))
}

const respondWithInvoices = async (
  res: NextApiResponse,
  project: ProjectRecord,
  status: number,
) => {
  const invoices = await fetchInvoicesForProject(project.year, project.id)
  return res.status(status).json({ invoices })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const rawId = Array.isArray(req.query.projectId) ? req.query.projectId[0] : req.query.projectId
  const projectId = typeof rawId === "string" ? rawId.trim() : ""

  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required" })
  }

  if (!["POST", "PATCH", "DELETE"].includes(req.method ?? "")) {
    res.setHeader("Allow", "POST, PATCH, DELETE")
    return res.status(405).json({ error: "Method Not Allowed" })
  }

  try {
    const identity = session.user.email ?? session.user.name ?? "unknown"
    const { projects } = await fetchProjectsFromDatabase()

    const project = projects.find((entry) => {
      const normalizedId = entry.id?.trim()
      const normalizedNumber = entry.projectNumber?.trim()
      return normalizedId === projectId || normalizedNumber === projectId
    })

    if (!project) {
      console.warn("[api/projects/:id/invoices] Project not found", { user: identity, projectId })
      return res.status(404).json({ error: "Project not found" })
    }

    if (req.method === "POST") {
      const body = req.body ?? {}
      const baseInvoiceNumber =
        toStringValue(body.baseInvoiceNumber) ?? buildBaseInvoiceNumber(project)
      const client = normalizeClientPayload(body.client, project.clientCompany)
      const items = normalizeItemsPayload(body.items)
      const taxOrDiscountPercent = toNumberValue(body.taxOrDiscountPercent)
      const paymentStatus = toStringValue(body.paymentStatus)
      const paidTo = toStringValue(body.paidTo)
      const paidOn = toStringValue(body.paidOn) ?? (body.paidOn ?? null)

      const created = await createInvoiceForProject({
        year: project.year,
        projectId: project.id,
        baseInvoiceNumber,
        client,
        items,
        taxOrDiscountPercent,
        paymentStatus,
        paidTo,
        paidOn,
        editedBy: identity,
      })

      console.info("[api/projects/:id/invoices] Invoice created", {
        user: identity,
        projectId,
        invoiceNumber: created.invoiceNumber,
      })

      return respondWithInvoices(res, project, 201)
    }

    if (req.method === "PATCH") {
      const body = req.body ?? {}
      const collectionId = toStringValue(body.collectionId)
      const invoiceNumber = toStringValue(body.invoiceNumber)?.replace(/^#/, '')
      const originalInvoiceNumber = toStringValue(body.originalInvoiceNumber)?.replace(/^#/, '')

      if (!collectionId || !invoiceNumber) {
        return res.status(400).json({ error: "collectionId and invoiceNumber are required" })
      }

      const client = normalizeClientPayload(body.client, project.clientCompany)
      const items = normalizeItemsPayload(body.items)
      const taxOrDiscountPercent = toNumberValue(body.taxOrDiscountPercent)
      const paymentStatus = toStringValue(body.paymentStatus)
      const paidTo = toStringValue(body.paidTo)
      const paidOn = toStringValue(body.paidOn) ?? (body.paidOn ?? null)

      const updated = await updateInvoiceForProject({
        year: project.year,
        projectId: project.id,
        collectionId,
        invoiceNumber: invoiceNumber!,
        baseInvoiceNumber: invoiceNumber!,
        originalInvoiceNumber: originalInvoiceNumber ?? undefined,
        client,
        items,
        taxOrDiscountPercent,
        paymentStatus,
        paidTo,
        paidOn,
        editedBy: identity,
      })

      console.info("[api/projects/:id/invoices] Invoice updated", {
        user: identity,
        projectId,
        invoiceNumber: updated.invoiceNumber,
      })

      return respondWithInvoices(res, project, 200)
    }

    if (req.method === "DELETE") {
      const body = req.body ?? {}
      const collectionId = toStringValue(body.collectionId)
      const invoiceNumber = toStringValue(body.invoiceNumber)?.replace(/^#/, '')
      if (!collectionId || !invoiceNumber) {
        return res.status(400).json({ error: "collectionId and invoiceNumber are required" })
      }
      await deleteInvoiceForProject({
        year: project.year,
        projectId: project.id,
        collectionId,
        invoiceNumber: invoiceNumber!,
        editedBy: identity,
      })
      return respondWithInvoices(res, project, 200)
    }

    return res.status(405).json({ error: "Method Not Allowed" })
  } catch (error) {
    console.error("[api/projects/:id/invoices] Request failed", {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    })
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : "Failed to process invoice" })
  }
}
