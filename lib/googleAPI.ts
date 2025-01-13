// lib/googleApi.ts

import { google } from 'googleapis';
import { serviceAccountCredentials } from './config';

export function initializeApis(
  type: 'user' | 'service',
  credentials?: { accessToken: string }
) {
  const auth =
    type === 'user'
      ? new google.auth.OAuth2()
      : new google.auth.GoogleAuth({
          credentials: {
            client_email: serviceAccountCredentials.client_email,
            private_key: serviceAccountCredentials.private_key,
          },
          scopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets',
          ],
        });

  if (type === 'user' && credentials?.accessToken) {
    auth.setCredentials({ access_token: credentials.accessToken });
  }

  return {
    drive: google.drive({ version: 'v3', auth }),
    sheets: google.sheets({ version: 'v4', auth }),
  };
}
