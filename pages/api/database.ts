// pages/api/database.ts
// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from './auth/[...nextauth]';
import { initializeApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile, fetchAddressBook, fetchBankAccounts } from '../../lib/pmsReference';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { drive, sheets } = initializeApis('user', { accessToken: session.accessToken as string });
    const refLogId = await findPMSReferenceLogFile(drive);
    const clients = await fetchAddressBook(sheets, refLogId);
    const bankAccounts = await fetchBankAccounts(sheets, refLogId);
    return res.status(200).json({ clients, bankAccounts });
  } catch (err: any) {
    console.error('[GET /api/database] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
