const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

// Get credentials from environment variables
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

if (!privateKey || !clientEmail) {
  console.error('Error: GOOGLE_PRIVATE_KEY and GOOGLE_CLIENT_EMAIL must be set in .env.local');
  process.exit(1);
}

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

async function fetchPaginatedScheme() {
  const spreadsheetId = '12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0';
  const sheetId = 403093960;

  console.log('Fetching paginated invoice scheme from Google Sheets...');

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: true
  });

  const sheet = response.data.sheets.find(s => s.properties.sheetId === sheetId);
  if (!sheet) {
    throw new Error('Sheet not found');
  }

  const gridData = sheet.data[0];

  // Helper function to convert color
  function toUnitRgb(color) {
    if (!color) return null;
    if (typeof color.hex === 'string') {
      const hex = color.hex;
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return null;
      return {
        red: parseInt(result[1], 16) / 255,
        green: parseInt(result[2], 16) / 255,
        blue: parseInt(result[3], 16) / 255,
      };
    }
    const { red, green, blue } = color;
    if (typeof red === 'number' || typeof green === 'number' || typeof blue === 'number') {
      return { red: red || 0, green: green || 0, blue: blue || 0 };
    }
    return null;
  }

  // Extract column widths
  const columnWidthsPx = gridData.columnMetadata?.map(c => c.pixelSize || 0) || [];

  // Extract row heights
  const rowHeightsPx = gridData.rowMetadata?.map(r => r.pixelSize || 0) || [];

  // Extract merges
  const merges = (sheet.merges || []).map(m => ({
    r1: (m.startRowIndex || 0) + 1,
    c1: (m.startColumnIndex || 0) + 1,
    r2: m.endRowIndex || (m.startRowIndex || 0) + 1,
    c2: m.endColumnIndex || (m.startColumnIndex || 0) + 1,
  }));

  // Extract cells
  const cells = {};
  gridData.rowData?.forEach((row, r) => {
    row.values?.forEach((cell, c) => {
      const key = `${r + 1}:${c + 1}`;
      const value = cell.formattedValue || '';
      const ef = cell.effectiveFormat;

      if (!ef) {
        cells[key] = { value };
        return;
      }

      cells[key] = {
        value,
        fontFamily: ef.textFormat?.fontFamily || null,
        fontSize: ef.textFormat?.fontSize || null,
        bold: ef.textFormat?.bold || false,
        italic: ef.textFormat?.italic || false,
        fgColor: toUnitRgb(ef.textFormat?.foregroundColorStyle?.rgbColor),
        bgColor: toUnitRgb(ef.backgroundColorStyle?.rgbColor),
        hAlign: ef.horizontalAlignment || 'LEFT',
        vAlign: ef.verticalAlignment || 'TOP',
        wrapStrategy: ef.wrapStrategy || 'OVERFLOW_CELL',
        border: ef.borders || {},
      };
    });
  });

  const scheme = {
    spreadsheetId,
    sheetId,
    sheetTitle: sheet.properties?.title || '',
    scannedAt: new Date().toISOString(),
    columnWidthsPx,
    rowHeightsPx,
    merges,
    cells,
  };

  // Save to file
  const outputPath = path.join(process.cwd(), 'tmp', 'paginated-invoice-scheme.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(scheme, null, 2), 'utf8');

  console.log(`✓ Saved scheme to ${outputPath}`);
  console.log(`  - Total rows: ${rowHeightsPx.length}`);
  console.log(`  - Total columns: ${columnWidthsPx.length}`);
  console.log(`  - Cells: ${Object.keys(cells).length}`);
  console.log(`  - Merges: ${merges.length}`);
}

fetchPaginatedScheme().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
