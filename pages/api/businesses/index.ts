// pages/api/businesses/index.ts
// @ts-nocheck
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '../auth/[...nextauth]';
import { initializeApis } from '../../../lib/googleApi';
import { listProjectOverviewFiles } from '../../../lib/projectOverview';

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
    const { drive } = initializeApis('user', { accessToken: session.accessToken as string });
    const projectsByCategory = await listProjectOverviewFiles(drive);
    return res.status(200).json({ projectsByCategory });
  } catch (err: any) {
    console.error('[GET /api/businesses] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
