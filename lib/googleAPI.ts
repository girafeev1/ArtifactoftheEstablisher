// lib/googleApi.ts

import { google, sheets_v4, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

interface InitializeApisOptions {
  accessToken: string;
}

export const initializeApis = (
  type: 'user' | 'service',
  options: InitializeApisOptions
): { drive: drive_v3.Drive; sheets: sheets_v4.Sheets } => {
  let auth;
  if (type === 'user') {
    auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: options.accessToken });
  } else {
    // Service account authentication
    auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  return { drive, sheets };
};
