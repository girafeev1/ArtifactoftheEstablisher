// lib/firestoreSubsidiaries.ts
import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import type { Firestore } from 'firebase-admin/firestore'

let adminDb: Firestore | null = null
if (typeof window === 'undefined') {
  try {
    const admin = require('./server/firebaseAdmin') as typeof import('./server/firebaseAdmin')
    adminDb = admin.adminDb
    console.log('[firestoreSubsidiaries] Loaded adminDb')
  } catch (err) {
    console.warn('[firestoreSubsidiaries] Failed to load firebase-admin', err)
  }
}

export interface SubsidiaryData {
  identifier: string
  englishName: string
  chineseName: string
  email: string
  phone: string
  room: string
  building: string
  street: string
  district: string
  region: string
}

export async function fetchSubsidiaries(): Promise<SubsidiaryData[]> {
  console.log('[fetchSubsidiaries] Fetching subsidiaries from Firestore', {
    projectId: db.app.options.projectId,
    database: 'aote-ref',
    collection: 'Subsidiaries',
  })
  try {
    let snap: any
    if (adminDb) {
      console.log('[fetchSubsidiaries] Using adminDb for query')
      snap = await adminDb.collection('Subsidiaries').get()
    } else {
      console.log('[fetchSubsidiaries] Using client Firestore for query')
      snap = await getDocs(collection(db, 'Subsidiaries'))
    }
    console.log('[fetchSubsidiaries] Retrieved', snap.size, 'documents')
    return snap.docs.map(d => {
      const data = d.data() as any
      return {
        identifier: d.id,
        englishName: data.englishName || '',
        chineseName: data.chineseName || '',
        email: data.email || '',
        phone: data.phone || '',
        room: data.addressLine1 || '',
        building: data.addressLine2 || '',
        street: data.addressLine3 || '',
        district: data.addressLine4 || '',
        region: data.region || '',
      }
    })
  } catch (err) {
    console.error('[fetchSubsidiaries] Error fetching documents', err)
    if ((err as any)?.code === 'permission-denied') {
      console.error('[fetchSubsidiaries] Permission denied when accessing Firestore')
    }
    throw err
  }
}

export function normalizeIdentifier(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function mapSubsidiaryNames(subsidiaries: SubsidiaryData[]): Record<string, string> {
  const map: Record<string, string> = {};
  subsidiaries.forEach(s => {
    map[s.identifier] = s.englishName;
  });
  return map;
}

export function resolveSubsidiaryName(code: string, mapping: Record<string, string>): string {
  if (mapping[code]) return mapping[code];
  const norm = normalizeIdentifier(code);
  for (const key of Object.keys(mapping)) {
    if (normalizeIdentifier(key) === norm) {
      return mapping[key];
    }
  }
  return code;
}
