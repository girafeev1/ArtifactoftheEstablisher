// lib/projectOverview.ts

import { drive_v3, sheets_v4 } from 'googleapis';

/**
 * Interface for a single project row from "Project Overview".
 */
export interface ProjectRow {
  rowIndex: number;
  projectNumber: string;
  projectDate: string;
  agent: string;
  invoiceCompany: string;
  projectTitle: string;
  projectNature: string;
  amount: string;
  paid: 'TRUE' | 'FALSE';
  paidOnDate: string;
  bankAccountIdentifier: string;
  invoice: string;
  invoiceUrl: string | null;
}

/**
 * Fetch project rows from "Project Overview" starting at the given row.
 * Excludes the last row (assumed to be the totals row).
 */
export async function fetchProjectRows(
  sheets: sheets_v4.Sheets,
  fileId: string,
  startRow = 6
): Promise<ProjectRow[]> {
  const resp = await sheets.spreadsheets.get({
    spreadsheetId: fileId,
    ranges: [`Project Overview!A${startRow}:K`],
    includeGridData: true,
  });
  const sheet = resp.data.sheets?.[0];
  if (!sheet?.data || sheet.data.length === 0) return [];
  const rowData = sheet.data[0].rowData || [];
  const usableRows = rowData.slice(0, rowData.length - 1); // exclude totals row
  const projects: ProjectRow[] = usableRows.map((row, idx) => {
    const cells = row.values || [];
    let paidVal = (cells[7]?.formattedValue || '').trim();
    if (paidVal === '✔' || paidVal.toUpperCase() === 'TRUE') {
      paidVal = 'TRUE';
    } else {
      paidVal = 'FALSE';
    }
    return {
      rowIndex: idx + startRow,
      projectNumber: cells[0]?.formattedValue || '',
      projectDate: cells[1]?.formattedValue || '',
      agent: cells[2]?.formattedValue || '',
      invoiceCompany: cells[3]?.formattedValue || '',
      projectTitle: cells[4]?.formattedValue || '',
      projectNature: cells[5]?.formattedValue || '',
      amount: (cells[6]?.formattedValue || '').replace(/[^0-9.]/g, ''),
      paid: paidVal as 'TRUE' | 'FALSE',
      paidOnDate: cells[8]?.formattedValue || '',
      bankAccountIdentifier: cells[9]?.formattedValue || '',
      invoice: cells[10]?.formattedValue || '',
      invoiceUrl: cells[10]?.hyperlink || null,
    };
  });
  return projects.filter(p => p.projectNumber.trim() !== '');
}

/**
 * Update a project row in "Project Overview".
 */
