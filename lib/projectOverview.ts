// lib/projectOverview.ts

import { drive_v3, sheets_v4 } from 'googleapis';

// Helper: Remove any leading apostrophe from a string value.
function cleanValue(v: any): any {
  return typeof v === 'string' ? v.replace(/^'/, '') : v;
}

// Helper: Clean an array of values.
function cleanValues(values: any[]): any[] {
  return values.map(cleanValue);
}

/**
 * Lists all spreadsheets with "Project Overview" in their name,
 * organized by year.
 */
export async function listProjectOverviewFiles(
  drive: drive_v3.Drive,
  subsidiaryData: any[] = []
): Promise<Record<string, any[]>> {
  try {
    const response = await drive.files.list({
      q: "name contains 'Project Overview' and mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)',
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    const files = response.data.files || [];
    const projectsByCategory: Record<string, any[]> = {};
    files.forEach((file) => {
      const fileName = file.name || '';
      // Expect file name like "2024 XYZ Project Overview"
      const match = fileName.match(/^([A-Za-z0-9]{4})\s+(\S+)\s+Project Overview/);
      if (match) {
        const [_, year, companyId] = match;
        if (!projectsByCategory[year]) projectsByCategory[year] = [];
        const mapping = subsidiaryData.find((row: any) => row.categoryIdentifier === companyId);
        projectsByCategory[year].push({
          companyIdentifier: companyId,
          fullCompanyName: mapping ? mapping.fullCompanyName : companyId,
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

/**
 * Fetches project rows from a Project Overview file.
 * Reads rows from the specified startRow (default 5) and omits the last row (assumed to be the total).
 * Normalizes the paid value to "TRUE" or "FALSE".
 */
export async function fetchProjectRows(
  sheets: sheets_v4.Sheets,
  fileId: string,
  startRow = 5
): Promise<any[]> {
  try {
    const range = `Project Overview!A${startRow}:J`;
    console.log(`Fetching project rows from range: ${range} for fileId: ${fileId}`);
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range,
    });
    const rows = resp.data.values || [];
    console.log(`Fetched ${rows.length} rows before omitting total row`);
    // Omit the last row (assumed to be the total)
    const usableRows = rows.length > 0 ? rows.slice(0, rows.length - 1) : [];
    console.log(`Using ${usableRows.length} rows after omitting the last row`);
    return usableRows.map((r, idx) => {
      let paidVal = r[7] ? r[7].toString().trim() : "";
      if (paidVal === "✔" || paidVal.toUpperCase() === "TRUE") {
        paidVal = "TRUE";
      } else {
        paidVal = "FALSE";
      }
      return {
        rowIndex: idx + startRow,
        projectNumber: cleanValue(r[0] || ''),
        projectDate: cleanValue(r[1] || ''),
        agent: cleanValue(r[2] || ''),
        invoiceCompany: cleanValue(r[3] || ''),
        projectTitle: cleanValue(r[4] || ''),
        projectNature: cleanValue(r[5] || ''),
        amount: (r[6] || '').toString().replace(/[^0-9.]/g, ''),
        paid: paidVal,
        paidOnDate: cleanValue(r[8] || ''),
        invoice: cleanValue(r[9] || ''),
      };
    });
  } catch (error: any) {
    console.error('Error in fetchProjectRows:', error);
    throw error;
  }
}

/**
 * Appends a new project row into the Project Overview file.
 * Writes the paid status as "TRUE" or "FALSE" (without a leading apostrophe).
 * (The new project form excludes the invoice field.)
 */
export async function appendProjectRow(
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
    paid: boolean | string;
    paidOnDate: string;
  }
): Promise<void> {
  let paidValue: string;
  if (typeof data.paid === 'boolean') {
    paidValue = data.paid ? "TRUE" : "FALSE";
  } else {
    paidValue = data.paid.toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
  }
  const rowValues = [
    data.projectNumber,
    data.projectDate,
    data.agent,
    data.invoiceCompany,
    data.projectTitle,
    data.projectNature,
    `$ ${data.amount.toFixed(2)}`,
    paidValue,
    data.paidOnDate,
    // invoice field omitted
  ];
  const cleanedValues = cleanValues(rowValues);
  console.log(`Appending project row to file ${fileId}:`, cleanedValues);
  await sheets.spreadsheets.values.append({
    spreadsheetId: fileId,
    range: 'Project Overview!A:J',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [cleanedValues] },
  });
  console.log('Append successful');
}

/**
 * Updates an existing project row in a Project Overview file.
 * Locates the row by matching the original project number in column A.
 * Writes the updated paid status as "TRUE" or "FALSE" (without a leading apostrophe).
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
    invoice?: string;
  }
): Promise<void> {
  console.log(`Updating project row for project number: ${originalProjectNumber} in file: ${fileId}`);
  const range = 'Project Overview!A:J';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: fileId, range });
  const rows = resp.data.values || [];
  console.log(`Retrieved ${rows.length} rows from file ${fileId}`);
  const rowIndex = rows.findIndex((r) => r[0] === originalProjectNumber);
  if (rowIndex === -1) {
    console.error(`Project with number ${originalProjectNumber} not found`);
    throw new Error(`Project with number "${originalProjectNumber}" not found`);
  }
  const actualRow = rowIndex + 1;
  console.log(`Found project at sheet row: ${actualRow}`);
  let paidValue = 'FALSE';
  if (updates.paid) {
    paidValue = updates.paid.toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE';
  }
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
    paidValue,
    updates.paidOnDate || '',
    updates.invoice || '',
  ];
  const cleanedValues = cleanValues(newRowValues);
  console.log(`Updating row at range Project Overview!A${actualRow}:J${actualRow} with:`, cleanedValues);
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: `Project Overview!A${actualRow}:J${actualRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [cleanedValues] },
  });
  console.log('Project update successful');
}
