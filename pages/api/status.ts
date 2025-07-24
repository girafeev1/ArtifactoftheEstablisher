// pages/api/status.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { firebaseReady, firebaseMissing, firebaseVars } from '../../lib/firebase'

const serviceVars = ['GOOGLE_PROJECT_ID','GOOGLE_CLIENT_EMAIL','GOOGLE_PRIVATE_KEY']
const serviceAccountReady = serviceVars.every(v => !!process.env[v])
const serviceAccountMissing = serviceVars.filter(v => !process.env[v])
const firebaseEnv = firebaseVars.map(v => ({ name:v, present: !!process.env[v] }))
const serviceEnv = serviceVars.map(v => ({ name:v, present: !!process.env[v] }))

export default function handler(_req:NextApiRequest,res:NextApiResponse) {
  console.log('[status] firebaseEnv', firebaseEnv, 'serviceEnv', serviceEnv)
  res.status(200).json({
    firebaseReady,
    firebaseMissing,
    serviceAccountReady,
    serviceAccountMissing,
    firebaseEnv,
    serviceEnv,
  })
}
