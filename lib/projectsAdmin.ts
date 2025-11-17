import { getAdminFirestore } from './firebaseAdmin'
import type { Firestore } from '@google-cloud/firestore'
import { recursiveDeleteDoc } from './adminRecursiveDelete'

const PROJECTS_ROOT = 'projects'
const PROJECTS_SUBCOLLECTION = 'projects'

async function resolveProjectDoc(fs: Firestore, year: string, projectId: string) {
  const nested = fs.doc(`${PROJECTS_ROOT}/${year}/${PROJECTS_SUBCOLLECTION}/${projectId}`)
  const nestedSnap = await nested.get()
  if (nestedSnap.exists) return nested
  const legacy = fs.doc(`${year}/${projectId}`)
  const legacySnap = await legacy.get()
  if (legacySnap.exists) return legacy
  return null
}

export async function deleteProjectRecursively(year: string, projectId: string): Promise<{ deleted: boolean }> {
  const fs = getAdminFirestore(process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID)
  const ref = await resolveProjectDoc(fs as any, year, projectId)
  if (!ref) return { deleted: false }
  await recursiveDeleteDoc(fs as any, ref)
  return { deleted: true }
}

