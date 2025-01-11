// lib/googleApi.ts

import { google } from 'googleapis';
import { serviceAccountCredentials } from './config';

console.log('[googleApi] Loaded googleApi.ts');

export function initializeUserApis(accessToken: string) {
  console.log('[initializeUserApis] Creating OAuth2 client with user token');
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  return { drive, sheets };
}

export function initializeServiceAccountApis() {
  console.log('[initializeServiceAccountApis] Creating GoogleAuth with service account');
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
