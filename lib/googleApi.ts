// lib/googleApi.ts

import { google, sheets_v4, drive_v3 } from 'googleapis';

/**
 * Options for initializeApis().
 * In "user" mode, we expect an accessToken from OAuth2 (NextAuth).
 * In "service" mode, we do a service-account-based GoogleAuth instead.
 */
interface InitializeApisOptions {
  accessToken?: string; // only required when type === 'user'
}

/**
 * Generic helper that returns { drive, sheets }
 * for either user-based or service account authentication.
 */
export const initializeApis = (
  type: 'user' | 'service',
  options: InitializeApisOptions
): { drive: drive_v3.Drive; sheets: sheets_v4.Sheets } => {
  let auth;

  if (type === 'user') {
    // OAuth2 with user token
    if (!options.accessToken) {
      throw new Error('Missing accessToken in initializeApis (type="user").');
    }
    auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: options.accessToken });
  } else {
    // Service account authentication
    auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });
  }

  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });
  return { drive, sheets };
};
