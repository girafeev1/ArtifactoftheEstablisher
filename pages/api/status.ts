// pages/api/status.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { firebaseReady, firebaseMissing } from '../../lib/firebase'

const serviceVars = ['GOOGLE_PROJECT_ID','GOOGLE_CLIENT_EMAIL','GOOGLE_PRIVATE_KEY']
const serviceAccountReady = serviceVars.every(v => !!process.env[v])
const serviceAccountMissing = serviceVars.filter(v => !process.env[v])

export default function handler(_req:NextApiRequest,res:NextApiResponse) {
  res.status(200).json({
    firebaseReady,
    firebaseMissing,
    serviceAccountReady,
    serviceAccountMissing,
  })
}