export async function updateProjectRow(
  sheets: sheets_v4.Sheets,
  fileId: string,
  originalProjectNumber: string,
  updates: {
    projectNumber?: string;
    projectDate?: string;
    agent?: string;
    invoiceCompany?: string;
    projectTitle?: string;
    projectNature?: string;
    amount?: number | string;
    paid?: string;
    paidOnDate?: string;
    bankAccountIdentifier?: string;
    invoice?: string;
  }
): Promise<void> {
  const rangeAll = 'Project Overview!A:K';
  const getResp = await sheets.spreadsheets.values.get({ spreadsheetId: fileId, range: rangeAll });
  const rows = getResp.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === originalProjectNumber);
  if (rowIndex === -1) throw new Error(`Project "${originalProjectNumber}" not found`);
  const actualRow = rowIndex + 1; // convert to 1-indexed
  let paidVal = 'FALSE';
  if (updates.paid && updates.paid.toUpperCase() === 'TRUE') paidVal = 'TRUE';
  let amtNum = 0;
  if (typeof updates.amount === 'string') {
    amtNum = parseFloat(updates.amount.replace(/[^0-9.]/g, '') || '0');
  } else if (typeof updates.amount === 'number') {
    amtNum = updates.amount;
  }
  const newRowValues = [
    updates.projectNumber || '',
    updates.projectDate || '',
    updates.agent || '',
    updates.invoiceCompany || '',
    updates.projectTitle || '',
    updates.projectNature || '',
    `$ ${amtNum.toFixed(2)}`,
    paidVal,
    updates.paidOnDate || '',
    updates.bankAccountIdentifier || '',
    updates.invoice || '',
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: `Project Overview!A${actualRow}:K${actualRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [newRowValues] },
  });
}

/**
 * Insert a new project row before the totals row.
 */
export async function addProjectRowBeforeTotal(
  sheets: sheets_v4.Sheets,
  fileId: string,
  data: {
    projectNumber: string;
    projectDate: string;
    agent: string;
    invoiceCompany: string;
    projectTitle: string;
    projectNature: string;
    amount: number;
    paid: 'TRUE' | 'FALSE';
    paidOnDate: string;
    bankAccountIdentifier: string;
    invoice: string;
  }
): Promise<void> {
  const existingRows = await fetchProjectRows(sheets, fileId, 6);
  const totalRow1Based = existingRows.length + 6;
  const totalRow0Based = totalRow1Based - 1;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: fileId, includeGridData: false });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === 'Project Overview');
  if (!sheet || !sheet.properties?.sheetId) throw new Error('Cannot find "Project Overview" sheet');
  const sheetId = sheet.properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: fileId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: totalRow0Based, endIndex: totalRow0Based + 1 },
            inheritFromBefore: true,
          },
        },
        {
          copyPaste: {
            source: {
              sheetId,
              startRowIndex: totalRow0Based - 1,
              endRowIndex: totalRow0Based,
              startColumnIndex: 0,
              endColumnIndex: 11,
            },
            destination: {
              sheetId,
              startRowIndex: totalRow0Based,
              endRowIndex: totalRow0Based + 1,
              startColumnIndex: 0,
              endColumnIndex: 11,
            },
            pasteType: 'PASTE_FORMAT',
            pasteOrientation: 'NORMAL',
          },
        },
      ],
    },
  });
  const rowValues = [
    data.projectNumber,
    data.projectDate,
    data.agent,
    data.invoiceCompany,
    data.projectTitle,
    data.projectNature,
    `$ ${data.amount.toFixed(2)}`,
    data.paid,
    data.paidOnDate,
    data.bankAccountIdentifier,
    data.invoice,
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: `Project Overview!A${totalRow1Based}:K${totalRow1Based}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
  });
}

/**
 * Delete a project row from the Project Overview sheet.
 */
export async function deleteProjectRow(
  sheets: sheets_v4.Sheets,
  fileId: string,
  projectNumber: string
): Promise<void> {
  const rangeAll = 'Project Overview!A:K';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: fileId, range: rangeAll });
  const rows = resp.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === projectNumber);
  if (rowIndex === -1) throw new Error(`Project "${projectNumber}" not found`);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: fileId, includeGridData: false });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === 'Project Overview');
  if (!sheet || !sheet.properties?.sheetId) throw new Error('Cannot find "Project Overview" sheet ID');
  const sheetId = sheet.properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: fileId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        },
      ],
    },
  });
}

/**
 * List Project Overview files from Google Drive.
 * Files are grouped by year.
 */
export async function listProjectOverviewFiles(
  drive: drive_v3.Drive,
  subsidiaryData: Array<{ categoryIdentifier: string; fullCompanyName: string }> = []
): Promise<Record<string, Array<{
  companyIdentifier: string;
  fullCompanyName: string;
  file: drive_v3.Schema$File;
}>>> {
  try {
    const response = await drive.files.list({
      q: "name contains 'Project Overview' and mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)',
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    const files = response.data.files || [];
    const projectsByCategory: Record<string, Array<{
      companyIdentifier: string;
      fullCompanyName: string;
      file: drive_v3.Schema$File;
    }>> = {};
    files.forEach(file => {
      const fileName = file.name || '';
      const match = fileName.match(/^(\d{4})\s+(\S+)\s+Project Overview/i);
      if (match) {
        const [, year, companyId] = match;
        if (!projectsByCategory[year]) projectsByCategory[year] = [];
        const found = subsidiaryData.find(row => row.categoryIdentifier === companyId);
        const fullName = found ? found.fullCompanyName : companyId;
        projectsByCategory[year].push({
          companyIdentifier: companyId,
          fullCompanyName: fullName,
          file,
        });
      }
    });
    return projectsByCategory;
  } catch (error: any) {
    console.error('Error in listProjectOverviewFiles:', error);
    throw error;
  }
}
