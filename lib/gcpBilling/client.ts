/**
 * GCP Billing Client
 *
 * Queries GCP billing data from BigQuery export for:
 * - Cost breakdowns by service/project
 * - Invoice matching for bank transactions
 * - Evidence generation for transaction details
 */

import { BigQuery } from '@google-cloud/bigquery'
import type {
  GCPBillingConfig,
  GCPBillingQuery,
  GCPDailyCost,
  GCPMonthlyInvoice,
  GCPCostBreakdown,
  GCPTransactionEvidence,
} from './types'

// ============================================================================
// Configuration
// ============================================================================

function getConfig(): GCPBillingConfig {
  const projectId = process.env.GCP_BILLING_PROJECT_ID || process.env.GOOGLE_PROJECT_ID || ''
  const datasetId = process.env.GCP_BILLING_DATASET_ID || ''
  const tableId = process.env.GCP_BILLING_TABLE_ID || 'gcp_billing_export_v1'
  const clientEmail = process.env.GCP_BILLING_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || ''
  const privateKey = (process.env.GCP_BILLING_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')

  return { projectId, datasetId, tableId, clientEmail, privateKey }
}

export function isGCPBillingConfigured(): boolean {
  const config = getConfig()
  return Boolean(config.projectId && config.datasetId && config.clientEmail && config.privateKey)
}

// ============================================================================
// BigQuery Client
// ============================================================================

let bigQueryClient: BigQuery | null = null

function getBigQueryClient(): BigQuery {
  if (bigQueryClient) return bigQueryClient

  const config = getConfig()
  if (!config.projectId || !config.clientEmail || !config.privateKey) {
    throw new Error('GCP Billing is not configured. Missing required credentials.')
  }

  bigQueryClient = new BigQuery({
    projectId: config.projectId,
    credentials: {
      client_email: config.clientEmail,
      private_key: config.privateKey,
    },
  })

  return bigQueryClient
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get daily costs for a date range
 */
export async function getDailyCosts(query: GCPBillingQuery): Promise<GCPDailyCost[]> {
  const config = getConfig()
  const bq = getBigQueryClient()
  const tablePath = `${config.projectId}.${config.datasetId}.${config.tableId}`

  let sql = `
    SELECT
      DATE(usage_start_time) as date,
      service.description as service,
      service.id as serviceId,
      project.name as project,
      project.id as projectId,
      SUM(cost) as cost,
      SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) as credits,
      currency
    FROM \`${tablePath}\`
    WHERE DATE(usage_start_time) >= @startDate
      AND DATE(usage_start_time) <= @endDate
  `

  const params: Record<string, string> = {
    startDate: query.startDate,
    endDate: query.endDate,
  }

  if (query.projectId) {
    sql += ' AND project.id = @projectId'
    params.projectId = query.projectId
  }

  if (query.serviceId) {
    sql += ' AND service.id = @serviceId'
    params.serviceId = query.serviceId
  }

  sql += `
    GROUP BY date, service, serviceId, project, projectId, currency
    ORDER BY date DESC, cost DESC
  `

  const [rows] = await bq.query({
    query: sql,
    params,
  })

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    date: String(row.date),
    service: String(row.service),
    serviceId: String(row.serviceId),
    project: String(row.project),
    projectId: String(row.projectId),
    cost: Number(row.cost) || 0,
    credits: Number(row.credits) || 0,
    netCost: (Number(row.cost) || 0) + (Number(row.credits) || 0),
    currency: String(row.currency) || 'USD',
  }))
}

/**
 * Get monthly invoice summary
 */
export async function getMonthlyInvoice(invoiceMonth: string): Promise<GCPMonthlyInvoice | null> {
  const config = getConfig()
  const bq = getBigQueryClient()
  const tablePath = `${config.projectId}.${config.datasetId}.${config.tableId}`

  const sql = `
    SELECT
      invoice.month as invoiceMonth,
      service.description as service,
      project.name as project,
      SUM(cost) as cost,
      SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) as credits,
      currency
    FROM \`${tablePath}\`
    WHERE invoice.month = @invoiceMonth
    GROUP BY invoiceMonth, service, project, currency
    ORDER BY cost DESC
  `

  const [rows] = await bq.query({
    query: sql,
    params: { invoiceMonth },
  })

  if (!rows || rows.length === 0) return null

  const typedRows = rows as Array<Record<string, unknown>>
  const currency = String(typedRows[0]?.currency) || 'USD'
  let totalCost = 0
  let totalCredits = 0
  const serviceMap = new Map<string, number>()
  const projectMap = new Map<string, number>()

  for (const row of typedRows) {
    const cost = Number(row.cost) || 0
    const credits = Number(row.credits) || 0
    totalCost += cost
    totalCredits += credits

    const service = String(row.service)
    serviceMap.set(service, (serviceMap.get(service) || 0) + cost)

    const project = String(row.project)
    projectMap.set(project, (projectMap.get(project) || 0) + cost)
  }

  return {
    invoiceMonth,
    totalCost,
    totalCredits,
    netCost: totalCost + totalCredits,
    currency,
    services: Array.from(serviceMap.entries())
      .map(([service, cost]) => ({ service, cost }))
      .sort((a, b) => b.cost - a.cost),
    projects: Array.from(projectMap.entries())
      .map(([project, cost]) => ({ project, cost }))
      .sort((a, b) => b.cost - a.cost),
  }
}

