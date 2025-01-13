// lib/pmsReference.ts
import { drive_v3, sheets_v4 } from 'googleapis';

// Interface for the client data
interface AddressBookEntry {
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

// Interface for the bank account data
interface BankAccountRow {
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
 * @param drive - Google Drive client
 * @returns The ID of the file
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
 * @param sheets - Google Sheets client
 * @param spreadsheetId - The ID of the spreadsheet
 * @returns Array of client data objects
 */
export async function fetchAddressBook(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<AddressBookEntry[]> {
  const range = 'Address Book of Accounts!A:I'; // 9 columns as per your HTML
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = resp.data.values || [];
  if (rows.length <= 2) { // Changed from 1 to 2 to skip two rows
    return [];
  }
  // Skip the first two rows (title + header)
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
 * Fetches the bank account data from the "Bank Account Information of Subsidiaries" sheet.
 * @param sheets - Google Sheets client
 * @param spreadsheetId - The ID of the spreadsheet
 * @returns Array of bank account data objects
 */
export async function fetchBankAccounts(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<BankAccountRow[]> {
  const range = 'Bank Account Information of Subsidiaries!A:H'; // 8 columns as per your HTML
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = resp.data.values || [];
  if (rows.length <= 2) { // Changed from 1 to 2 to skip two rows
    return [];
  }
  // Skip the first two rows (title + header)
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

// No need for an additional export statement here as all functions are already exported where they are defined.
