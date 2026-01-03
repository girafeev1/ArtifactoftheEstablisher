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

    let matchedClient: ClientDirectoryRecord | null = null
    const projectCompanyKey = normalizeCompanyKey(project.clientCompany)

    if (projectCompanyKey) {
      try {
        const clients = await fetchClientsDirectory()
        matchedClient =
          clients.find((client) => {
            const companyKey = normalizeCompanyKey(client.companyName)
            const documentKey = normalizeCompanyKey(client.documentId)
            return companyKey === projectCompanyKey || documentKey === projectCompanyKey
          }) ?? null
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
    let aggregatedPayTo: string | null = null

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
        if (!aggregatedPayTo && invoice.payTo) {
          aggregatedPayTo = invoice.payTo
        }
      } else if (invoice.paid === false && aggregatedPaid === null) {
        aggregatedPaid = false
        if (!aggregatedPaidOnDisplay && invoice.paidOnDisplay) {
          aggregatedPaidOnDisplay = invoice.paidOnDisplay
        }
        if (!aggregatedPaidOnIso && invoice.paidOnIso) {
          aggregatedPaidOnIso = invoice.paidOnIso
        }
        if (!aggregatedPayTo && invoice.payTo) {
          aggregatedPayTo = invoice.payTo
        }
      } else {
        if (!aggregatedPaidOnDisplay && invoice.paidOnDisplay) {
          aggregatedPaidOnDisplay = invoice.paidOnDisplay
        }
        if (!aggregatedPaidOnIso && invoice.paidOnIso) {
          aggregatedPaidOnIso = invoice.paidOnIso
        }
        if (!aggregatedPayTo && invoice.payTo) {
          aggregatedPayTo = invoice.payTo
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
      payTo: aggregatedPayTo ?? project.payTo,
    }

    console.info("[api/projects/:id] Project resolved", {
      user: identity,
      projectId,
      projectNumber: project.projectNumber,
    })

    return res
      .status(200)
      .json({ data: projectPayload, client: matchedClient, invoices })
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
