import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'

import { createProjectInDatabase } from '../../../../lib/projectsDatabase'
import { getAuthOptions } from '../../auth/[...nextauth]'

const disallowed = ['GET', 'PUT', 'DELETE', 'PATCH']

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (disallowed.includes(req.method ?? '')) {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { year } = req.query

  if (typeof year !== 'string') {
    return res.status(400).json({ error: 'Invalid year identifier' })
  }

  if (!isObject(req.body) || !isObject((req.body as any).project)) {
    return res.status(400).json({ error: 'Missing project payload' })
  }

  const createdBy =
    (session.user.email as string | undefined) ||
    (session.user.name as string | undefined) ||
    'unknown'

  try {
    const result = await createProjectInDatabase({
      year,
      data: (req.body as any).project,
      createdBy,
    })

    return res.status(201).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create failed'
    return res.status(400).json({ error: message })
  }
}
