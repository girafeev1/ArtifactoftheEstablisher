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
  fpsId?: string;
  fpsEmail?: string;
  // Remove comments field if not used; identifier is the key field for matching.
  identifier?: string;
}

export interface SubsidiaryData {
  identifier: string;
  englishName: string;
  chineseName: string;
  email: string;
  phone: string;
  room: string;
  building: string;
  street: string;
  district: string;
  region: string;
}

/**
 * Find the PMS Reference Log file in Drive.
 * Searches for a spreadsheet whose name exactly matches "PMS Reference Log".
 */
export async function findPMSReferenceLogFile(
  drive: drive_v3.Drive
): Promise<string> {
  const response = await drive.files.list({
    q: "name = 'PMS Reference Log' and mimeType='application/vnd.google-apps.spreadsheet'",
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const files = response.data.files || [];
  if (!files.length) {
    throw new Error('PMS Reference Log not found.');
  }
  if (files.length > 1) {
    console.warn(
      '[findPMSReferenceLogFile] Found multiple PMS Reference Log files, using the first.'
    );
  }
  return files[0].id!;
}

/**
 * Fetch a mapping from subsidiary code to full name.
 * Reads the range "Reference of Subsidiary Names!A2:B".
 */
export async function fetchReferenceNames(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<Record<string, string>> {
  const range = 'Reference of Subsidiary Names!A2:B';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  const mapping: Record<string, string> = {};
  for (const row of rows) {
    const code = (row[0] || '').trim();
    const fullName = (row[1] || '').trim();
    if (code && fullName) {
      mapping[code] = fullName;
    }
  }
  return mapping;
}

/**
 * Fetch Address Book entries from the "Address Book of Accounts" sheet.
 * Assumes that the data starts at row 4 (i.e. A4:I).
 */
export async function fetchAddressBook(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<AddressBookEntry[]> {
  const range = 'Address Book of Accounts!A4:I';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  return rows.map((r) => ({
    companyName: r[0] || '',
      title: r[1] || '',
      representative: r[2] || '',
      emailAddress: r[3] || '',    addressLine1: r[4] || '',
    addressLine2: r[5] || '',
    addressLine3: r[6] || '',
    addressLine4: r[7] || '',
    addressLine5: r[8] || '',
  }));
}

/**
 * Fetch Bank Account rows from the "Bank Account Information of Subsidiaries" sheet.
 * UPDATED: Assumes that the data starts at row 4 (i.e. A4:H) so that the identifier is fetched from column H.
 */
export async function fetchBankAccounts(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<BankAccountRow[]> {
  // Use range A4:H – columns: A: Company Name, B: Bank Name, C: Bank Code, D: Account Type,
  // E: Account Number, F: FPS ID, G: FPS Email, H: Identifier.
  const range = 'Bank Account Information of Subsidiaries!A4:H';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  console.log('[fetchBankAccounts] Raw rows:', rows);
  return rows.map((r) => ({
    companyName: (r[0] || '').trim(),
    bankName: (r[1] || '').trim(),
    bankCode: (r[2] || '').trim(),
    accountType: (r[3] || '').trim(),
    accountNumber: (r[4] || '').trim(),
    fpsId: (r[5] || '').trim(),
    fpsEmail: (r[6] || '').trim(),
    // Correctly assign the identifier from column H.
    identifier: (r[7] || '').trim(),
  }));
}

/**
 * Fetch subsidiary data from the "Reference of Subsidiary Names" sheet.
 * Reads the range "Reference of Subsidiary Names!A2:J".
 */
export async function fetchSubsidiaryData(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<SubsidiaryData[]> {
  const range = 'Reference of Subsidiary Names!A2:J';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  return rows.map((r) => ({
    identifier: (r[0] || '').trim(),
    englishName: (r[1] || '').trim(),
    chineseName: (r[2] || '').trim(),
    email: (r[3] || '').trim(),
    phone: (r[4] || '').trim(),
    room: (r[5] || '').trim(),
    building: (r[6] || '').trim(),
    street: (r[7] || '').trim(),
    district: (r[8] || '').trim(),
    region: (r[9] || '').trim(),
  }));
}
