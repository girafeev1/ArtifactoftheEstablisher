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

interface SoftDeleteResult {
  deleted: boolean
  projectPath?: string
  invoicePaths?: string[]
}

/**
 * Soft delete a project and all its invoices.
 * Marks records as deleted instead of permanent erasure.
 */
export async function softDeleteProject(
  year: string,
  projectId: string,
  deletedBy: string
): Promise<SoftDeleteResult> {
  const fs = getAdminFirestore(process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID)
  const ref = await resolveProjectDoc(fs as any, year, projectId)
  if (!ref) return { deleted: false }

  const now = new Date().toISOString()
  const invoicePaths: string[] = []

  // Soft delete all invoices in the project
  const collections = await ref.listCollections()
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
  }
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

