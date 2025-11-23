// scripts/inspectSheet.js
const { google } = require('googleapis');
const fs = require('fs/promises');
const path = require('path');

const SPREADSHEET_ID = '12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0';
const OUTPUT_PATH = path.resolve(process.cwd(), 'tmp', 'invoice-template-data.json');

async function main() {
  console.log('Authenticating with Google Sheets API...');

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
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

    // Create tmp directory if it doesn't exist
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

    await fs.writeFile(OUTPUT_PATH, JSON.stringify(response.data, null, 2));

    console.log(`Successfully fetched and saved sheet data to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Error fetching spreadsheet data:', error);
    process.exit(1);
  }
}

main();
