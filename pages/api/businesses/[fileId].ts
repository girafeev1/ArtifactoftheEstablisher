// pages/api/businesses/[fileId].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '../auth/[...nextauth]';
import { initializeApis } from '../../../lib/googleApi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { fileId } = req.query;
  console.log('[API businesses] fileId:', fileId);
  if (typeof fileId !== 'string' || !fileId) {
    return res.status(400).json({ error: 'Invalid fileId' });
  }
  const { sheets } = initializeApis('user', { accessToken: session.accessToken as string });

  if (req.method === 'PUT') {
    // (PUT handler unchanged)
    const { originalIdentifier, ...projectData } = req.body;
    try {
      const range = 'Project Overview!A6:L';
      console.log('[API PUT] Fetching range:', range);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range,
      });
      const rows = response.data.values || [];
      console.log('[API PUT] Fetched rows count:', rows.length);
      const rowIndex = rows.findIndex((row) => row[0] === originalIdentifier);
      console.log('[API PUT] Found rowIndex:', rowIndex);
      if (rowIndex === -1) {
        return res.status(404).json({ error: 'Project not found' });
      }
      const rowValues = [
        projectData.projectNumber,
        projectData.projectDate,
        projectData.agent,
        projectData.invoiceCompany,
        projectData.presenter,
        projectData.projectTitle,
        projectData.projectNature,
        projectData.amount,
        projectData.paid,
        projectData.paidOnDate,
        projectData.bankAccountIdentifier,
        projectData.invoice,
      ];
      const updateRange = `Project Overview!A${rowIndex + 6}:L${rowIndex + 6}`;
      console.log('[API PUT] Updating range:', updateRange, 'with values:', rowValues);
      await sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      });
      return res.status(200).json({ message: 'Project updated successfully' });
    } catch (err: any) {
      console.error('[PUT /api/businesses] error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    const projectData = req.body;
    try {
      // 1. Detect the header row so the app works regardless of where the table starts
      const headerTitles = [
        'Project #',
        'Project Date',
        'Agent',
        'Client Company',
        'Presenter/ Work Type',
        'Project Title',
        'Project Nature',
        'Amount',
        'Paid',
        'On Date',
        'Paid To',
        'Invoice',
      ];
      const headerResp = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range: 'Project Overview!A1:L20',
      });
      const headerRows = headerResp.data.values || [];
      const isHeaderRow = (row: any[]): boolean =>
        headerTitles.every((title, idx) => (row[idx] || '').toString().trim() === title);
      let headerRowIndex = headerRows.findIndex(isHeaderRow);
      if (headerRowIndex === -1) {
        headerRowIndex = 4; // Default to row 5 if not found
      }
      const dataStartRow = headerRowIndex + 2;

      // 2. Fetch table data below the header
      const range = `Project Overview!A${dataStartRow}:L`;
      console.log('[API POST] Fetching range:', range);
      const valueResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range,
      });
      const rows = valueResponse.data.values || [];
      console.log('[API POST] Existing rows count:', rows.length);

      // 3. Fetch sheet metadata for row count
      console.log('[API POST] Fetching sheet metadata for fileId:', fileId);
      const sheetMeta = await sheets.spreadsheets.get({
        spreadsheetId: fileId,
        fields: 'sheets.properties',
      });
      console.log('[API POST] Sheet metadata:', JSON.stringify(sheetMeta.data, null, 2));
      const sheet = sheetMeta.data.sheets?.find(s => s.properties?.title === 'Project Overview');
      if (!sheet || !sheet.properties) {
        throw new Error('Project Overview sheet not found');
      }
      const sheetId = sheet.properties.sheetId!;
      const totalRows = sheet.properties.gridProperties?.rowCount || 0;
      console.log('[API POST] Total rows in sheet:', totalRows);

      // 3. Determine where to insert the new row. Search for the total row and the first empty row
      const isProjectRowEmpty = (row: any[]): boolean => {
        const idx = [0, 1, 3, 4, 5, 6, 7];
        return idx.every(i => !row[i] || String(row[i]).trim() === '');
      };
      let totalRowIndex = -1;
      let emptyRowIndex = -1;
      rows.forEach((row, i) => {
        const cellA = (row[0] || '').toString().toLowerCase();
        if (totalRowIndex === -1 && cellA.includes('total')) {
          totalRowIndex = i;
        }
        if (emptyRowIndex === -1 && isProjectRowEmpty(row)) {
          emptyRowIndex = i;
        }
      });

      let writeRowIndex = dataStartRow + rows.length;
      let needsInsert = true;
      if (emptyRowIndex !== -1 && (totalRowIndex === -1 || emptyRowIndex < totalRowIndex)) {
        // Use the first empty row before the total row
        writeRowIndex = dataStartRow + emptyRowIndex;
        needsInsert = false;
      } else if (totalRowIndex !== -1) {
        // Insert directly above the total row
        writeRowIndex = dataStartRow + totalRowIndex;
        needsInsert = true;
      }
      console.log('[API POST] Write row index:', writeRowIndex, 'needsInsert:', needsInsert);

      // 4. Ensure the sheet has enough rows
      const currentRowCount = sheet.properties?.gridProperties?.rowCount || 0;
      if (writeRowIndex > currentRowCount) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: fileId,
          requestBody: {
            requests: [
              {
                appendDimension: {
                  sheetId,
                  dimension: 'ROWS',
                  length: writeRowIndex - currentRowCount,
                },
              },
            ],
          },
        });
        console.log('[API POST] Appended rows to sheet:', writeRowIndex - currentRowCount);
      }

      // 5. Insert a new row if required and copy formatting from the row above
      if (needsInsert) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: fileId,
          requestBody: {
            requests: [
              {
                insertRange: {
                  range: {
                    sheetId,
                    startRowIndex: writeRowIndex - 1,
                    endRowIndex: writeRowIndex,
                    startColumnIndex: 0,
                    endColumnIndex: 12,
                  },
                  shiftDimension: 'ROWS',
                },
              },
              {
                copyPaste: {
                  source: {
                    sheetId,
                    startRowIndex: writeRowIndex - 2,
                    endRowIndex: writeRowIndex - 1,
                    startColumnIndex: 0,
                    endColumnIndex: 12,
                  },
                  destination: {
                    sheetId,
                    startRowIndex: writeRowIndex - 1,
                    endRowIndex: writeRowIndex,
                    startColumnIndex: 0,
                    endColumnIndex: 12,
                  },
                  pasteType: 'PASTE_FORMAT',
                },
              },
            ],
          },
        });
        console.log('[API POST] Inserted new row at:', writeRowIndex);
      } else {
        // If reusing an empty row, ensure formatting matches the row above
        if (writeRowIndex > dataStartRow) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: fileId,
            requestBody: {
              requests: [
                {
                  copyPaste: {
                    source: {
                      sheetId,
                      startRowIndex: writeRowIndex - 2,
                      endRowIndex: writeRowIndex - 1,
                      startColumnIndex: 0,
                      endColumnIndex: 12,
                    },
                    destination: {
                      sheetId,
                      startRowIndex: writeRowIndex - 1,
                      endRowIndex: writeRowIndex,
                      startColumnIndex: 0,
                      endColumnIndex: 12,
                    },
                    pasteType: 'PASTE_FORMAT',
                  },
                },
              ],
            },
          });
          console.log('[API POST] Applied formatting to existing empty row:', writeRowIndex);
        }
      }

      // 6. Update the new row with the project data.
      const rowValues = [
        projectData.projectNumber,
        projectData.projectDate,
        projectData.agent,
        projectData.invoiceCompany,
        projectData.presenter,
        projectData.projectTitle,
        projectData.projectNature,
        projectData.amount,
        projectData.paid,
        projectData.paidOnDate,
        projectData.bankAccountIdentifier,
        projectData.invoice,
      ];
      const updateDataRange = `Project Overview!A${writeRowIndex}:L${writeRowIndex}`;
      console.log('[API POST] Updating range:', updateDataRange, 'with values:', rowValues);
      await sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: updateDataRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      });

      // 11. Verify that the new row was updated correctly.
      const verifyResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range: updateDataRange,
      });
      const updatedRow = verifyResponse.data.values?.[0];
      console.log('[API POST] Verified updated row:', updatedRow);
      if (!updatedRow || updatedRow[0] !== projectData.projectNumber) {
        throw new Error('Failed to verify project update in sheet');
      }

      console.log('[API POST] Project added successfully');
      return res.status(200).json({ message: 'Project created successfully' });
    } catch (err: any) {
      console.error('[POST /api/businesses] error:', err);
      if (err.response) {
        console.error('[API POST] Error response:', err.response.data);
      }
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
