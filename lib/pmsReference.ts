// lib/pmsReference.ts
import { drive_v3, sheets_v4 } from 'googleapis';

export interface AddressBookEntry {
  companyName: string;
  title: string;
  nameAddressed: string;
  emailAddress: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  addressLine5: string;
}

export interface BankAccountRow {
  companyName: string;
  bankName: string;
  bankCode: string;
  accountType: string;
  accountNumber: string;
  fpsId: string;
  fpsEmail: string;
  comments: string;
}

/**
 * Finds the "PMS Reference Log" file by name in the shared drives.
 */
export async function findPMSReferenceLogFile(drive: drive_v3.Drive): Promise<string> {
  const response = await drive.files.list({
    q: "name = 'PMS Reference Log' and mimeType='application/vnd.google-apps.spreadsheet'",
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const files = response.data.files || [];
  if (!files.length) throw new Error('PMS Reference Log not found.');
  if (files.length > 1) throw new Error('Multiple logs found!');
  return files[0].id!;
}

/**
 * Fetches the client data from the "Address Book of Accounts" sheet.
 */
export async function fetchAddressBook(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<AddressBookEntry[]> {
  const range = 'Address Book of Accounts!A:I';
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = resp.data.values || [];
  if (rows.length <= 2) return []; // Skip title/header rows
  return rows.slice(3).map((r) => ({
    companyName: r[0] || '',
    title: r[1] || '',
    nameAddressed: r[2] || '',
    emailAddress: r[3] || '',
    addressLine1: r[4] || '',
    addressLine2: r[5] || '',
    addressLine3: r[6] || '',
    addressLine4: r[7] || '',
    addressLine5: r[8] || '',
  }));
}

/**
 * Fetches the bank account data from the "Bank Account Information" sheet.
 */
export async function fetchBankAccounts(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<BankAccountRow[]> {
  const range = 'Bank Account Information of Subsidiaries!A:H';
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = resp.data.values || [];
  if (rows.length <= 2) return []; // Skip title/header rows
  return rows.slice(3).map((r) => ({
    companyName: r[0] || '',
    bankName: r[1] || '',
    bankCode: r[2] || '',
    accountType: r[3] || '',
    accountNumber: r[4] || '',
    fpsId: r[5] || '',
    fpsEmail: r[6] || '',
    comments: r[7] || '',
  }));
}

/**
 * Lists all spreadsheet files containing "Project Overview" in their names.
 */
export async function listProjectOverviewFiles(
  drive: drive_v3.Drive,
  subsidiaryData: any[] = []
): Promise<Record<string, any[]>> {
  const response = await drive.files.list({
    q: "name contains 'Project Overview' and mimeType='application/vnd.google-apps.spreadsheet'",
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const files = response.data.files || [];
  if (!files.length) return {};

  const projectsByCategory: Record<string, any[]> = {};
  files.forEach((file) => {
    const match = file.name?.match(/^([A-Za-z0-9]{4})\s+(\S+)\s+Project Overview/);
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
}
