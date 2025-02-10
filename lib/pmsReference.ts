// lib/pmsReference.ts

import { drive_v3, sheets_v4 } from 'googleapis';
import { TextDecoder } from 'util';

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
  comments?: string;
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

export async function findPMSReferenceLogFile(drive: drive_v3.Drive): Promise<string> {
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
    console.warn('[findPMSReferenceLogFile] Found multiple PMS Reference Log files, using first.');
  }
  return files[0].id!;
}

export async function fetchReferenceNames(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<Record<string, string>> {
  const range = 'Reference of Subsidiary Names!A2:B';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  const mapping: Record<string, string> = {};
  for (const row of rows) {
    const code = row[0]?.trim();
    const fullName = row[1]?.trim();
    if (code && fullName) {
      mapping[code] = fullName;
    }
  }
  return mapping;
}

export async function fetchAddressBook(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<AddressBookEntry[]> {
  const range = 'Address Book of Accounts!A2:I';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  const results: AddressBookEntry[] = rows.map((r) => ({
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
  return results;
}

export async function fetchBankAccounts(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<BankAccountRow[]> {
  // Adjusted range to include column I for the identifier.
  const range = 'Bank Account Information of Subsidiaries!A2:I';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  const results: BankAccountRow[] = rows.map((r) => ({
    companyName: r[0] || '',
    bankName: r[1] || '',
    bankCode: r[2] || '',
    accountType: r[3] || '',
    accountNumber: r[4] || '',
    fpsId: r[5] || '',
    fpsEmail: r[6] || '',
    comments: r[7] || '',
    identifier: r[8] || '',
  }));
  return results;
}

export async function fetchSubsidiaryData(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<SubsidiaryData[]> {
  const range = 'Reference of Subsidiary Names!A2:J';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  const results: SubsidiaryData[] = rows.map((r) => ({
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
  return results;
}
