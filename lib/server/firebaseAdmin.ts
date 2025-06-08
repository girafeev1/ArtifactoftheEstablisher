import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { serviceAccountCredentials } from '../config'

export function getAdminApp() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: serviceAccountCredentials.project_id,
        clientEmail: serviceAccountCredentials.client_email,
        privateKey: serviceAccountCredentials.private_key,
      }),
    })
  }
  return getApp()
}

export const adminAuth = getAuth(getAdminApp())
