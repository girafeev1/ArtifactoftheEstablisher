// pages/api/projectData.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from './auth/[...nextauth]';
import { initializeApis } from '../../lib/googleApi';

/**
 * Now only 10 columns in "Project Overview!A:J":
 * 0: projectNumber
 * 1: projectDate
 * 2: agent
 * 3: invoiceCompany
 * 4: projectTitle
 * 5: projectNature
 * 6: amount (like '$ 120.00')
 * 7: paid (✔ or ✖)
 * 8: paidOnDate
 * 9: invoice
 */
interface SheetRow {
  projectNumber: string;
  projectTitle: string;
  amount: string;
  paid: boolean;
  paidOnDate?: string;
  agent?: string;
  invoiceCompany?: string;
  projectNature?: string;
  invoice?: string;
  projectDate?: string; // if you want to keep it
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authOptions = await getAuthOptions();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const fileId = req.query.fileId as string;
  if (!fileId) {
    return res.status(400).json({ error: 'Missing fileId' });
  }

  try {
    const { sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });

    // Now the sheet range is A:J
    const range = 'Project Overview!A5:J';
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range,
    });

    const rows = resp.data.values || [];
    // row 0 might be header
    const data: SheetRow[] = [];

    // parse from row 1 down
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue; // skip if no projectNumber

      const amountRaw = (r[6] || '').toString().replace(/[^0-9.]/g, '');
      const paidSymbol = r[7] || '✖';

      data.push({
        projectNumber: r[0] || '',
        projectDate: r[1] || '',
        agent: r[2] || '',
        invoiceCompany: r[3] || '',
        projectTitle: r[4] || '',
        projectNature: r[5] || '',
        amount: amountRaw || '0',
        paid: paidSymbol === '✔',
        paidOnDate: r[8] || '',
        invoice: r[9] || '',
      });
    }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Error reading project data:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
