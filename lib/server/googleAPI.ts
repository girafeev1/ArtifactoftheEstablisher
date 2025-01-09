// lib/server/googleAPI.ts

import { google } from 'googleapis';
import { serviceAccountCredentials } from '../config';

export function initializeServiceAccountApis() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountCredentials.client_email,
      private_key: serviceAccountCredentials.private_key,
    },
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });

  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  return { drive, sheets };
}

export async function listProjectOverviewFiles(drive) {
  try {
    const response = await drive.files.list({
      q: "name contains 'Project Overview' and mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)',
      pageSize: 100,
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    console.log('Files fetched from Google Drive:', response.data.files ? response.data.files.length : 0);

    if (!response.data.files || response.data.files.length === 0) {
      console.log('No matching files found in Google Drive.');
      return {};
    }

    const projectsByCategory: Record<string, any[]> = {};
    response.data.files.forEach((file: any) => {
      const trimmedName = file.name?.trim() || '';
      const match = trimmedName.match(/^(\w{4})\s+([A-Za-z]+)\s+Project Overview\s*$/);

      if (match) {
        const yearOrCode = match[1];
        const companyIdentifier = match[2];

        if (!projectsByCategory[yearOrCode]) {
          projectsByCategory[yearOrCode] = [];
        }

        projectsByCategory[yearOrCode].push({
          companyIdentifier,
          file,
          year: yearOrCode,
        });
      } else {
        console.warn(`File name '${file.name}' does not match the expected pattern.`);
      }
    });

    console.log('Projects by category after processing:', Object.keys(projectsByCategory).length);

    return projectsByCategory;
  } catch (error: any) {
    console.error('Error fetching project overview files:', error.message);
    throw new Error('Failed to fetch project overview files');
  }
}

export async function findReferenceLog(drive) {
  try {
    const response = await drive.files.list({
      q: "name = 'PMS Reference Log' and mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id)',
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    if (response.data.files && response.data.files.length > 0) {
      console.log('PMS Reference Log found with ID:', response.data.files[0].id);
      return response.data.files[0].id;
    } else {
      throw new Error("PMS Reference Log not found in Shared Drives");
    }
  } catch (error) {
    console.error('Error finding PMS Reference Log:', error);
    throw error;
  }
}

export async function fetchReferenceOfSubsidiaryNames(sheets, spreadsheetId) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Reference of Subsidiary Names!A:B',
    });
    return response.data.values || [];
  } catch (error) {
    console.error('Error fetching subsidiary names:', error);
    return [];
  }
}
