// pages/api/invoices/createInvoice.ts
// @ts-nocheck

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '../auth/[...nextauth]';
import { initializeApis } from '../../../lib/googleApi';
import { fetchProjectRows } from '../../../lib/projectOverview';
import { applyDimensions, createMergeRequests, applyRichTextFormatting, applyBackgroundColors } from '../../../lib/googleSheetUtils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authOptions = await getAuthOptions();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileId, projectNumber, invoiceNumber, issuedDate, issuer, bankInfo, billTo, lineItems } = req.body;

  if (!fileId || !projectNumber || !invoiceNumber) {
    return res.status(400).json({ error: 'Missing required fields: fileId, projectNumber, invoiceNumber' });
  }

  try {
    const { sheets } = initializeApis('user', { accessToken: session.accessToken as string });

    // Step 1: Add a new sheet
    const sheetTitle = invoiceNumber;
    const addSheetRequest = {
      addSheet: {
        properties: {
          title: sheetTitle,
          gridProperties: { rowCount: 57, columnCount: 12 },
        },
      },
    };
    const batchUpdateResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: fileId,
      requestBody: { requests: [addSheetRequest] },
    });
    const newSheetId = batchUpdateResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (!newSheetId) throw new Error('Failed to create invoice sheet');

    // Step 2: Prepare data
    const issuerAddress = [issuer.room, issuer.building, issuer.street, issuer.district, issuer.region ? `${issuer.region}, Hong Kong` : ''].filter(Boolean);
    const billToAddress = [billTo.addressLine1, billTo.addressLine2, billTo.addressLine3, billTo.addressLine4, billTo.addressLine5].filter(Boolean);
    const totalAmount = lineItems.reduce((sum: number, item: any) => sum + parseFloat(item.total || 0), 0);
    const issuedDateFormatted = new Date(issuedDate).toISOString().split('T')[0];

    // Step 3: Populate cells
    const richText = Array(57).fill(null).map(() => Array(12).fill({ value: '', runs: [] }));
    const horizontalAlignments = Array(57).fill(null).map(() => Array(12).fill('LEFT'));
    const verticalAlignments = Array(57).fill(null).map(() => Array(12).fill('TOP'));

    // Issuer Info
    richText[0][1] = { value: issuer.englishName, runs: [{ start: 0, format: { fontFamily: 'Source Code Pro', fontSize: 32 } }] };
    horizontalAlignments[0][1] = 'CENTER';
    verticalAlignments[0][1] = 'MIDDLE';
    issuerAddress.forEach((line, idx) => {
      richText[2 + idx][1] = { value: line, runs: [{ start: 0, format: { fontFamily: 'Roboto Mono' } }] };
    });
    richText[2][5] = { value: issuer.chineseName, runs: [{ start: 0, format: { fontFamily: 'DFKai-SB' } }] };
    horizontalAlignments[2][5] = 'RIGHT';
    richText[4][5] = { value: `${issuer.phone}\n${issuer.email}`, runs: [{ start: 0, format: { fontFamily: 'Roboto Mono' } }] };
    horizontalAlignments[4][5] = 'RIGHT';
    richText[4][8] = { value: 'Invoice', runs: [{ start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 22 } }] };
    horizontalAlignments[4][8] = 'RIGHT';

    // Bill To (Dynamic)
    const billToStartRow = 6;
    richText[billToStartRow][1] = { value: 'Bill To', runs: [{ start: 0, format: { fontFamily: 'Courier New', fontSize: 19, italic: true } }] };
    horizontalAlignments[billToStartRow][1] = 'LEFT';
    richText[billToStartRow + 1][1] = { value: billTo.companyName, runs: [{ start: 0, format: { fontFamily: 'Google Sans Mono', fontSize: 14, bold: true } }] };
    billToAddress.forEach((line, idx) => {
      richText[billToStartRow + 2 + idx][1] = { value: line, runs: [{ start: 0, format: { fontFamily: 'Google Sans Mono', fontSize: 12 } }] };
    });
    const lastAddressRow = billToStartRow + 1 + billToAddress.length;
    richText[lastAddressRow - 1][10] = { value: 'Invoice #', runs: [{ start: 0, format: { fontFamily: 'Google Sans Mono' } }] };
    horizontalAlignments[lastAddressRow - 1][10] = 'RIGHT';
    richText[lastAddressRow][10] = { value: invoiceNumber, runs: [{ start: 0, format: { fontFamily: 'Google Sans Mono', bold: true } }] };
    horizontalAlignments[lastAddressRow][10] = 'RIGHT';

    // Issued Date (Fixed)
    const issuedDateRow = 12; // Static per original layout
    richText[issuedDateRow][1] = { value: 'Issued Date:', runs: [{ start: 0, format: { fontFamily: 'Google Sans Mono', italic: true } }] };
    richText[issuedDateRow][4] = { value: issuedDateFormatted, runs: [] };
    horizontalAlignments[issuedDateRow][4] = 'LEFT';

    // Headers
    richText[15][1] = { value: 'DESCRIPTION', runs: [{ start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 20, bold: true } }] };
    horizontalAlignments[15][1] = 'CENTER';
    richText[15][7] = { value: 'AMOUNT', runs: [{ start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 25, bold: true } }] };
    horizontalAlignments[15][7] = 'CENTER';

    // Line Items
    let row = 18;
    lineItems.forEach((item: any) => {
      richText[row][1] = { value: `${item.title} x${item.quantity}`, runs: [
        { start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 14, bold: true, italic: true } },
        { start: item.title.length, format: { fontFamily: 'Roboto Mono', bold: true, italic: true } },
      ] };
      richText[row + 1][1] = { value: item.feeDescription, runs: [{ start: 0, format: { fontFamily: 'Google Sans Mono', fontSize: 12, italic: true } }] };
      richText[row + 2][1] = { value: item.notes, runs: [{ start: 0, format: { fontFamily: 'Roboto Mono', bold: true, italic: true } }] };
      richText[row][7] = { value: item.unitPrice, runs: [] };
      horizontalAlignments[row][7] = 'RIGHT';
      richText[row][8] = { value: `x${item.quantity}`, runs: [{ start: 0, format: { fontFamily: 'Roboto Serif', fontSize: 8 } }] };
      horizontalAlignments[row][8] = 'CENTER';
      richText[row][10] = { value: item.total, runs: [] };
      horizontalAlignments[row][10] = 'RIGHT';
      richText[row + 1][7] = { value: 'each', runs: [{ start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 8 } }] };
      horizontalAlignments[row + 1][7] = 'RIGHT';
      row += 3;
    });

    // Total and Payment Terms
    richText[44][5] = { value: 'INVOICE TOTAL', runs: [{ start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 20, bold: true } }] };
    horizontalAlignments[44][5] = 'RIGHT';
    richText[45][7] = { value: '(HKD)', runs: [{ start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 17, bold: true } }] };
    horizontalAlignments[45][7] = 'RIGHT';
    richText[45][8] = { value: totalAmount.toString(), runs: [{ start: 0, format: { bold: true } }] };
    horizontalAlignments[45][8] = 'RIGHT';
    richText[50][1] = { value: `Cheque Payable To: ${issuer.englishName}`, runs: [
      { start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 11 } },
      { start: 18, format: { fontFamily: 'Roboto Mono', fontSize: 11, bold: true } },
    ] };
    richText[50][6] = { value: `Bank: ${bankInfo?.bankName} (${bankInfo?.bankCode})`, runs: [
      { start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 11 } },
      { start: 6, format: { fontFamily: 'Roboto Mono', fontSize: 11, bold: true } },
    ] };
    horizontalAlignments[50][6] = 'RIGHT';
    richText[52][1] = { value: `FPS ID: ${bankInfo?.fpsId}`, runs: [
      { start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 12 } },
      { start: 8, format: { fontFamily: 'Roboto Mono', fontSize: 12, bold: true } },
    ] };
    richText[52][6] = { value: `Bank Account Number: ${bankInfo?.accountNumber}`, runs: [
      { start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 11 } },
      { start: 21, format: { fontFamily: 'Roboto Mono', fontSize: 11, bold: true } },
    ] };
    horizontalAlignments[52][6] = 'RIGHT';
    richText[56][1] = { value: '      PAYMENT TERMS: FULL PAYMENT WITHIN 7 DAYS                ', runs: [
      { start: 0, format: { fontFamily: 'Roboto Mono', fontSize: 11, bold: true } },
    ] };
    horizontalAlignments[56][1] = 'CENTER';

    // Step 4: Apply formatting from JSON
    const rowHeights = Array(57).fill(20);
    JSON.parse(JSON.stringify({"rh": [[0,20],[1,20],[2,20],[3,18],[4,18],[5,18],[6,43],[7,29],[8,25],[14,2],[15,53],[16,2],[17,15],[18,17],[19,38],[20,14],[25,14],[26,14],[30,14],[31,14],[35,14],[36,14],[40,25],[44,22],[45,29],[46,19]]})).rh
      .forEach(([idx, size]: [number, number]) => (rowHeights[idx] = size));
    rowHeights[11] = 21; // Above issued date
    rowHeights[13] = 21; // Below issued date

    const colWidths = Array(12).fill(100);
    JSON.parse(JSON.stringify({"cw": [[0,28],[1,48],[2,26],[3,26],[4,185],[5,226],[6,110],[7,63],[8,16],[9,14],[10,128],[11,28]]})).cw
      .forEach(([idx, size]: [number, number]) => (colWidths[idx] = size));

    const backgrounds = Array(57).fill(null).map(() => Array(12).fill('#ffffff'));
    const blackCells = ['B15', 'C15', 'D15', 'E15', 'F15', 'G15', 'H15', 'I15', 'J15', 'K15', 'B17', 'C17', 'D17', 'E17', 'F17', 'G17', 'H17', 'I17', 'J17', 'K17'];
    blackCells.forEach(cell => {
      const col = cell.charCodeAt(0) - 65;
      const row = parseInt(cell.slice(1)) - 1;
      backgrounds[row][col] = '#000000';
    });

    const merges = JSON.parse(JSON.stringify({"m": [[0,1,1,6],[0,3,8,10],[2,5,1,4],[2,2,5,6],[4,5,5,6],[4,5,8,10],[6,6,7,9],[15,15,1,4],[15,15,7,10],[6,6,1,4],[7,7,1,5],[8,8,1,5],[9,9,1,5],[10,10,1,5],[11,11,1,5],[12,12,1,3],[18,18,1,4],[19,19,1,6],[20,20,1,6],[22,22,1,5],[22,23,8,9],[22,23,10,10],[23,23,1,5],[32,33,8,9],[32,33,10,10],[37,38,8,9],[37,38,10,10],[24,24,1,6],[27,27,1,5],[27,28,8,9],[27,28,10,10],[28,28,1,5],[29,29,1,6],[32,32,1,5],[41,41,6,9],[44,46,5,5],[44,44,6,10],[45,45,8,10],[46,46,6,10],[56,56,1,11],[33,33,1,5],[34,34,1,6],[37,37,1,5],[38,38,1,4],[39,39,1,4],[40,40,1,5],[40,40,6,9]]})).m
      .map(([startRow, endRow, startCol, endCol]: [number, number, number, number]) => ({
        startRowIndex: startRow,
        endRowIndex: endRow + 1,
        startColumnIndex: startCol,
        endColumnIndex: endCol + 1,
      }));

    // Add borders (basic implementation)
    const borderRequests = [
      { range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 57, startColumnIndex: 0, endColumnIndex: 12 }, border: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } }, sides: ['top', 'bottom', 'left', 'right'] },
      { range: { sheetId: newSheetId, startRowIndex: 15, endRowIndex: 16, startColumnIndex: 1, endColumnIndex: 11 }, border: { style: 'SOLID', width: 2, color: { red: 0, green: 0, blue: 0 } }, sides: ['top', 'bottom', 'left', 'right'] },
    ].map(req => ({
      updateBorders: {
        range: req.range,
        top: req.sides.includes('top') ? req.border : undefined,
        bottom: req.sides.includes('bottom') ? req.border : undefined,
        left: req.sides.includes('left') ? req.border : undefined,
        right: req.sides.includes('right') ? req.border : undefined,
      },
    }));

    // Step 5: Apply changes
    const requests = [
      ...applyDimensions(newSheetId, 'ROWS', rowHeights),
      ...applyDimensions(newSheetId, 'COLUMNS', colWidths),
      ...createMergeRequests(newSheetId, merges),
      ...applyRichTextFormatting(newSheetId, richText, 0, horizontalAlignments, verticalAlignments),
      ...applyBackgroundColors(newSheetId, backgrounds),
      ...borderRequests,
    ];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: fileId,
      requestBody: { requests },
    });

    // Step 6: Update Project Overview
    const projects = await fetchProjectRows(sheets, fileId);
    const projectRowIndex = projects.findIndex((p) => p.projectNumber === projectNumber);
    if (projectRowIndex === -1) throw new Error(`Project ${projectNumber} not found`);
    const rowIndex = projectRowIndex + 6;
    const invoiceUrl = `https://docs.google.com/spreadsheets/d/${fileId}/edit#gid=${newSheetId}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: `Project Overview!K${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[`HYPERLINK("${invoiceUrl}", "${invoiceNumber}")`]] },
    });

    return res.status(200).json({
      message: 'Invoice created successfully',
      invoiceSheetId: newSheetId,
      invoiceUrl,
    });
  } catch (error: any) {
    console.error('[API /api/invoices/createInvoice] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
