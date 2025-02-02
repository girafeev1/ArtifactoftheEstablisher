// pages/api/clients.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from './auth/[...nextauth]';
import { initializeApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile } from '../../lib/pmsReference';

async function findRowToUpdate(
  sheets: any,
  spreadsheetId: string,
  range: string,
  identifier: string
): Promise<number | null> {
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  // we assume the first column is companyName => row[0]
  const rowIndex = rows.findIndex((row: any) => row[0] === identifier);
  return rowIndex === -1 ? null : rowIndex + 1; // 1-based index
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authOptions = await getAuthOptions();
    const session = await getServerSession(req, res, authOptions);
    if (!session?.accessToken) {
      console.log('[api/clients] No session');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { drive, sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });
    const referenceLogId = await findPMSReferenceLogFile(drive);
    const sheetRange = 'Address Book of Accounts!A:I'; // 9 columns: (0..8)

    // POST => add new client
    if (req.method === 'POST') {
      const { data } = req.body;
      if (!data) return res.status(400).json({ error: 'Missing client data' });
      console.log('[api/clients] Adding client:', data);
      const rowValues = [
        data.companyName || '',
        data.title || '',
        data.nameAddressed || '',
        data.emailAddress || '',
        data.addressLine1 || '',
        data.addressLine2 || '',
        data.addressLine3 || '',
        data.addressLine4 || '',
        data.addressLine5 || '',
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId: referenceLogId,
        range: sheetRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      });
      return res.status(200).json({ message: 'Client added successfully' });

    // PUT => update existing client
    } else if (req.method === 'PUT') {
      const { data } = req.body;
      if (!data || !data.originalIdentifier) {
        return res.status(400).json({ error: 'Missing originalIdentifier or data' });
      }
      const rowToUpdate = await findRowToUpdate(sheets, referenceLogId, sheetRange, data.originalIdentifier);
      if (!rowToUpdate) {
        return res.status(404).json({ error: 'Client not found' });
      }
      console.log(`[api/clients] Updating client at row ${rowToUpdate}:`, data);
      const rowValues = [
        data.companyName || '',
        data.title || '',
        data.nameAddressed || '',
        data.emailAddress || '',
        data.addressLine1 || '',
        data.addressLine2 || '',
        data.addressLine3 || '',
        data.addressLine4 || '',
        data.addressLine5 || '',
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId: referenceLogId,
        range: `Address Book of Accounts!A${rowToUpdate}:I${rowToUpdate}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      });
      return res.status(200).json({ message: 'Client updated successfully' });

    // DELETE => remove client
    } else if (req.method === 'DELETE') {
      // For example, you might pass ?identifier=someCompany in the query,
      // then find that row and clear it or remove it.
      return res.status(405).json({ error: 'DELETE not implemented in this sample' });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('[api/clients] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
