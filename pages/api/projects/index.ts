// pages/api/projects/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { initializeApis } from '../../../lib/googleApi';
import { appendProjectRow } from '../../../lib/projectOverview';

/**
 * POST => create new project row in a "Project Overview" file
 * (the user can pass the `fileId` or you can default to some file ID)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getSession({ req });
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      fileId, // pass from front-end if you want
      projectNumber,
      projectDate,
      agent,
      invoiceCompany,
      projectTitle,
      projectNature,
      amount,
      paid,
      paidOnDate,
      invoice,
    } = req.body;
    if (!fileId) {
      return res.status(400).json({ error: 'Missing fileId' });
    }
    if (!projectNumber || !projectDate || !invoiceCompany || !projectTitle) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });

    // Convert `paid` to boolean or string
    const paidVal = paid === true || paid === 'TRUE' || paid === '✔';

    await appendProjectRow(sheets, fileId, {
      projectNumber,
      projectDate,
      agent: agent || '',
      invoiceCompany,
      projectTitle,
      projectNature: projectNature || '',
      amount: parseFloat(amount || 0),
      paid: paidVal,
      paidOnDate: paidOnDate || '',
      invoice: invoice || '',
    });

    return res.status(200).json({ message: 'Project created successfully' });
  } catch (err: any) {
    console.error('[POST /api/projects] Error adding project:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
