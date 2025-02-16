// pages/api/clients.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from './auth/[...nextauth]';
import { initializeApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile } from '../../lib/pmsReference';

/**
 * Helper to find row index (1-based) for a company name in the Address Book
 */
async function findRowIndexForCompany(
  sheets: any,
  spreadsheetId: string,
  range: string,
  companyName: string
): Promise<number | null> {
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  // We assume the first column is companyName => row[0]
  const rowIndex = rows.findIndex((row: any) => row[0] === companyName);
  return rowIndex === -1 ? null : rowIndex + 1; // 1-based
}

/**
 * Helper to find sheetId for a given sheet title
 */
async function getSheetIdByTitle(sheets: any, spreadsheetId: string, sheetTitle: string): Promise<number> {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });
  const sheet = metadata.data.sheets?.find((s: any) => s.properties?.title === sheetTitle);
  if (!sheet) {
    throw new Error(Sheet "${sheetTitle}" not found in spreadsheet.);
  }
  return sheet.properties.sheetId;
}

/**
 * Helper to sort the entire address book range by the first column
 */
async function sortAddressBook(sheets: any, spreadsheetId: string, sheetId: number) {
  // The first 2 rows are headers, so maybe the actual data starts at row 4.
  // But from your code, you skip the first 3 rows with data?
  // Adjust as needed. For example, if real data starts at row 4 => startRowIndex=3
  // We'll guess the last row as something large or dynamically found. For simplicity, let's do a big guess.
  // Or we can do an approach to find the last row. For brevity, let's do row 1000 as an upper bound.
  const requests = [
    {
      sortRange: {
        range: {
          sheetId,
          startRowIndex: 3, // skipping header rows (rows 0..2)
          endRowIndex: 1000, // arbitrary
          startColumnIndex: 0,
          endColumnIndex: 9, // A..I
        },
        sortSpecs: [
          {
            dimensionIndex: 0, // sort by column 0
            sortOrder: 'ASCENDING',
          },
        ],
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
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

    // The "Address Book of Accounts" sheet
    const sheetTitle = 'Address Book of Accounts';
    const sheetRange = ${sheetTitle}!A:I; // columns A..I
    const sheetId = await getSheetIdByTitle(sheets, referenceLogId, sheetTitle);

    if (req.method === 'POST') {
      // Add new client
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

      // Now sort
      await sortAddressBook(sheets, referenceLogId, sheetId);

      return res.status(200).json({ message: 'Client added successfully' });
    } else if (req.method === 'PUT') {
      // Update existing client
      const { data } = req.body;
      if (!data || !data.originalIdentifier) {
        return res.status(400).json({ error: 'Missing originalIdentifier or data' });
      }
      const rowIndex = await findRowIndexForCompany(sheets, referenceLogId, sheetRange, data.originalIdentifier);
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

      // Update row
      await sheets.spreadsheets.values.update({
        spreadsheetId: referenceLogId,
        range: Address Book of Accounts!A${rowIndex}:I${rowIndex},
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      });

      // Sort again
      await sortAddressBook(sheets, referenceLogId, sheetId);

      return res.status(200).json({ message: 'Client updated successfully' });
    } else if (req.method === 'DELETE') {
      // DELETE => remove client row
      const { identifier } = req.query;
      if (!identifier || typeof identifier !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid identifier' });
      }
      const rowIndex = await findRowIndexForCompany(sheets, referenceLogId, sheetRange, identifier);
      if (!rowIndex) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // The dimension range is zero-based, so if rowIndex is 1-based, we do rowIndex-1
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

      // After deletion, also re-sort if needed (though the row is gone).
      // Possibly not necessary. But let's do it anyway:
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
