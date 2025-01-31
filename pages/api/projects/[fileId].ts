// pages/api/projects/[fileId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '../auth/[...nextauth]';
import { initializeApis } from '../../../lib/googleApi';

// We'll do a helper to find a row
import { sheets_v4 } from 'googleapis';

/**
 * Example column mapping in Project Overview!A5:J
 * 0: projectNumber
 * 1: projectDate
 * 2: agent
 * 3: invoiceCompany
 * 4: projectTitle
 * 5: projectNature
 * 6: amount
 * 7: paid (✔ or ✖)
 * 8: paidOnDate
 * 9: invoice
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
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
    const {
      originalProjectNumber,
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

    if (!originalProjectNumber) {
      return res.status(400).json({ error: 'Missing originalProjectNumber' });
    }

    // Initialize user-based Google APIs
    const { sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });

    // 1) Find row number where col 0 = originalProjectNumber
    const range = 'Project Overview!A5:J'; // start from row 5
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range,
    });
    const rows = resp.data.values || [];

    const rowIndex = rows.findIndex((r) => r[0] === originalProjectNumber);
    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // rowIndex is relative to A5, so actual sheet row is rowIndex + 5
    // Because if rowIndex=0 => that's row #5 in the sheet
    const actualRow = rowIndex + 5;

    // 2) Build the updated row, columns 0..9
    const paidSymbol = paid ? '✔' : '✖';
    const sanitizedAmt = typeof amount === 'string' ? amount.replace(/[^\d.]/g, '') : amount;
    const updatedRow = [
      projectNumber || '',
      projectDate || '',
      agent || '',
      invoiceCompany || '',
      projectTitle || '',
      projectNature || '',
      `$ ${parseFloat(sanitizedAmt || '0').toFixed(2)}`,
      paidSymbol,
      paidOnDate || '',
      invoice || '',
    ];

    // 3) Update the row in the sheet
    const updateRange = `Project Overview!A${actualRow}:J${actualRow}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: updateRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [updatedRow],
      },
    });

    return res.status(200).json({ message: 'Project updated successfully' });
  } catch (err: any) {
    console.error('[PUT /api/projects/[fileId]] error:', err);
    return res
      .status(500)
      .json({ error: err.message || 'Internal server error' });
  }
}
