// lib/findPMSReferenceLog.ts

import { drive_v3 } from 'googleapis';

/**
 * Searches all shared drives for a spreadsheet named exactly "PMS Reference Log".
 * Returns the file ID if found; throws an error if none or more than one found.
 */
export async function findPMSReferenceLogFile(drive: drive_v3.Drive): Promise<string> {
  console.log('[findPMSReferenceLogFile] Searching for file named "PMS Reference Log"');
  try {
    const response = await drive.files.list({
      q: "name = 'PMS Reference Log' and mimeType = 'application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)',
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 10,
    });

    const files = response.data.files || [];
    console.log('[findPMSReferenceLogFile] Drive files response:', files);

    if (files.length === 0) {
      throw new Error('No file named "PMS Reference Log" found in the shared drives.');
    }
    if (files.length > 1) {
      throw new Error(
        'Multiple spreadsheets named "PMS Reference Log" found. Please ensure only one file has this name.'
      );
    }

    const fileId = files[0].id;
    if (!fileId) {
      throw new Error('Found "PMS Reference Log" but it has no file ID (unexpected).');
    }

    console.log(`[findPMSReferenceLogFile] Found file ID: ${fileId}`);
    return fileId;
  } catch (error: any) {
    console.error('[findPMSReferenceLogFile] ERROR:', error);
    throw error;
  }
}
