// pages/api/projects/[fileId].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '../auth/[...nextauth]';
import { initializeApis } from '../../../lib/googleApi';
import {
  fetchProjectRows,
  updateProjectRow,
  addProjectRowBeforeTotal,
  deleteProjectRow,
} from '../../../lib/projectOverview';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authOptions = await getAuthOptions();
    const session = await getServerSession(req, res, authOptions);
    if (!session?.accessToken) {
      console.log('[projects/[fileId].ts] No session.');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.query.fileId as string;
    if (!fileId) {
      console.log('[projects/[fileId].ts] Missing fileId.');
      return res.status(400).json({ error: 'Missing fileId' });
    }

    console.log(`[projects/[fileId].ts] ${req.method} request for fileId=${fileId}`);

    const { sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });

    if (req.method === 'GET') {
      const data = await fetchProjectRows(sheets, fileId, 6);
      console.log(`[projects/[fileId].ts] GET: found ${data.length} project rows`);
      return res.status(200).json({ data });
    } else if (req.method === 'PUT') {
      const { originalIdentifier, ...newData } = req.body;
      if (!originalIdentifier) {
        return res.status(400).json({ error: 'Missing originalIdentifier' });
      }
      console.log('[projects/[fileId].ts] PUT: updating project', originalIdentifier, newData);
      await updateProjectRow(sheets, fileId, originalIdentifier, newData);
      return res.status(200).json({ message: 'Project updated successfully' });
    } else if (req.method === 'POST') {
      const data = req.body;
      console.log('[projects/[fileId].ts] POST: creating project', data);
      await addProjectRowBeforeTotal(sheets, fileId, {
        projectNumber: data.projectNumber,
        projectDate: data.projectDate,
        agent: data.agent || '',
        invoiceCompany: data.invoiceCompany,
        projectTitle: data.projectTitle,
        projectNature: data.projectNature || '',
        amount: parseFloat(data.amount || 0),
        paid: data.paid === true || data.paid === 'TRUE' ? 'TRUE' : 'FALSE',
        paidOnDate: data.paidOnDate || '',
        bankAccountIdentifier: data.bankAccountIdentifier || '',
        invoice: data.invoice || '',
      });
      return res.status(200).json({ message: 'Project created successfully' });
    } else if (req.method === 'DELETE') {
      const identifier = req.query.identifier as string;
      if (!identifier) {
        return res.status(400).json({ error: 'Missing identifier' });
      }
      console.log('[projects/[fileId].ts] DELETE: removing project', identifier);
      await deleteProjectRow(sheets, fileId, identifier);
      return res.status(200).json({ message: 'Project deleted.' });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err: any) {
    console.error('[projects/[fileId].ts] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
