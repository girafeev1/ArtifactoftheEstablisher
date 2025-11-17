import { Firestore, DocumentReference } from '@google-cloud/firestore'

/**
 * Recursively delete a document and all of its nested subcollections.
 * Uses the Admin Firestore SDK which supports listing subcollections.
 */
export async function recursiveDeleteDoc(fs: Firestore, docRef: DocumentReference): Promise<void> {
  // Delete all subcollection docs first
  const subcollections = await docRef.listCollections()
  for (const coll of subcollections) {
    // List document references in this subcollection
    const docRefs = await coll.listDocuments()
    for (const subDocRef of docRefs) {
      await recursiveDeleteDoc(fs, subDocRef)
    }
  }
  // Then delete this document itself
  await docRef.delete().catch(() => { /* ignore individual failures to keep best-effort */ })
}

