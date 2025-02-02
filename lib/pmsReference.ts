// lib/pmsReference.ts

import { drive_v3, sheets_v4 } from 'googleapis';

/** Interfaces for PMS Reference Log data */
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
 * Finds the "PMS Reference Log" file in the shared drives.
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
  if (files.length > 1) throw new Error('Multiple PMS Reference Log files found!');
  return files[0].id!;
}

/**
 * Fetches the address book data from the PMS Reference Log's "Address Book of Accounts" sheet.
 */
export async function fetchAddressBook(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<AddressBookEntry[]> {
  const range = 'Address Book of Accounts!A:I';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  if (rows.length <= 2) return [];
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
 * Fetches bank account information from the "Bank Account Information of Subsidiaries" sheet.
 */
export async function fetchBankAccounts(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<BankAccountRow[]> {
  const range = 'Bank Account Information of Subsidiaries!A:H';
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  if (rows.length <= 2) return [];
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
 * Fetches the reference names mapping from the "Reference of Subsidiary Names" sheet.
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
    if (row[0] && row[1]) {
      mapping[row[0]] = row[1];
    }
  }
  return mapping;
}
