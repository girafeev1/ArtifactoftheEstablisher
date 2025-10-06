import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'

import { addClientToDirectory, fetchClientsDirectory } from '../../../lib/clientDirectory'
import { getAuthOptions } from '../auth/[...nextauth]'

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      console.info('[api/client-directory] GET directory request received', {
        user: session.user.email ?? session.user.name ?? 'unknown',
      })
      const clients = await fetchClientsDirectory()
      const shaped = clients.map((client) => ({ id: client.companyName, ...client }))
      console.info('[api/client-directory] Responding to GET request', {
        user: session.user.email ?? session.user.name ?? 'unknown',
        count: shaped.length,
      })
      return res.status(200).json({ data: shaped, total: shaped.length })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load clients'
      console.error('[api/client-directory] Failed to respond to GET request', {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      })
      return res.status(500).json({ error: message })
    }
  }

  if (!isObject(req.body) || !isObject((req.body as any).client)) {
    return res.status(400).json({ error: 'Missing client payload' })
  }

  const createdBy =
    (session.user.email as string | undefined) ||
    (session.user.name as string | undefined) ||
    'unknown'

  try {
    const result = await addClientToDirectory({
      client: (req.body as any).client,
      createdBy,
    })
    return res.status(201).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create failed'
    return res.status(400).json({ error: message })
  }
}
