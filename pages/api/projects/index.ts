import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth/next"

import { fetchProjectsFromDatabase } from "../../../lib/projectsDatabase"
import { fetchInvoicesForProject } from "../../../lib/projectInvoices"
import { getInvoicePaymentInfo } from "../../../lib/accounting/transactions"
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
                // Check each invoice for payment from transactions
                let cleared = 0
                let drafted = 0
                let issued = 0
                let lastPaidIso: string | null = null
                let lastPaidDisplay: string | null = null
                let lastTs = Number.NEGATIVE_INFINITY

                for (const inv of invoices) {
                  // Check invoice paymentStatus to distinguish Draft from Due
                  const invoiceStatus = (inv.paymentStatus ?? '').toLowerCase().trim()
                  const isDraft = invoiceStatus === 'draft' || invoiceStatus === 'drafted' || invoiceStatus === ''

                  if (isDraft) {
                    drafted++
                  } else {
                    issued++
                    // Only check payment info for issued invoices
                    const paymentInfo = await getInvoicePaymentInfo(
                      inv.invoiceNumber,
                      project.id,
                      project.year,
                    )

                    const invoiceTotal = inv.total ?? 0
                    const amountPaid = paymentInfo?.amountPaid ?? 0
                    const isFullyPaid = invoiceTotal > 0 && Math.abs(amountPaid - invoiceTotal) < 0.01

                    if (isFullyPaid) {
                      cleared++
                      if (paymentInfo?.paidOn) {
                        const ts = paymentInfo.paidOn.getTime()
                        if (!Number.isNaN(ts) && ts >= lastTs) {
                          lastTs = ts
                          lastPaidIso = paymentInfo.paidOn.toISOString()
                          lastPaidDisplay = paymentInfo.paidOn.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        }
                      }
                    }
                  }
                }

                const total = invoices.length
                const outstanding = Math.max(issued - cleared, 0)

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

                // Determine label based on invoice statuses:
                // - All invoices are drafts → "Pending"
                // - Some issued, none cleared → "Due"
                // - Some cleared, some outstanding → "Partially Cleared"
                // - All issued invoices cleared → "All Cleared"
                let label: string
                if (drafted === total) {
                  // All invoices are still drafts (not yet issued)
                  label = "Pending"
                } else if (cleared === 0) {
                  // Some issued but none cleared
                  label = "Due"
                } else if (cleared < issued) {
                  // Some cleared but not all issued ones
                  label = "Partially Cleared"
                } else {
                  // All issued invoices are cleared
                  label = drafted > 0 ? "Partially Cleared" : "All Cleared"
                }

                const primary = invoices[0]
                return {
                  ...project,
                  amount: hasAmount ? aggregatedTotal : project.amount,
                  clientCompany: primary?.companyName ?? project.clientCompany,
                  _invoiceSummary: {
                    total,
                    cleared,
                    outstanding,
                    drafted,
                    issued,
                    lastPaidOnDisplay: lastPaidDisplay,
                    label,
                  },
                }
              } else {
                // No invoices - return "On Hold" status
                return {
                  ...project,
                  _invoiceSummary: {
                    total: 0,
                    cleared: 0,
                    outstanding: 0,
                    drafted: 0,
                    issued: 0,
                    lastPaidOnDisplay: null,
                    label: "On Hold",
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
