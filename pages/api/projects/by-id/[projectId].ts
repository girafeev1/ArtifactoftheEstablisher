import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"

import { fetchClientsDirectory, type ClientDirectoryRecord } from "../../../../lib/clientDirectory"
import { fetchProjectsFromDatabase } from "../../../../lib/projectsDatabase"
import {
  fetchInvoicesForProject,
  type ProjectInvoiceRecord,
} from "../../../../lib/projectInvoices"
import { getAuthOptions } from "../../auth/[...nextauth]"

const toStringValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

const normalizeCompanyKey = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed.toLowerCase() : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method Not Allowed" })
  }

  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const rawId = toStringValue(req.query.projectId)
  const projectId = typeof rawId === "string" ? rawId.trim() : ""

  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required" })
  }

  try {
    const identity = session.user.email ?? session.user.name ?? "unknown"
    console.info("[api/projects/:id] GET request received", {
      user: identity,
      projectId,
    })

    const { projects } = await fetchProjectsFromDatabase()

    const project = projects.find((entry) => {
      const normalizedId = entry.id?.trim()
      const normalizedNumber = entry.projectNumber?.trim()
      return normalizedId === projectId || normalizedNumber === projectId
    })

    if (!project) {
      console.warn("[api/projects/:id] Project not found", { user: identity, projectId })
      return res.status(404).json({ error: "Project not found" })
    }

    let invoices: ProjectInvoiceRecord[] = []

    try {
      invoices = await fetchInvoicesForProject(project.year, project.id)
    } catch (invoiceError) {
      console.error("[api/projects/:id] Failed to fetch invoices", {
        projectId,
        error:
          invoiceError instanceof Error
            ? { message: invoiceError.message, stack: invoiceError.stack }
            : { message: "Unknown error", raw: invoiceError },
      })
    }

    const projectCompanyKey = normalizeCompanyKey(project.clientCompany)
    const invoiceCompanyKeys = new Set<string>()
    invoices.forEach((invoice) => {
      const key = normalizeCompanyKey(invoice.companyName)
      if (key) {
        invoiceCompanyKeys.add(key)
      }
    })

    const keysToResolve = new Set<string>()
    if (projectCompanyKey) {
      keysToResolve.add(projectCompanyKey)
    }
    invoiceCompanyKeys.forEach((key) => keysToResolve.add(key))

    let matchedClient: ClientDirectoryRecord | null = null
    let matchedDirectoryRecords: ClientDirectoryRecord[] = []

    if (keysToResolve.size > 0) {
      try {
        const clients = await fetchClientsDirectory()
        const recordByKey = new Map<string, ClientDirectoryRecord>()

        clients.forEach((clientRecord) => {
          const companyKey = normalizeCompanyKey(clientRecord.companyName)
          const documentKey = normalizeCompanyKey(clientRecord.documentId)

          if (companyKey && !recordByKey.has(companyKey)) {
            recordByKey.set(companyKey, clientRecord)
          }
          if (documentKey && !recordByKey.has(documentKey)) {
            recordByKey.set(documentKey, clientRecord)
          }
        })

        const collected: ClientDirectoryRecord[] = []

        keysToResolve.forEach((key) => {
          const record = recordByKey.get(key)
          if (record) {
            collected.push(record)
            if (!matchedClient && projectCompanyKey && key === projectCompanyKey) {
              matchedClient = record
            }
          }
        })

        if (!matchedClient && projectCompanyKey) {
          matchedClient = recordByKey.get(projectCompanyKey) ?? null
        }

        const uniqueRecords = new Map<string, ClientDirectoryRecord>()
        collected.forEach((record) => {
          const idKey = record.documentId ?? record.companyName
          if (idKey && !uniqueRecords.has(idKey)) {
            uniqueRecords.set(idKey, record)
          }
        })

        matchedDirectoryRecords = Array.from(uniqueRecords.values())

        if (matchedClient && !uniqueRecords.has(matchedClient.documentId ?? matchedClient.companyName)) {
          matchedDirectoryRecords.push(matchedClient)
        }
      } catch (clientError) {
        console.error("[api/projects/:id] Failed to resolve client details", {
          projectId,
          company: project.clientCompany,
          error:
            clientError instanceof Error
              ? { message: clientError.message, stack: clientError.stack }
              : { message: "Unknown error", raw: clientError },
        })
      }
    }

    let aggregatedAmount = 0
    let hasAggregatedAmount = false
    let aggregatedPaid: boolean | null = null
    let aggregatedPaidOnDisplay: string | null = null
    let aggregatedPaidOnIso: string | null = null
    let aggregatedPaidTo: string | null = null

    invoices.forEach((invoice) => {
      if (typeof invoice.total === "number" && !Number.isNaN(invoice.total)) {
        aggregatedAmount += invoice.total
        hasAggregatedAmount = true
      } else if (typeof invoice.amount === "number" && !Number.isNaN(invoice.amount)) {
        aggregatedAmount += invoice.amount
        hasAggregatedAmount = true
      }

      if (invoice.paid === true) {
        aggregatedPaid = true
        if (!aggregatedPaidOnDisplay && invoice.paidOnDisplay) {
          aggregatedPaidOnDisplay = invoice.paidOnDisplay
        }
        if (!aggregatedPaidOnIso && invoice.paidOnIso) {
          aggregatedPaidOnIso = invoice.paidOnIso
        }
        if (!aggregatedPaidTo && invoice.paidTo) {
          aggregatedPaidTo = invoice.paidTo
        }
      } else if (invoice.paid === false && aggregatedPaid === null) {
        aggregatedPaid = false
        if (!aggregatedPaidOnDisplay && invoice.paidOnDisplay) {
          aggregatedPaidOnDisplay = invoice.paidOnDisplay
        }
        if (!aggregatedPaidOnIso && invoice.paidOnIso) {
          aggregatedPaidOnIso = invoice.paidOnIso
        }
        if (!aggregatedPaidTo && invoice.paidTo) {
          aggregatedPaidTo = invoice.paidTo
        }
      } else {
        if (!aggregatedPaidOnDisplay && invoice.paidOnDisplay) {
          aggregatedPaidOnDisplay = invoice.paidOnDisplay
        }
        if (!aggregatedPaidOnIso && invoice.paidOnIso) {
          aggregatedPaidOnIso = invoice.paidOnIso
        }
        if (!aggregatedPaidTo && invoice.paidTo) {
          aggregatedPaidTo = invoice.paidTo
        }
      }
    })

    const primaryInvoice = invoices[0]
    const projectPayload = {
      ...project,
      amount: hasAggregatedAmount ? aggregatedAmount : project.amount,
      invoice: primaryInvoice?.invoiceNumber ?? project.invoice,
      clientCompany: primaryInvoice?.companyName ?? project.clientCompany,
      paid: aggregatedPaid ?? project.paid,
      onDateDisplay: aggregatedPaidOnDisplay ?? project.onDateDisplay,
      onDateIso: aggregatedPaidOnIso ?? project.onDateIso,
      paidTo: aggregatedPaidTo ?? project.paidTo,
    }

    console.info("[api/projects/:id] Project resolved", {
      user: identity,
      projectId,
      projectNumber: project.projectNumber,
    })

    return res
      .status(200)
      .json({ data: projectPayload, client: matchedClient, clients: matchedDirectoryRecords, invoices })
  } catch (error) {
    console.error("[api/projects/:id] Failed to fetch project", {
      projectId,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { message: "Unknown error", raw: error },
    })
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : "Failed to load project" })
  }
}
