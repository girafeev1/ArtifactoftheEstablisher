import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import {
  generateTrialBalance,
  generateProfitAndLoss,
  generateBalanceSheet,
  generateARAgingReport,
} from '../../../lib/accounting'
import type { AccountingBasis } from '../../../lib/accounting'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { report, startDate, endDate, asOf, basis } = req.query

    const reportBasis = (basis === 'cash' ? 'cash' : 'accrual') as AccountingBasis
    const asOfDate = asOf ? new Date(asOf as string) : new Date()

    switch (report) {
      case 'trial-balance': {
        const trialBalance = await generateTrialBalance({
          asOf: asOfDate,
          basis: reportBasis,
        })
        return res.status(200).json({ report: 'trial-balance', data: trialBalance })
      }

      case 'profit-and-loss':
      case 'pnl':
      case 'income-statement': {
        if (!startDate || !endDate) {
          return res.status(400).json({
            error: 'startDate and endDate are required for P&L report',
          })
        }
        const pnl = await generateProfitAndLoss({
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string),
          basis: reportBasis,
        })
        return res.status(200).json({ report: 'profit-and-loss', data: pnl })
      }

      case 'balance-sheet': {
        const balanceSheet = await generateBalanceSheet({
          asOf: asOfDate,
          basis: reportBasis,
        })
        return res.status(200).json({ report: 'balance-sheet', data: balanceSheet })
      }

      case 'ar-aging': {
        const arAging = await generateARAgingReport(asOfDate)
        return res.status(200).json({ report: 'ar-aging', data: arAging })
      }

      default:
        return res.status(400).json({
          error: 'Invalid report type. Valid options: trial-balance, profit-and-loss, balance-sheet, ar-aging',
        })
    }
  } catch (error) {
    console.error('[api/accounting/reports] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
