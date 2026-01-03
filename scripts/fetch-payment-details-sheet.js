/**
 * Fetch Payment Details data from Google Sheets (gid=403093960, rows 161-201)
 */

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

async function fetchPaymentDetailsSheet() {
  const spreadsheetId = '12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0';
  // gid=403093960 from user's URL - Payment Details sheet
  const sheetId = 403093960;

  console.log('Fetching Payment Details sheet from Google Sheets (gid=403093960)...');

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: true,
    fields: 'sheets(properties,data(rowData(values(formattedValue,effectiveFormat,textFormatRuns)),rowMetadata,columnMetadata),merges)',
  });

  const sheet = response.data.sheets.find(s => s.properties.sheetId === sheetId);
  if (!sheet) {
    throw new Error('Sheet with gid=403093960 not found');
  }

  console.log(`Found sheet: "${sheet.properties.title}"`);

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
        textFormatRuns: cell.textFormatRuns?.map(run => ({
          startIndex: run.startIndex || 0,
          format: {
            fontFamily: run.format?.fontFamily || null,
            fontSize: run.format?.fontSize || null,
            bold: run.format?.bold || false,
            italic: run.format?.italic || false,
            underline: run.format?.underline || false,
            strikethrough: run.format?.strikethrough || false,
            fgColor: toUnitRgb(run.format?.foregroundColorStyle?.rgbColor || run.format?.foregroundColor),
          }
        })) || null,
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
  const outputPath = path.join(process.cwd(), 'tmp', 'payment-details-sheet.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(scheme, null, 2), 'utf8');

  console.log(`✓ Saved scheme to ${outputPath}`);
  console.log(`  - Total rows: ${rowHeightsPx.length}`);
  console.log(`  - Total columns: ${columnWidthsPx.length}`);
  console.log(`  - Cells: ${Object.keys(cells).length}`);
  console.log(`  - Merges: ${merges.length}`);

  // Now analyze rows 161-201
  analyzeRows(scheme, 161, 201);
}

function analyzeRows(scheme, startRow, endRow) {
  const cols = 'ABCDEFGHIJKLMN'.split('');
  const colName = (idx) => cols[idx - 1] || 'Col' + idx;

  console.log(`\n\n=== ROWS ${startRow}-${endRow} ANALYSIS (Payment Details Page) ===\n`);

  // Row heights
  console.log('--- ROW HEIGHTS (px) ---');
  const rowHeights = [];
  for (let r = startRow; r <= endRow; r++) {
    const height = scheme.rowHeightsPx[r - 1] || 21;
    const localIdx = r - startRow;
    rowHeights.push(height);
    console.log(`Row ${r} (index ${localIdx}): ${height}px`);
  }
  console.log(`\nTotal height: ${rowHeights.reduce((a, b) => a + b, 0)}px`);
  console.log(`\nJavaScript array:\nconst ROW_HEIGHTS = [${rowHeights.join(', ')}];`);

  // Merges for the range
  console.log('\n\n--- MERGES ---');
  const merges = scheme.merges
    .filter(m => m.r1 >= startRow && m.r1 <= endRow)
    .map(m => ({
      startRow: m.r1,
      endRow: m.r2,
      startCol: colName(m.c1),
      endCol: colName(m.c2),
      startColNum: m.c1,
      endColNum: m.c2,
      rowSpan: m.r2 - m.r1,
      colSpan: m.c2 - m.c1,
      content: scheme.cells[`${m.r1}:${m.c1}`]?.value?.substring(0, 50) || ''
    }))
    .sort((a, b) => a.startRow - b.startRow || a.startColNum - b.startColNum);

  merges.forEach(m => {
    console.log(`Row ${m.startRow}: Merge ${m.startCol}-${m.endCol} (cols ${m.startColNum}-${m.endColNum}) | ${m.rowSpan}r x ${m.colSpan}c | "${m.content}"`);
  });

  // Detailed row-by-row analysis
  console.log('\n\n--- ROW BY ROW DETAILS ---');
  for (let r = startRow; r <= endRow; r++) {
    const localIdx = r - startRow;
    const height = scheme.rowHeightsPx[r - 1] || 21;
    console.log(`\n=== ROW ${r} (index ${localIdx}): ${height}px ===`);

    // Find merges that START in this row
    const rowMerges = merges.filter(m => m.startRow === r);
    if (rowMerges.length > 0) {
      console.log('  MERGES starting here:');
      rowMerges.forEach(m => {
        console.log(`    ${m.startCol}-${m.endCol} (${m.rowSpan}r x ${m.colSpan}c)`);
      });
    }

    // Cell contents
    for (let c = 1; c <= 14; c++) {
      const cellKey = `${r}:${c}`;
      const cell = scheme.cells[cellKey];
      if (cell && (cell.value || cell.bold || (cell.fontFamily && cell.fontFamily !== 'Arial'))) {
        let info = `  ${colName(c)} (col ${c}):`;
        if (cell.value) info += ` "${cell.value.substring(0, 60)}"`;
        if (cell.fontFamily) info += ` | font: ${cell.fontFamily}`;
        if (cell.fontSize) info += ` ${cell.fontSize}pt`;
        if (cell.bold) info += ' BOLD';
        if (cell.italic) info += ' italic';
        if (cell.hAlign) info += ` | hAlign: ${cell.hAlign}`;
        if (cell.vAlign) info += ` | vAlign: ${cell.vAlign}`;
        if (cell.wrapStrategy) info += ` | wrap: ${cell.wrapStrategy}`;
        console.log(info);
      }
    }
  }

  // Output summary
  console.log('\n\n=== IMPLEMENTATION SUMMARY ===\n');
  console.log('ROW_HEIGHTS array:');
  console.log(`[${rowHeights.join(', ')}]`);
  console.log(`\nTotal: ${rowHeights.reduce((a, b) => a + b, 0)}px`);
  console.log('\nMerges (1-indexed columns):');
  merges.forEach(m => {
    console.log(`  Row ${m.startRow}: ${m.startCol}-${m.endCol} (cols ${m.startColNum}-${m.endColNum}) | span: ${m.rowSpan}r x ${m.colSpan}c`);
  });
}

fetchPaymentDetailsSheet().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
