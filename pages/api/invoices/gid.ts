// pages/api/invoices/gid.ts
// @ts-nocheck

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '../auth/[...nextauth]';
import { initializeApis } from '../../../lib/googleApi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authOptions = await getAuthOptions();
    const session = await getServerSession(req, res, authOptions);
    if (!session?.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.query.fileId as string;
    const title = req.query.title as string;
    if (!fileId || !title) {
      return res.status(400).json({ error: 'Missing fileId or title' });
    }

    const { sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: fileId,
      includeGridData: false,
    });

    const found = meta.data.sheets?.find(
      (s) => s.properties?.title === title
    );

    if (!found) {
      return res.status(404).json({ error: `No tab named "${title}" found` });
    }

    const sheetId = found.properties?.sheetId;
    return res.status(200).json({ sheetId });
  } catch (err: any) {
    console.error('[GET /api/invoices/gid] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
