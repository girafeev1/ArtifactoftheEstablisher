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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.query.fileId as string;
    if (!fileId) {
      return res.status(400).json({ error: 'Missing fileId' });
    }

    const { sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });

    if (req.method === 'GET') {
      // Return project rows
      const data = await fetchProjectRows(sheets, fileId, 6);
      return res.status(200).json({ data });
    } else if (req.method === 'PUT') {
      // Update a project
      const { originalIdentifier, ...newData } = req.body;
      if (!originalIdentifier) {
        return res.status(400).json({ error: 'Missing originalIdentifier' });
      }
      await updateProjectRow(sheets, fileId, originalIdentifier, newData);
      return res.status(200).json({ message: 'Project updated successfully' });
    } else if (req.method === 'POST') {
      // Insert new project row (rarely used here if your global is /api/projects instead)
      const data = req.body;
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
      // e.g. /api/projects/[fileId]?identifier=projectNumber
      const identifier = req.query.identifier as string;
      if (!identifier) {
        return res.status(400).json({ error: 'Missing identifier' });
      }
      // remove the row
      await deleteProjectRow(sheets, fileId, identifier);
      return res.status(200).json({ message: 'Project deleted.' });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err: any) {
    console.error('[projects/[fileId]] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
