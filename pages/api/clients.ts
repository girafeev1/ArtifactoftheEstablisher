// pages/api/clients.ts
// @ts-nocheck

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from './auth/[...nextauth]';
import { initializeApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile, fetchAddressBook } from '../../lib/pmsReference';

async function sortAddressBook(sheets: any, spreadsheetId: string, sheetId: number): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          sortRange: {
            range: {
              sheetId,
              startRowIndex: 3, // Start at row 4 (0-based index 3, skipping headers)
              endRowIndex: undefined, // Sort to the end
              startColumnIndex: 0, // Column A (Company Name)
              endColumnIndex: 9, // Column I
            },
            sortSpecs: [
              {
                dimensionIndex: 0, // Sort by Column A
                sortOrder: 'ASCENDING',
              },
            ],
          },
        },
      ],
    },
  });
}

async function findRowIndexForCompany(
  sheets: any,
  spreadsheetId: string,
  range: string,
  companyName: string
): Promise<number | null> {
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  const rowIndex = rows.findIndex((row: any) => row[0] === companyName);
  return rowIndex === -1 ? null : rowIndex + 1;
}

async function getSheetIdByTitle(sheets: any, spreadsheetId: string, sheetTitle: string): Promise<number> {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });
  const sheet = metadata.data.sheets?.find((s: any) => s.properties?.title === sheetTitle);
  if (!sheet) {
    throw new Error(`Sheet "${sheetTitle}" not found in spreadsheet.`);
  }
  return sheet.properties.sheetId;
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

    const sheetTitle = 'Address Book of Accounts';
    const sheetRange = `${sheetTitle}!A:I`;
    const sheetId = await getSheetIdByTitle(sheets, referenceLogId, sheetTitle);

    if (req.method === 'GET') {
      const clientsData = await fetchAddressBook(sheets, referenceLogId);
      return res.status(200).json(clientsData);
    } else if (req.method === 'POST') {
      const { data } = req.body;
      if (!data) return res.status(400).json({ error: 'Missing client data' });
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

      await sortAddressBook(sheets, referenceLogId, sheetId);
      return res.status(200).json({ message: 'Client added successfully' });
    } else if (req.method === 'PUT') {
      const { data } = req.body;
      if (!data || !data.companyName) {
        return res.status(400).json({ error: 'Missing companyName in data' });
      }
      const rowIndex = await findRowIndexForCompany(sheets, referenceLogId, sheetRange, data.companyName);
      if (!rowIndex) {
        return res.status(404).json({ error: 'Client not found' });
      }
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
        range: `Address Book of Accounts!A${rowIndex}:I${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      });

      await sortAddressBook(sheets, referenceLogId, sheetId);
      return res.status(200).json({ message: 'Client updated successfully' });
    } else if (req.method === 'DELETE') {
      const { identifier } = req.query;
      if (!identifier || typeof identifier !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid identifier' });
      }
      const rowIndex = await findRowIndexForCompany(sheets, referenceLogId, sheetRange, identifier);
      if (!rowIndex) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const requests = [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ];
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: referenceLogId,
        requestBody: { requests },
      });

      await sortAddressBook(sheets, referenceLogId, sheetId);
      return res.status(200).json({ message: 'Client deleted successfully' });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('[api/clients] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
