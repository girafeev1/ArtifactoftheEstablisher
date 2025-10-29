import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'

import { updateClientInDirectoryAdmin } from '../../../lib/clientDirectoryAdmin'
import { getAuthOptions } from '../auth/[...nextauth]'

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { clientId } = req.query
  if (typeof clientId !== 'string') {
    return res.status(400).json({ error: 'Invalid client identifier' })
  }

  if (!isObject(req.body) || !isObject((req.body as any).updates)) {
    return res.status(400).json({ error: 'Missing updates payload' })
  }

  const editedBy =
    (session.user.email as string | undefined) ||
    (session.user.name as string | undefined) ||
    'unknown'

  try {
    const result = await updateClientInDirectoryAdmin({
      id: clientId,
      updates: (req.body as any).updates,
      editedBy,
    })

    return res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return res.status(400).json({ error: message })
  }
}
