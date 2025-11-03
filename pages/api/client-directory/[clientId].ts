import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'

import { updateClientInDirectory } from '../../../lib/clientDirectory'
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
    console.info('[api/client-directory:id] PATCH begin', { clientId, keys: Object.keys((req.body as any).updates || {}) })
    const result = await updateClientInDirectory({
      id: clientId,
      updates: (req.body as any).updates,
      editedBy,
    })
    console.info('[api/client-directory:id] PATCH ok', { clientId, updated: result.updatedFields?.length ?? 0 })
    return res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    console.error('[api/client-directory:id] PATCH failed', { clientId, error: message })
    return res.status(400).json({ error: message })
  }
}
