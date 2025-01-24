// pages/api/projects.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { initializeApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile, appendProjectOverview } from '../../lib/pmsReference';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getSession({ req });
  if (!session?.accessToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const {
      projectNumber,
      projectDate,
      agent,
      invoiceCompany,
      presenter,
      projectTitle,
      projectDescription,
      projectNature,
      amount,
      paid,
      paidOnDate,
      invoice,
    } = req.body;

    if (!projectNumber || !projectDate || !invoiceCompany || !projectTitle) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const { drive, sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });

    const pmsRefLogFileId = await findPMSReferenceLogFile(drive);

    await appendProjectOverview(sheets, pmsRefLogFileId, {
      projectNumber,
      projectDate,
      agent: agent || '',
      invoiceCompany,
      presenter: presenter || '',
      projectTitle,
      projectDescription: projectDescription || '',
      projectNature: projectNature || '',
      amount: parseFloat(amount || 0),
      paid: !!paid,
      paidOnDate: paidOnDate || '',
      invoice: invoice || '',
    });

    return res.status(200).json({ message: 'Project added successfully' });
  } catch (err: any) {
    console.error('[POST /api/projects] Error adding project:', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
}
