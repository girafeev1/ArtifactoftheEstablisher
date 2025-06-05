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
        projectData.presenterWorkType,
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
      // 1. Fetch table data from A6:L
      const range = 'Project Overview!A6:L';
      console.log('[API POST] Fetching range:', range);
      const valueResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range,
      });
      const rows = valueResponse.data.values || [];
      console.log('[API POST] Existing rows count:', rows.length);

      // 2. Fetch sheet metadata (including banding info)
      console.log('[API POST] Fetching sheet metadata for fileId:', fileId);
      const sheetMeta = await sheets.spreadsheets.get({
        spreadsheetId: fileId,
        fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),bandedRanges)',
      });
      console.log('[API POST] Sheet metadata:', JSON.stringify(sheetMeta.data, null, 2));
      const sheet = sheetMeta.data.sheets?.find(s => s.properties?.title === 'Project Overview');
      if (!sheet || !sheet.properties) {
        throw new Error('Project Overview sheet not found');
      }
      const sheetId = sheet.properties.sheetId!;
      const totalRows = sheet.properties.gridProperties?.rowCount || 0;
      console.log('[API POST] Total rows in sheet:', totalRows);

      // 3. Determine where to insert the new row.
      // Rows are fetched starting at A6, so add 5 to convert to an absolute row number.
      // Here, we assume that a cell in column A containing "total" (case-insensitive) marks the total row.
      const totalRowIndex = rows.findIndex((row) => row[0] && row[0].toLowerCase().includes('total'));
      let insertRowIndex: number;
      if (totalRowIndex !== -1) {
        // Insert the new row just above the total row.
        insertRowIndex = totalRowIndex + 5;
      } else {
        // Otherwise, append after existing data.
        insertRowIndex = rows.length > 0 ? rows.length + 5 : 6;
      }
      console.log('[API POST] Insert row at index:', insertRowIndex);

      // 4. Define the new table’s last row and the new total row position.
      // (For example, if new row is inserted at row 11 then table data covers rows 6–11 and the total row moves to row 12.)
      const newTableEndRow = insertRowIndex;
      const totalRowNewIndex = newTableEndRow + 1;

      // 5. Expand the sheet to exactly the needed number of rows (so the total row is at the right place).
      if (totalRowNewIndex > totalRows) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: fileId,
          requestBody: {
            requests: [{
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    rowCount: totalRowNewIndex, // Set to exactly the new total row index (e.g. 12)
                    columnCount: Math.max(sheet.properties.gridProperties?.columnCount || 12, 12),
                  },
                },
                fields: 'gridProperties(rowCount,columnCount)',
              },
            }],
          },
        });
        console.log('[API POST] Expanded sheet to rowCount:', totalRowNewIndex);
      }

      // 6. Insert the new row and copy formatting from the row above it.
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: fileId,
        requestBody: {
          requests: [
            {
              insertRange: {
                range: {
                  sheetId,
                  startRowIndex: insertRowIndex - 1, // New row inserted here (e.g. A11)
                  endRowIndex: insertRowIndex,
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
                  startRowIndex: insertRowIndex - 2, // Copy formatting from the row above (e.g. A10)
                  endRowIndex: insertRowIndex - 1,
                  startColumnIndex: 0,
                  endColumnIndex: 12,
                },
                destination: {
                  sheetId,
                  startRowIndex: insertRowIndex - 1, // Paste into the new row (e.g. A11)
                  endRowIndex: insertRowIndex,
                  startColumnIndex: 0,
                  endColumnIndex: 12,
                },
                pasteType: 'PASTE_FORMAT',
              },
            },
          ],
        },
      });
      console.log('[API POST] Inserted new row and copied formatting at row:', insertRowIndex);

      // 7. Delete all existing banding (alternating color formatting) to clear any conflict.
      if (sheet.bandedRanges && sheet.bandedRanges.length > 0) {
        const deleteRequests = sheet.bandedRanges.map(banding => ({
          deleteBanding: { bandedRangeId: banding.bandedRangeId }
        }));
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: fileId,
          requestBody: { requests: deleteRequests },
        });
        console.log('[API POST] Deleted existing banding ranges.');
      }

      // 8. Add new banding to cover the updated table range.
      // Our table range here is assumed to start at row 5 (header) and extend down to newTableEndRow.
      const bandingRequest = {
        addBanding: {
          bandedRange: {
            range: {
              sheetId,
              startRowIndex: 5, // Header row is at A5; data from A6 downward.
              endRowIndex: newTableEndRow, // New table data ends here (exclusive, so covers up to row newTableEndRow-1)
              startColumnIndex: 0,
              endColumnIndex: 12,
            },
            rowProperties: {
              firstBandColor: { red: 1, green: 1, blue: 1 }, // white
              secondBandColor: { red: 0.9647059, green: 0.972549, blue: 0.9764706 } // light gray
            },
          },
        },
      };
      console.log('[API POST] Banding request (addBanding):', JSON.stringify(bandingRequest, null, 2));
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: fileId,
        requestBody: { requests: [bandingRequest] },
      });
      console.log('[API POST] Added new banding for table.');

      // 9. Update the new row with the project data.
      const rowValues = [
        projectData.projectNumber,
        projectData.projectDate,
        projectData.agent,
        projectData.invoiceCompany,
        projectData.presenterWorkType,
        projectData.projectTitle,
        projectData.projectNature,
        projectData.amount,
        projectData.paid,
        projectData.paidOnDate,
        projectData.bankAccountIdentifier,
        projectData.invoice,
      ];
      const updateDataRange = `Project Overview!A${insertRowIndex}:L${insertRowIndex}`;
      console.log('[API POST] Updating range:', updateDataRange, 'with values:', rowValues);
      await sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: updateDataRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      });

      // 10. Update the "total" row's formula in column G (e.g. G12 becomes =SUM(G6:G11))
      const totalFormula = `=SUM(H6:H${newTableEndRow})`;
      const totalUpdateRange = `Project Overview!H${totalRowNewIndex}`;
      console.log('[API POST] Updating total formula at:', totalUpdateRange, 'to:', totalFormula);
      await sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: totalUpdateRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[totalFormula]] },
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
