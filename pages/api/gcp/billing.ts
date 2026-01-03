/**
 * API: GET /api/gcp/billing
 * Returns GCP billing data from BigQuery export
 *
 * Query params:
 *   - month: YYYY-MM format (defaults to current month)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { getAuthOptions } from '../auth/[...nextauth]'
import { BigQuery } from '@google-cloud/bigquery'

interface ServiceCost {
  name: string
  cost: number
  percentOfTotal: number
}

interface BillingResponse {
  currentMonthCost: number
  projectedMonthCost: number
  budgetLimit: number
  currency: string
  lastUpdated: string
  services: ServiceCost[]
  dailyCosts: { date: string; cost: number }[]
}

// Initialize BigQuery client
const getBigQueryClient = () => {
  const projectId = process.env.GCP_BILLING_PROJECT_ID
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing GCP credentials')
  }

  return new BigQuery({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check authentication
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const bigquery = getBigQueryClient()
    const datasetId = process.env.GCP_BILLING_DATASET_ID
    const tableId = process.env.GCP_BILLING_TABLE_ID

    if (!datasetId || !tableId) {
      return res.status(500).json({ error: 'Missing BigQuery dataset/table configuration' })
    }

    // Get month parameter or default to current month
    const now = new Date()
    const monthParam = req.query.month as string
    let targetMonth: string

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      targetMonth = monthParam
    } else {
      targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }

    const [year, month] = targetMonth.split('-').map(Number)
    const startDate = `${targetMonth}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0] // Last day of month

    // Query 1: Total cost for current month by service
    const serviceCostQuery = `
      SELECT
        service.description as service_name,
        SUM(cost) as total_cost,
        currency
      FROM \`${process.env.GCP_BILLING_PROJECT_ID}.${datasetId}.${tableId}\`
      WHERE
        DATE(usage_start_time) >= '${startDate}'
        AND DATE(usage_start_time) <= '${endDate}'
      GROUP BY service.description, currency
      ORDER BY total_cost DESC
    `

    // Query 2: Daily costs for the month (for projection)
    const dailyCostQuery = `
      SELECT
        DATE(usage_start_time) as usage_date,
        SUM(cost) as daily_cost
      FROM \`${process.env.GCP_BILLING_PROJECT_ID}.${datasetId}.${tableId}\`
      WHERE
        DATE(usage_start_time) >= '${startDate}'
        AND DATE(usage_start_time) <= '${endDate}'
      GROUP BY usage_date
      ORDER BY usage_date
    `

    // Execute queries in parallel
    const [serviceResults, dailyResults] = await Promise.all([
      bigquery.query({ query: serviceCostQuery }),
      bigquery.query({ query: dailyCostQuery }),
    ])

    const serviceRows = serviceResults[0] as any[]
    const dailyRows = dailyResults[0] as any[]

    // Calculate totals
    let totalCost = 0
    let currency = 'USD'
    const services: ServiceCost[] = []

    for (const row of serviceRows) {
      const cost = parseFloat(row.total_cost) || 0
      totalCost += cost
      currency = row.currency || 'USD'
      services.push({
        name: row.service_name || 'Unknown',
        cost,
        percentOfTotal: 0, // Calculate after we have total
      })
    }

    // Calculate percentages
    for (const service of services) {
      service.percentOfTotal = totalCost > 0 ? (service.cost / totalCost) * 100 : 0
    }

    // Calculate daily costs and projection
    const dailyCosts: { date: string; cost: number }[] = []
    let totalDailyCost = 0
    let daysWithData = 0

    for (const row of dailyRows) {
      const cost = parseFloat(row.daily_cost) || 0
      const dateStr = row.usage_date?.value || row.usage_date
      dailyCosts.push({
        date: dateStr,
        cost,
      })
      totalDailyCost += cost
      daysWithData++
    }

    // Project end-of-month cost based on average daily spend
    const daysInMonth = new Date(year, month, 0).getDate()
    const avgDailyCost = daysWithData > 0 ? totalDailyCost / daysWithData : 0
    const projectedMonthCost = avgDailyCost * daysInMonth

    // Budget limit - you can make this configurable
    const budgetLimit = 100 // Default $100, can be stored in env or database

    const response: BillingResponse = {
      currentMonthCost: totalCost,
      projectedMonthCost,
      budgetLimit,
      currency,
      lastUpdated: new Date().toISOString(),
      services: services.slice(0, 10), // Top 10 services
      dailyCosts,
    }

    return res.status(200).json(response)
  } catch (err) {
    console.error('[gcp/billing] Error:', err)

    // Provide more specific error messages
    if (err instanceof Error) {
      if (err.message.includes('Not found: Table')) {
        return res.status(404).json({
          error: 'Billing export table not found. Please verify BigQuery billing export is enabled and data has been exported (can take up to 24 hours).'
        })
      }
      if (err.message.includes('Access Denied') || err.message.includes('Permission')) {
        return res.status(403).json({
          error: 'Access denied to BigQuery. Please verify service account has BigQuery Data Viewer role.'
        })
      }
    }

    return res.status(500).json({ error: 'Failed to fetch billing data' })
  }
}
