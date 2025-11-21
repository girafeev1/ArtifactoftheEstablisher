// scripts/inspectSheet.ts
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SPREADSHEET_ID = '12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0';

async function main() {
  console.log('Authenticating with Google Sheets API...');

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    // The following assumes that the GOOGLE_APPLICATION_CREDENTIALS environment
    // variable is set, or that the application is running in a GCP environment.
    // For local development, you can point to the service account key file.
    // Based on the .env.local, we can construct the credentials object directly.
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
  });

  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`Fetching spreadsheet data for ID: ${SPREADSHEET_ID}...`);

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      includeGridData: true,
    });

    const outputPath = path.resolve(process.cwd(), 'tmp', 'sheet-data.json');
    await fs.writeFile(outputPath, JSON.stringify(response.data, null, 2));

    console.log(`Successfully fetched and saved sheet data to ${outputPath}`);
  } catch (error) {
    console.error('Error fetching spreadsheet data:', error);
  }
}

main();
