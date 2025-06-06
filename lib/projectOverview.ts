// lib/projectOverview.ts

import { drive_v3 } from 'googleapis';
import { sheets_v4 } from 'googleapis/build/src/apis/sheets/v4';

export interface ProjectRow {
  projectNumber: string;
  projectDate: string;
  agent: string;
  invoiceCompany: string;
  presenter: string;
  projectTitle: string;
  projectNature: string;
  amount: string;
  paid: 'TRUE' | 'FALSE';
  paidOnDate: string;
  bankAccountIdentifier: string;
  invoice: string;
  invoiceUrl: string;
}

export async function fetchProjectRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  startRow: number = 6
): Promise<ProjectRow[]> {
  const range = `A${startRow}:L`;
  console.log('[fetchProjectRows] Using range:', range);
  // Request grid data so that we can read formattedValue (which is the displayed text)
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [range],
    includeGridData: true,
  });
  const sheet = response.data.sheets?.[0];
  if (!sheet || !sheet.data || sheet.data.length === 0) {
    console.error('[fetchProjectRows] No sheet data found');
    return [];
  }
  const gridData = sheet.data[0];
  if (!gridData.rowData) return [];

  // Helper function: Use formattedValue if available.
  const cellText = (idx: number, cellValues: any[]): string => {
    const cell = cellValues[idx];
    if (!cell) return '';
    if (cell.formattedValue) {
      return cell.formattedValue;
    }
    if (cell.effectiveValue && 'stringValue' in cell.effectiveValue) {
      return cell.effectiveValue.stringValue || '';
    }
    return '';
  };

  const rows: ProjectRow[] = [];
  gridData.rowData.forEach((rowData, rowIndex) => {
    if (!rowData.values) return;
    const values = rowData.values;
    // Filter out rows with an empty first cell or if it contains "total" (case‑insensitive)
    const firstCell = cellText(0, values);
    if (!firstCell || firstCell.toLowerCase().includes("total")) {
      console.log(`[fetchProjectRows] Skipping row ${rowIndex + startRow}: "${firstCell}"`);
      return;
    }
    const rawAmount = cellText(7, values);
    const numericAmount = parseFloat(rawAmount.replace(/[^\d.-]+/g, '')) || 0;
    // For the invoice cell (index 10), check for hyperlink in the cell object.
    let invoice = cellText(11, values);
    let invoiceUrl = '';
    if (values[11] && values[11].hyperlink) {
      invoiceUrl = values[11].hyperlink;
    }
    rows.push({
      projectNumber: cellText(0, values),
      projectDate: cellText(1, values),
      agent: cellText(2, values),
      invoiceCompany: cellText(3, values),
      presenter: cellText(4, values),
      projectTitle: cellText(5, values),
      projectNature: cellText(6, values),
      amount: numericAmount.toFixed(2),
      paid: cellText(8, values) || 'FALSE',
      paidOnDate: cellText(9, values),
      bankAccountIdentifier: cellText(10, values),
      invoice,
      invoiceUrl,
    });
    console.log(`[fetchProjectRows] Row ${rowIndex + startRow}: projectDate="${cellText(1, values)}", paid="${cellText(8, values)}", bankAccountIdentifier="${cellText(10, values)}", invoiceUrl="${invoiceUrl}"`);
  });
  return rows;
}

export async function listProjectOverviewFiles(
  drive: drive_v3.Drive,
  subsidiaryIds: string[] = []
): Promise<Record<string, Array<{
  companyIdentifier: string;
  fullCompanyName: string;
  file: drive_v3.Schema$File;
}>>> {
  // ... (rest of this function remains unchanged)
  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'Project Overview'",
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = response.data.files || [];
  const projectsByCategory: Record<string, Array<{
    companyIdentifier: string;
    fullCompanyName: string;
    file: drive_v3.Schema$File;
  }>> = {};

  files.forEach((file) => {
    if (!file.name) return;
    const match = file.name.match(/^(\d{4})\s+(\S+)\s+Project Overview/i);
    if (match) {
      const year = match[1];
      const subsidiary = match[2];
      if (!projectsByCategory[year]) {
        projectsByCategory[year] = [];
      }
      projectsByCategory[year].push({
        companyIdentifier: subsidiary,
        fullCompanyName: file.name,
        file,
      });
    }
  });
  Object.keys(projectsByCategory).forEach((year) => {
    projectsByCategory[year].sort((a, b) =>
      a.fullCompanyName.localeCompare(b.fullCompanyName)
    );
  });
  return projectsByCategory;
}

export function computeNextProjectNumber(year: string, projects: ProjectRow[]): string {
  let max = 0;
  projects.forEach(p => {
    const m = p.projectNumber.trim().match(/^#?(\d{4})-(\d{3})$/);
    if (m && m[1] === year) {
      const num = parseInt(m[2], 10);
      if (num > max) max = num;
    }
  });
  const next = String(max + 1).padStart(3, '0');
  return `#${year}-${next}`;
}
