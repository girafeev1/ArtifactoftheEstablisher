import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"

import { fetchProjectsFromDatabase } from "../../../lib/projectsDatabase"
import { fetchInvoicesForProject } from "../../../lib/projectInvoices"
import { getAuthOptions } from "../auth/[...nextauth]"

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const normalizeQueryValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
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

  const rawYear = normalizeQueryValue(req.query.year)
  const rawSubsidiary = normalizeQueryValue(req.query.subsidiary)
  const metaOnlyFlag = normalizeQueryValue(req.query.metaOnly)
  const year = isNonEmptyString(rawYear) ? rawYear.trim() : null
  const subsidiary = isNonEmptyString(rawSubsidiary) ? rawSubsidiary.trim() : null
  const returnMetadataOnly =
    typeof metaOnlyFlag === "string" && ["1", "true"].includes(metaOnlyFlag.toLowerCase())

  try {
    const identity = session.user.email ?? session.user.name ?? "unknown"
    const normalizedSubsidiary = subsidiary ? subsidiary.toLowerCase() : null
    console.info("[api/projects] GET request received", {
      user: identity,
      filters: {
        year: year ?? null,
        subsidiary: normalizedSubsidiary ?? null,
      },
    })

    const { projects, years } = await fetchProjectsFromDatabase()

    const allSubsidiaries = Array.from(
      new Set(
        projects
          .map((project) => project.subsidiary?.trim())
          .filter((value): value is string => Boolean(value && value.length > 0)),
      ),
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

    const filtered = returnMetadataOnly
      ? []
      : projects.filter((project) => {
          if (year && project.year !== year) {
            return false
          }
          if (normalizedSubsidiary) {
            const candidate = project.subsidiary?.trim().toLowerCase() ?? ""
            if (candidate !== normalizedSubsidiary) {
              return false
            }
          }
          return true
        })

    const enriched = returnMetadataOnly
      ? []
      : await Promise.all(
          filtered.map(async (project) => {
            try {
              const invoices = await fetchInvoicesForProject(project.year, project.id)
              if (invoices && invoices.length > 0) {
                const cleared = invoices.filter((i) => i.paid === true).length
                const total = invoices.length
                const outstanding = Math.max(total - cleared, 0)
                // Aggregate totals
                let aggregatedTotal = 0
                let hasAmount = false
                invoices.forEach((inv) => {
                  const value =
                    typeof inv.total === "number" && !Number.isNaN(inv.total)
                      ? inv.total
                      : typeof inv.amount === "number" && !Number.isNaN(inv.amount)
                      ? inv.amount
                      : null
                  if (value !== null) {
                    aggregatedTotal += value
                    hasAmount = true
                  }
                })
                // Latest paid-on
                let lastPaidIso: string | null = null
                let lastPaidDisplay: string | null = null
                let lastTs = Number.NEGATIVE_INFINITY
                invoices.forEach((inv) => {
                  if (inv.paid === true && inv.paidOnIso) {
                    const ts = new Date(inv.paidOnIso).getTime()
                    if (!Number.isNaN(ts) && ts >= lastTs) {
                      lastTs = ts
                      lastPaidIso = inv.paidOnIso
                      lastPaidDisplay = inv.paidOnDisplay ?? inv.paidOnIso
                    }
                  }
                })
                const label =
                  cleared === 0
                    ? "Due"
                    : cleared < total
                    ? "Partially Cleared"
                    : "All Clear"
                const primary = invoices[0]
                return {
                  ...project,
                  amount: hasAmount ? aggregatedTotal : project.amount,
                  clientCompany: primary?.companyName ?? project.clientCompany,
                  _invoiceSummary: {
                    total,
                    cleared,
                    outstanding,
                    lastPaidOnDisplay: lastPaidDisplay,
                    label,
                  },
                }
              }
            } catch (summaryError) {
              console.error("[api/projects] Failed to aggregate invoices", {
                projectId: project.id,
                error:
                  summaryError instanceof Error
                    ? { message: summaryError.message, stack: summaryError.stack }
                    : { message: "Unknown error", raw: summaryError },
              })
            }
            return project
          }),
        )

    const subsidiariesForResponse = returnMetadataOnly
      ? allSubsidiaries
      : Array.from(
          new Set(
            filtered
              .map((project) => project.subsidiary?.trim())
              .filter((value): value is string => Boolean(value && value.length > 0)),
          ),
        ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

    console.info("[api/projects] Responding to GET request", {
      user: identity,
      total: filtered.length,
      filters: {
        year: year ?? null,
        subsidiary: normalizedSubsidiary ?? null,
      },
      metaOnly: returnMetadataOnly,
    })

    return res.status(200).json({
      data: enriched,
      total: filtered.length,
      years,
      subsidiaries: subsidiariesForResponse,
    })
  } catch (error) {
    console.error("[api/projects] Failed to respond to GET request", {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { message: "Unknown error", raw: error },
    })
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : "Failed to load projects" })
  }
}
