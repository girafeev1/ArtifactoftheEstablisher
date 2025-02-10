// pages/api/projects/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '../auth/[...nextauth]';
import { initializeApis } from '../../../lib/googleApi';
import { addProjectRowBeforeTotal } from '../../../lib/projectOverview';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authOptions = await getAuthOptions();
    const session = await getServerSession(req, res, authOptions);
    if (!session?.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      fileId,
      projectNumber,
      projectDate,
      agent,
      invoiceCompany,
      projectTitle,
      projectNature,
      amount,
      paid,
      paidOnDate,
      bankAccountIdentifier,
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

    const paidVal = paid === true || paid === 'TRUE' || paid === '✔' ? 'TRUE' : 'FALSE';
    await addProjectRowBeforeTotal(sheets, fileId, {
      projectNumber,
      projectDate,
      agent: agent || '',
      invoiceCompany,
      projectTitle,
      projectNature: projectNature || '',
      amount: parseFloat(amount || 0),
      paid: paidVal,
      paidOnDate: paidOnDate || '',
      bankAccountIdentifier: bankAccountIdentifier || '',
      invoice: invoice || '',
    });

    return res.status(200).json({ message: 'Project created successfully' });
  } catch (err: any) {
    console.error('[POST /api/projects] Error adding project:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
