import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { listAccounts, getAccount, createAccount, updateAccount } from '../../../lib/accounting'
import type { AccountInput } from '../../../lib/accounting'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      const { code, type, activeOnly } = req.query

      if (code && typeof code === 'string') {
        const account = await getAccount(code)
        if (!account) {
          return res.status(404).json({ error: 'Account not found' })
        }
        return res.status(200).json({ account })
      }

      const accounts = await listAccounts({
        type: typeof type === 'string' ? type as any : undefined,
        activeOnly: activeOnly === 'true',
      })

      return res.status(200).json({ accounts })
    }

    if (req.method === 'POST') {
      const body = req.body as AccountInput

      if (!body.code || !body.name || !body.type) {
        return res.status(400).json({ error: 'code, name, and type are required' })
      }

      const account = await createAccount(body)
      return res.status(201).json({ account })
    }

    if (req.method === 'PATCH') {
      const { code } = req.query
      const updates = req.body

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Account code is required' })
      }

      const account = await updateAccount(code, updates)
      return res.status(200).json({ account })
    }

    res.setHeader('Allow', 'GET, POST, PATCH')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    console.error('[api/accounting/accounts] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
