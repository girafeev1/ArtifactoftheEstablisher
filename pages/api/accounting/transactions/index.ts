import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../../auth/[...nextauth]'
import {
  listTransactions,
  createTransaction,
  getTransactionStats,
  getPayerNames,
} from '../../../../lib/accounting'
import type { BankTransactionInput, TransactionStatus, TransactionSource } from '../../../../lib/accounting'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      const {
        startDate,
        endDate,
        status,
        bankAccountId,
        subsidiaryId,
        source,
        limit,
        stats,
        payers,
      } = req.query

      // Get stats summary
      if (stats === 'true') {
        const transactionStats = await getTransactionStats({
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          subsidiaryId: subsidiaryId as string | undefined,
        })
        return res.status(200).json({ stats: transactionStats })
      }

      // Get payer names for autocomplete
      if (payers === 'true') {
        const payerNames = await getPayerNames(subsidiaryId as string | undefined)
        return res.status(200).json({ payers: payerNames })
      }

      // List transactions
      const transactions = await listTransactions({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        status: status as TransactionStatus | undefined,
        bankAccountId: bankAccountId as string | undefined,
        subsidiaryId: subsidiaryId as string | undefined,
        source: source as TransactionSource | undefined,
        limitCount: limit ? parseInt(limit as string) : 100,
      })

      return res.status(200).json({ transactions })
    }

    if (req.method === 'POST') {
      const body = req.body as BankTransactionInput

      // Validate required fields
      if (!body.transactionDate || !body.amount || !body.bankAccountId || !body.payerName || !body.subsidiaryId) {
        return res.status(400).json({
          error: 'transactionDate, amount, bankAccountId, payerName, and subsidiaryId are required',
        })
      }

      // Parse date if it's a string
      const input: BankTransactionInput = {
        ...body,
        transactionDate: new Date(body.transactionDate),
        source: body.source || 'manual',
      }

      const transaction = await createTransaction(input, session.user.email || 'unknown')
      return res.status(201).json({ transaction })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    console.error('[api/accounting/transactions] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
