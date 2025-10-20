import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'

import { updateProjectInDatabase } from '../../../../lib/projectsDatabase'
import { getAuthOptions } from '../../auth/[...nextauth]'

type ErrorResponse = { error: string }

const disallowed = ['GET', 'POST', 'PUT', 'DELETE']

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (disallowed.includes(req.method ?? '')) {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { year, projectId } = req.query

  if (typeof year !== 'string' || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project identifier' })
  }

  if (!isObject(req.body) || !isObject((req.body as any).updates)) {
    return res.status(400).json({ error: 'Missing updates payload' })
  }

  const editedBy =
    (session.user.email as string | undefined) ||
    (session.user.name as string | undefined) ||
    'unknown'

  try {
    const updates = (req.body as any).updates
    try {
      const keys = Object.keys(updates || {})
      console.info('[api/projects/:year/:id] update payload keys', { year, projectId, keys, hasProjectDate: 'projectDate' in (updates || {}) })
    } catch {}
    const result = await updateProjectInDatabase({
      year,
      projectId,
      updates,
      editedBy,
    })

    return res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return res.status(400).json({ error: message } satisfies ErrorResponse)
  }
}
