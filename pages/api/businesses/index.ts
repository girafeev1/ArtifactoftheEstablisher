// pages/api/businesses/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '../auth/[...nextauth]';
import { initializeApis } from '../../../lib/googleApi';
import { listProjectOverviewFiles } from '../../../lib/projectOverview';
import { findPMSReferenceLogFile, fetchReferenceNames } from '../../../lib/pmsReference';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authOptions = await getAuthOptions();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { drive, sheets } = initializeApis('user', { accessToken: session.accessToken as string });
    const projectsByCategory = await listProjectOverviewFiles(drive);
    const refLogId = await findPMSReferenceLogFile(drive);
    const referenceMapping = await fetchReferenceNames(sheets, refLogId);
    return res.status(200).json({ projectsByCategory, referenceMapping });
  } catch (err: any) {
    console.error('[GET /api/businesses] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
