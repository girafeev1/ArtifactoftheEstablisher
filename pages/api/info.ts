// pages/api/info.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth].ts'; // Adjust path as needed
import { initializeUserApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile } from '../../lib/pmsReference';
import { sheets_v4 } from 'googleapis';

const SHEET_NAME = 'Address Book of Accounts';
const LAST_COLUMN = 'I'; // Changed to 'I' to match your sheet structure

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type, data } = req.body;
    if (type !== 'client') {
      return res.status(400).json({ error: 'Invalid type' });
    }

    console.log(`API Request: ${req.method} ${req.url}`);
    console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const { originalIdentifier, ...dataToWrite } = data;
    console.log('Data values to write:', Object.values(dataToWrite)); // Log the data values for debugging

    console.log('Server Session:', session ? JSON.stringify(session, null, 2) : 'null');
    console.log('Session Keys:', session ? Object.keys(session) : 'No session');

    try {
      console.log('Attempting to initialize Google APIs...');
      const { drive, sheets } = initializeUserApis(session.accessToken);
      console.log('Google APIs initialized successfully');

      const referenceLogId = await findPMSReferenceLogFile(drive);
      console.log('PMS Reference Log ID:', referenceLogId);

      if (req.method === 'POST' || req.method === 'PUT') {
        let range = '';
        if (type === 'client') {
          range = `${SHEET_NAME}!A:${LAST_COLUMN}`; // Now set to 'I' for 9 columns
        } else if (type === 'project') {
          range = 'Project Overview!A:H'; // Assuming this still fits within 8 columns
        } else {
          console.log('Unknown data type:', type);
          return res.status(400).json({ error: 'Unknown data type' });
        }

        if (req.method === 'POST') {
          console.log('Appending data to:', range);
          await sheets.spreadsheets.values.append({
            spreadsheetId: referenceLogId,
            range,
            valueInputOption: 'RAW',
            requestBody: {
              values: [Object.values(dataToWrite)], // Use dataToWrite here
            },
          });
          return res.status(200).json({ message: `${type} added successfully` });
        } else {
          const originalIdentifier = data.originalIdentifier;
          console.log('Attempting to update:', originalIdentifier);
          const rowToUpdate = await findRowToUpdate(sheets, referenceLogId, range, originalIdentifier);

          if (!rowToUpdate) {
            console.log('Row not found for identifier:', originalIdentifier);
            return res.status(404).json({ error: `${type} not found` });
          }

          console.log('Updating row:', rowToUpdate);
          await sheets.spreadsheets.values.update({
            spreadsheetId: referenceLogId,
            range: `${SHEET_NAME}!A${rowToUpdate}:${LAST_COLUMN}${rowToUpdate}`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [Object.values(dataToWrite)], // Use dataToWrite here
            },
          });
          return res.status(200).json({ message: `${type} updated successfully` });
        }
      } else {
        return res.status(405).json({ error: 'Method not allowed' });
      }
    } catch (err: any) {
      console.error('API error:', err);
      return res.status(500).json({ error: err.message });
    }
  } catch (err: any) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default handler;

async function findRowToUpdate(sheets: sheets_v4.Sheets, spreadsheetId: string, range: string, identifier: string): Promise<number | null> {
  console.log(`Finding row to update with identifier: ${identifier}`);
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = resp.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === identifier);
  return rowIndex !== -1 ? rowIndex + 1 : null;
}