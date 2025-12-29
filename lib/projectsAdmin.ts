import { getAdminFirestore } from './firebaseAdmin'
import type { Firestore, DocumentReference } from '@google-cloud/firestore'
import { FieldValue } from '@google-cloud/firestore'
import { recursiveDeleteDoc } from './adminRecursiveDelete'

const PROJECTS_ROOT = 'projects'
const PROJECTS_SUBCOLLECTION = 'projects'
const UPDATE_LOG_COLLECTION = 'updateLogs'

async function resolveProjectDoc(fs: Firestore, year: string, projectId: string) {
  const nested = fs.doc(`${PROJECTS_ROOT}/${year}/${PROJECTS_SUBCOLLECTION}/${projectId}`)
  const nestedSnap = await nested.get()
  if (nestedSnap.exists) return nested
  const legacy = fs.doc(`${year}/${projectId}`)
  const legacySnap = await legacy.get()
  if (legacySnap.exists) return legacy
  return null
}

interface DeleteProjectResult {
  deleted: boolean
  projectPath?: string
  invoicePaths?: string[]
  hardDeleted: boolean
}

/**
 * Delete a project and all its invoices.
 * - If no invoices are issued (all are drafts or no invoices), hard delete the entire project.
 * - If any invoice has been issued, soft delete everything (marks as deleted instead of permanent erasure).
 */
export async function deleteProject(
  year: string,
  projectId: string,
  deletedBy: string
): Promise<DeleteProjectResult> {
  const fs = getAdminFirestore(process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID)
  const ref = await resolveProjectDoc(fs as any, year, projectId)
  if (!ref) return { deleted: false, hardDeleted: false }

  const now = new Date().toISOString()
  const invoicePaths: string[] = []

  // First pass: check if any invoice is issued (not draft)
  let hasIssuedInvoice = false
  const collections = await ref.listCollections()

  for (const coll of collections) {
    // Skip updateLogs collection
    if (coll.id === UPDATE_LOG_COLLECTION) continue

    const invoiceDocs = await coll.listDocuments()
    for (const invoiceDoc of invoiceDocs) {
      const invoiceSnap = await invoiceDoc.get()
      if (invoiceSnap.exists) {
        const data = invoiceSnap.data() || {}
        // Skip already-deleted invoices when checking for issued status
        if (data.recordStatus === 'deleted') continue

        const paymentStatus = (data.paymentStatus || '').toLowerCase()
        // Invoice is considered issued if it has a paymentStatus other than 'draft' or empty
        if (paymentStatus && paymentStatus !== 'draft') {
          hasIssuedInvoice = true
          break
        }
      }
    }
    if (hasIssuedInvoice) break
  }

  if (!hasIssuedInvoice) {
    // Hard delete: no issued invoices, permanently remove everything
    await recursiveDeleteDoc(fs as any, ref)
    return {
      deleted: true,
      projectPath: ref.path,
      invoicePaths: [],
      hardDeleted: true,
    }
  }

  // Soft delete: at least one issued invoice exists
  for (const coll of collections) {
    // Skip updateLogs collection
    if (coll.id === UPDATE_LOG_COLLECTION) continue

    const invoiceDocs = await coll.listDocuments()
    for (const invoiceDoc of invoiceDocs) {
      const invoiceSnap = await invoiceDoc.get()
      if (invoiceSnap.exists) {
        const data = invoiceSnap.data() || {}
        const previousStatus = data.recordStatus || 'active'

        // Soft delete the invoice
        await invoiceDoc.update({
          recordStatus: 'deleted',
          deletedAt: now,
          deletedBy,
          updatedAt: now,
        })

        // Log the deletion
        const logRef = invoiceDoc.collection(UPDATE_LOG_COLLECTION).doc()
        await logRef.set({
          field: 'recordStatus',
          previousValue: previousStatus,
          newValue: 'deleted',
          editedBy: deletedBy,
          timestamp: FieldValue.serverTimestamp(),
        })

        invoicePaths.push(invoiceDoc.path)
      }
    }
  }

  // Get project's previous status
  const projectSnap = await ref.get()
  const projectData = projectSnap.data() || {}
  const previousStatus = projectData.recordStatus || 'active'

  // Soft delete the project itself
  await ref.update({
    recordStatus: 'deleted',
    deletedAt: now,
    deletedBy,
  })

  // Log project deletion
  const projectLogRef = ref.collection(UPDATE_LOG_COLLECTION).doc()
  await projectLogRef.set({
    field: 'recordStatus',
    previousValue: previousStatus,
    newValue: 'deleted',
    editedBy: deletedBy,
    timestamp: FieldValue.serverTimestamp(),
  })

  return {
    deleted: true,
    projectPath: ref.path,
    invoicePaths,
    hardDeleted: false,
  }
}

/**
 * @deprecated Use deleteProject instead.
 * Soft delete a project and all its invoices.
 */
export async function softDeleteProject(
  year: string,
  projectId: string,
  deletedBy: string
): Promise<DeleteProjectResult> {
  return deleteProject(year, projectId, deletedBy)
}

/**
 * @deprecated Use softDeleteProject instead for audit trail compliance.
 * Permanently deletes a project and all subcollections.
 */
export async function deleteProjectRecursively(year: string, projectId: string): Promise<{ deleted: boolean }> {
  const fs = getAdminFirestore(process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID)
  const ref = await resolveProjectDoc(fs as any, year, projectId)
  if (!ref) return { deleted: false }
  await recursiveDeleteDoc(fs as any, ref)
  return { deleted: true }
}

