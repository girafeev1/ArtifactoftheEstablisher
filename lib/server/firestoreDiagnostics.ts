// lib/server/firestoreDiagnostics.ts
import { adminDb } from './firebaseAdmin'

export async function logFirestoreDiagnostics() {
  try {
    const collections = await adminDb.listCollections();
    console.log('[firestoreDiagnostics] Available collections:', collections.map(c => c.id));
  } catch (err) {
    console.error('[firestoreDiagnostics] Error listing collections', err);
  }
}
