// pages/api/info.ts
// @ts-nocheck

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from './auth/[...nextauth]'; // your nextauth file
import { initializeApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile } from '../../lib/pmsReference';
import { sheets_v4 } from 'googleapis';

// For an 11-column Project Overview: A..L
const PROJECT_OVERVIEW_RANGE = 'Project Overview!A:L';
// If your first data row is row 5, you might do "Project Overview!A5:L" for appending/updating.
// But typically, for updates, we retrieve the entire A:L and find the row offset.

const SHEET_NAME_PROJECT_OVERVIEW = 'Project Overview';
const LAST_COLUMN_PROJECT = 'L';

const SHEET_NAME_CLIENTS = 'Address Book of Accounts';
const LAST_COLUMN_CLIENTS = 'I'; // example from your clients page

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1) Must have session
    const authOptions = await getAuthOptions();
    const session = await getServerSession(req, res, authOptions);
    if (!session?.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2) We expect a body with { type, data } from the client
    const { type, data } = req.body;
    if (!type || !data) {
      return res.status(400).json({ error: 'Missing type or data' });
    }

    console.log(`API Request: ${req.method} /api/info?type=${type}`);

    // 3) Initialize user-based Google APIs
    const { drive, sheets } = initializeApis(session.accessToken as string);
    const referenceLogId = await findPMSReferenceLogFile(drive);

    // 4) Route the request by type
    if (type === 'client') {
      // This might be your existing client code (POST/PUT).
      // Example:
      if (req.method === 'POST') {
        return handleClientPost(data, sheets, referenceLogId, res);
      } else if (req.method === 'PUT') {
        return handleClientPut(data, sheets, referenceLogId, res);
      } else {
        return res.status(405).json({ error: 'Method not allowed for clients' });
      }
    } else if (type === 'project') {
      // ❶ Here is the new logic for "project"
      if (req.method === 'POST') {
        return handleProjectPost(data, sheets, referenceLogId, res);
      } else if (req.method === 'PUT') {
        return handleProjectPut(data, sheets, referenceLogId, res);
      } else {
        return res.status(405).json({ error: 'Method not allowed for projects' });
      }
    } else {
      console.log('Unknown data type:', type);
      return res.status(400).json({ error: 'Unknown data type' });
    }
  } catch (err: any) {
    console.error('[API /api/info] error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

/** ---------------------------
 *   Client handlers
 * ---------------------------*/
async function handleClientPost(
  data: any,
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  res: NextApiResponse
) {
  // Similar to your existing "clients" logic
  // e.g. range = "Address Book of Accounts!A:I"
  const range = `${SHEET_NAME_CLIENTS}!A:${LAST_COLUMN_CLIENTS}`;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: [Object.values(data)],
    },
  });
  return res.status(200).json({ message: 'client added successfully' });
}

async function handleClientPut(
  data: any,
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  res: NextApiResponse
) {
  const originalIdentifier = data.originalIdentifier;
  if (!originalIdentifier) {
    return res.status(400).json({ error: 'Missing originalIdentifier' });
  }
  const range = `${SHEET_NAME_CLIENTS}!A:${LAST_COLUMN_CLIENTS}`;
  const rowToUpdate = await findRowToUpdate(
    sheets,
    spreadsheetId,
    range,
    originalIdentifier
  );
  if (!rowToUpdate) {
    return res.status(404).json({ error: 'client not found' });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME_CLIENTS}!A${rowToUpdate}:${LAST_COLUMN_CLIENTS}${rowToUpdate}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [Object.values(data)],
    },
  });
  return res.status(200).json({ message: 'client updated successfully' });
}

/** ---------------------------
 *   Project handlers
 * ---------------------------*/

/** POST => append a new project row */
async function handleProjectPost(
  data: any,
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  res: NextApiResponse
) {
  // e.g. "Project Overview!A:L"
  // Make sure `data` is in the same order as your columns
  // [ projectNumber, projectDate, agent, invoiceCompany, presenter, projectTitle, projectNature, amount, paid, paidOnDate, invoice ]
  const rowValues = [
    data.projectNumber || '',
    data.projectDate || '',
    data.agent || '',
    data.invoiceCompany || '',
    data.presenter || '',
    data.projectTitle || '',
    data.projectNature || '',
    data.amount || '',
    data.paid || '', // "TRUE"/"FALSE" or boolean
    data.paidOnDate || '',
    data.invoice || '',
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME_PROJECT_OVERVIEW}!A:${LAST_COLUMN_PROJECT}`, // "Project Overview!A:L"
    valueInputOption: 'RAW',
    requestBody: {
      values: [rowValues],
    },
  });
  return res.status(200).json({ message: 'project added successfully' });
}

/** PUT => find row by originalIdentifier in col A, update it */
async function handleProjectPut(
  data: any,
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  res: NextApiResponse
) {
  const originalIdentifier = data.originalIdentifier; // e.g. the old projectNumber
  if (!originalIdentifier) {
    return res.status(400).json({ error: 'Missing originalIdentifier' });
  }
  // we read the entire A..J range to find the row
  const range = `${SHEET_NAME_PROJECT_OVERVIEW}!A:${LAST_COLUMN_PROJECT}`;
  const rowToUpdate = await findRowToUpdate(sheets, spreadsheetId, range, originalIdentifier);
  if (!rowToUpdate) {
    return res.status(404).json({ error: 'project not found' });
  }

  // build the new row in the same order
  const rowValues = [
    data.projectNumber || '',
    data.projectDate || '',
    data.agent || '',
    data.invoiceCompany || '',
    data.presenter || '',
    data.projectTitle || '',
    data.projectNature || '',
    data.amount || '',
    data.paid || '', // "TRUE"/"FALSE"
    data.paidOnDate || '',
    data.invoice || '',
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME_PROJECT_OVERVIEW}!A${rowToUpdate}:${LAST_COLUMN_PROJECT}${rowToUpdate}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [rowValues],
    },
  });
  return res.status(200).json({ message: 'project updated successfully' });
}

/** Utility: find the row index where col A = identifier */
async function findRowToUpdate(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  range: string,
  identifier: string
): Promise<number | null> {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = resp.data.values || [];
  // row[0] is col A => projectNumber.  We find a match.
  // rowIndex is 0-based, but Sheets is 1-based.
  const rowIndex = rows.findIndex((row) => row[0] === identifier);
  return rowIndex === -1 ? null : rowIndex + 1;
}
