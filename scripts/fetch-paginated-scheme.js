const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCVGBY3DcFUsRLs
fz8YmDsKCprkpai9XYG9cM43ZfWwETai5HMrt+cwoV1Dv87qxuGyh6i6cAfJzigk
vRxqbnZB6YxWNXhGZBNA5qON4wQ2NGp6NbsiRTfazbL0lLmsLlFE8+w2q57ezuGC
RpVQrFVGQ+r/x4MjCj+w0Ax8SFj84kou2x74pxE1RqeiFsiK4f3M2E34tDMXyhCX
lrUyhLdcCFc7PosR0OOWBGbfOUkpSXcbEIbp3mFzhNXtGHxlfjl2vT6mJU6VyLZM
lmgv0fWSOBEhy7FDhEslTqzVN8JnFK2+v8+uXSXYLV6XkdANve87kQswLuLYcW2/
UTBxs2U3AgMBAAECggEAOu+vFGs1Edf/jYpNdFj0+aawjRLpLZYRi8PUWLTO1p8v
VFvvJQiI9MHM3tOrJUaiAFM9ARn5Ei6S0tcIrQ/mYm7CgW+YkGbN75lcbOGhEBZP
QukLhOQMzMsEY0eJUAVtLc8ogIH+BsCMB1YEf0PoX6LIefyxm3/ZJnlPfi+RMcFd
pBv/SJ1X40FUBiQvbJaL0S3UziAFGGNSGaOyhlHYO7NTR28p/+FiOXiGZIK62nao
cBSRNpj8EkuPUe1UJIyncOgFoDLsh+FbXS8DAVNMKK1orfhzWaepHm+GHoPLCn0t
n6wvzGH7hu3Lx3YO12H/1DQwtdrFuAoTmxFw4eAodQKBgQDIiyfT0sdUfsS2KQ2P
XwuoSCkr9T9gky55/BkP4Iju1K5M3hk5nAu7e2cKYd6F6cTBOFy8LPsoChbPuZ5M
Q3qU59miZ2ym3HoZWznTOLUjTaO819IkYFKfySOMLqcFCfB4j0xS7BJZolft9Arv
yTv0iq40phzyCB7uWxKOsX47uwKBgQC+Urp6hQiMa42G2sdYrSJvEzdVFR8gSvGp
sv8UWIbImPILuFMe2Hg4wtA7y7XPGWtf87fxvT8O3k8iBy5gAEAg9AYMNlYRdv3+
7eOzxysnp+PFArYy0dyGqdZOuUCl5uPY4chs+ipY3Ljwa9rjHnrIhkkyyNLspoZU
oc/jYwXetQKBgBiul85ISOQrXgaVcufMaODjUL3qR0yZkMTOtD7yAahzYKhxRWWD
wSXoADyU4xBUPzUQvMkkOB0rcLdMPyFfxLyC9JQ6anL2+8gXJDzM4+5eZeKeJWz4
tfKYjNl5/HBwUrpj2J70EyYZBv1wZdAxUkG8t8gfEbzwJu5rIxOQ4Np1AoGAZVKR
qGxukqMno2WRvyndLRkj2g32ljCP23JJzkEa8GxMX+Tvi3pe9ojwZwUac3jq6xhL
E01W5sl/g3QjQkSf32tKVPIQfBfHPRLUqH8eAGynG9lHumJzbtW4HA0P18LGBk6d
bzb3mHtZkdU5oLQ3Vc335it37zjwRtomXL35AAkCgYA/R7umTObYJnmb/r6g3PNc
+cCOw1hzedirxYeuMI1j04gDlRBQThgqrsU5wi+lFL/OUQXfnCBfsIHGiTfs5mU8
9cFBoDMtQZLO/sd9swj6Kjx8PXsLA5gwQGpQJpb5IptvVT37CuMLqnXfEzt5slEF
yHHGbVRJVC6CsWeppFWehg==
-----END PRIVATE KEY-----`;

const auth = new google.auth.JWT({
  email: 'service@aote-pms.iam.gserviceaccount.com',
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
