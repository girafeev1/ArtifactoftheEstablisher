import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'

import { updateProjectInDatabase } from '../../../../lib/projectsDatabase'
import { deleteProject } from '../../../../lib/projectsAdmin'
import { handleInvoiceDeleted } from '../../../../lib/accounting/invoiceHook'
import { getAuthOptions } from '../../auth/[...nextauth]'

type ErrorResponse = { error: string }

const disallowed = ['GET', 'POST', 'PUT']

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

  if (!['PATCH', 'DELETE'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'PATCH, DELETE')
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

  const editedBy =
    (session.user.email as string | undefined) ||
    (session.user.name as string | undefined) ||
    'unknown'

  try {
    if (req.method === 'DELETE') {
      // Delete project and all invoices
      // - Hard delete if no issued invoices (all drafts or no invoices)
      // - Soft delete if any invoice has been issued (maintains GL audit trail)
      const result = await deleteProject(year, projectId, editedBy)

      if (result.hardDeleted) {
        // Hard delete: project and all draft invoices permanently removed
        console.info('[api/projects] Hard deleted project (no issued invoices)', {
          projectPath: result.projectPath,
        })
      } else if (result.deleted && result.invoicePaths) {
        // Soft delete: void GL entries for all deleted invoices
        const voidResults: { path: string; voided: string[] }[] = []
        for (const invoicePath of result.invoicePaths) {
          // Extract invoice number from path (e.g., projects/2024/projects/123/invoice/2024-001)
          const invoiceNumber = invoicePath.split('/').pop()
          if (invoiceNumber) {
            try {
              const voidResult = await handleInvoiceDeleted({
                year,
                projectId,
                invoiceNumber,
                deletedBy: editedBy,
              })
              voidResults.push({ path: invoicePath, voided: voidResult.voidedEntries })
            } catch (voidError) {
              console.error(`[api/projects] Failed to void GL for ${invoicePath}:`, voidError)
            }
          }
        }
        console.info('[api/projects] Soft deleted project with GL voids', {
          projectPath: result.projectPath,
          invoiceCount: result.invoicePaths.length,
          voidResults,
        })
      }

      return res.status(200).json(result)
    }

    if (!isObject(req.body) || !isObject((req.body as any).updates)) {
      return res.status(400).json({ error: 'Missing updates payload' })
    }

    const updates = (req.body as any).updates
    try {
      const keys = Object.keys(updates || {})
      console.info('[api/projects/:year/:id] update payload keys', { year, projectId, keys, hasProjectDate: 'projectDate' in (updates || {}) })
    } catch {}
    const result = await updateProjectInDatabase({ year, projectId, updates, editedBy })
    return res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return res.status(400).json({ error: message } satisfies ErrorResponse)
  }
}