/**
 * Get cost breakdown by service and project
 */
export async function getCostBreakdown(query: GCPBillingQuery): Promise<GCPCostBreakdown> {
  const config = getConfig()
  const bq = getBigQueryClient()
  const tablePath = `${config.projectId}.${config.datasetId}.${config.tableId}`

  const sql = `
    SELECT
      service.description as service,
      service.id as serviceId,
      project.name as project,
      project.id as projectId,
      SUM(cost) as cost,
      currency
    FROM \`${tablePath}\`
    WHERE DATE(usage_start_time) >= @startDate
      AND DATE(usage_start_time) <= @endDate
    GROUP BY service, serviceId, project, projectId, currency
    ORDER BY cost DESC
  `

  const [rows] = await bq.query({
    query: sql,
    params: {
      startDate: query.startDate,
      endDate: query.endDate,
    },
  })

  const typedRows = rows as Array<Record<string, unknown>>
  let totalCost = 0
  const serviceMap = new Map<string, { serviceId: string; cost: number }>()
  const projectMap = new Map<string, { projectId: string; cost: number }>()

  for (const row of typedRows) {
    const cost = Number(row.cost) || 0
    totalCost += cost

    const service = String(row.service)
    const serviceId = String(row.serviceId)
    const existing = serviceMap.get(service)
    serviceMap.set(service, {
      serviceId,
      cost: (existing?.cost || 0) + cost,
    })

    const project = String(row.project)
    const projectId = String(row.projectId)
    const existingProject = projectMap.get(project)
    projectMap.set(project, {
      projectId,
      cost: (existingProject?.cost || 0) + cost,
    })
  }

  const currency = typedRows.length > 0 ? String(typedRows[0].currency) : 'USD'

  return {
    startDate: query.startDate,
    endDate: query.endDate,
    byService: Array.from(serviceMap.entries())
      .map(([service, data]) => ({
        service,
        serviceId: data.serviceId,
        cost: data.cost,
        percentage: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost),
    byProject: Array.from(projectMap.entries())
      .map(([project, data]) => ({
        project,
        projectId: data.projectId,
        cost: data.cost,
        percentage: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost),
    totalCost,
    currency,
  }
}

/**
 * Find GCP billing evidence for a bank transaction
 * Matches based on amount and approximate date
 */
export async function findTransactionEvidence(
  transactionDate: string,
  transactionAmount: number,
  transactionId: string
): Promise<GCPTransactionEvidence | null> {
  const config = getConfig()
  if (!isGCPBillingConfigured()) return null

  // Look at the invoice month based on transaction date
  const txDate = new Date(transactionDate)
  // GCP invoices usually appear 1-2 months after usage
  const invoiceMonth = `${txDate.getFullYear()}${String(txDate.getMonth()).padStart(2, '0')}`
  const prevMonth = txDate.getMonth() === 0
    ? `${txDate.getFullYear() - 1}12`
    : `${txDate.getFullYear()}${String(txDate.getMonth() - 1).padStart(2, '0')}`

  // Try to find matching invoice
  let invoice = await getMonthlyInvoice(invoiceMonth)
  let matchedMonth = invoiceMonth

  if (!invoice) {
    invoice = await getMonthlyInvoice(prevMonth)
    matchedMonth = prevMonth
  }

  if (!invoice) return null

  // Check if amount roughly matches
  const netCost = Math.abs(invoice.netCost)
  const txAmount = Math.abs(transactionAmount)
  const tolerance = 0.1 // 10% tolerance

  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (Math.abs(netCost - txAmount) / txAmount < 0.01) {
    confidence = 'high'
  } else if (Math.abs(netCost - txAmount) / txAmount < tolerance) {
    confidence = 'medium'
  } else {
    // Amount doesn't match well
    return null
  }

  // Build breakdown
  const breakdown = invoice.services.slice(0, 5).map((s) => ({
    service: s.service,
    project: invoice!.projects[0]?.project || 'Unknown',
    cost: s.cost,
  }))

  return {
    transactionId,
    transactionDate,
    transactionAmount,
    invoiceMonth: matchedMonth,
    billingPeriod: {
      start: `${matchedMonth.slice(0, 4)}-${matchedMonth.slice(4)}-01`,
      end: `${matchedMonth.slice(0, 4)}-${matchedMonth.slice(4)}-${new Date(
        parseInt(matchedMonth.slice(0, 4)),
        parseInt(matchedMonth.slice(4)),
        0
      ).getDate()}`,
    },
    matchedCost: invoice.netCost,
    matchConfidence: confidence,
    breakdown,
    billingAccountId: config.projectId,
    queryTimestamp: new Date().toISOString(),
  }
}

// ============================================================================
// Export
// ============================================================================

export const gcpBillingClient = {
  isConfigured: isGCPBillingConfigured,
  getDailyCosts,
  getMonthlyInvoice,
  getCostBreakdown,
  findTransactionEvidence,
}

export default gcpBillingClient
