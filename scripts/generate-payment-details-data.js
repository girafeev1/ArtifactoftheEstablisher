/**
 * Generate PaymentDetailsData.ts from payment-details-sheet.json
 * Uses rows 161-201 from gid=403093960
 */

const fs = require('fs');
const path = require('path');

const schemePath = path.join(__dirname, '..', 'tmp', 'payment-details-sheet.json');
const scheme = JSON.parse(fs.readFileSync(schemePath, 'utf8'));

const START_ROW = 161;
const END_ROW = 201;
const cols = 'ABCDEFGHIJKLMN'.split('');
const colName = (idx) => cols[idx - 1] || 'Col' + idx;

// Helper to format color
function formatColor(color) {
  if (!color) return null;
  if (typeof color === 'string') return color;
  if (color.red !== undefined || color.green !== undefined || color.blue !== undefined) {
    const r = Math.round((color.red || 0) * 255);
    const g = Math.round((color.green || 0) * 255);
    const b = Math.round((color.blue || 0) * 255);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return null;
}

// Extract row heights
const rowHeights = [];
for (let r = START_ROW; r <= END_ROW; r++) {
  rowHeights.push(scheme.rowHeightsPx[r - 1] || 21);
}

// Extract merges for the range
const merges = scheme.merges
  .filter(m => m.r1 >= START_ROW && m.r1 <= END_ROW)
  .map(m => ({
    startRow: m.r1,
    endRow: m.r2,
    startCol: colName(m.c1),
    endCol: colName(m.c2),
    rowSpan: m.r2 - m.r1,
    colSpan: m.c2 - m.c1,
  }))
  .sort((a, b) => a.startRow - b.startRow || cols.indexOf(a.startCol) - cols.indexOf(b.startCol));

// Build rows data
const rows = [];
for (let r = START_ROW; r <= END_ROW; r++) {
  const localIdx = r - START_ROW;
  const height = scheme.rowHeightsPx[r - 1] || 21;
  const cells = [];

  for (let c = 1; c <= 14; c++) {
    const cellKey = `${r}:${c}`;
    const cell = scheme.cells[cellKey];

    const cellData = {
      col: colName(c),
      colNum: c,
    };

    if (cell) {
      if (cell.value) cellData.value = cell.value;
      if (cell.fontFamily && cell.fontFamily !== 'Arial') cellData.fontFamily = cell.fontFamily;
      if (cell.fontSize) cellData.fontSize = cell.fontSize;
      if (cell.bold) cellData.bold = true;
      if (cell.italic) cellData.italic = true;
      if (cell.fgColor) {
        const color = formatColor(cell.fgColor);
        if (color && color !== 'rgb(0, 0, 0)') cellData.textColor = color;
      }
      if (cell.bgColor) {
        const color = formatColor(cell.bgColor);
        if (color) cellData.backgroundColor = color;
      }
      if (cell.hAlign) cellData.hAlign = cell.hAlign;
      if (cell.vAlign) cellData.vAlign = cell.vAlign;
      if (cell.wrapStrategy) cellData.wrapStrategy = cell.wrapStrategy;

      // Include borders if present
      if (cell.border && Object.keys(cell.border).length > 0) {
        const borders = {};
        ['top', 'bottom', 'left', 'right'].forEach(side => {
          if (cell.border[side]) {
            const b = cell.border[side];
            borders[side] = {
              style: b.style || 'SOLID',
              width: b.width || 1,
              color: formatColor(b.color) || '#000'
            };
          }
        });
        if (Object.keys(borders).length > 0) {
          cellData.borders = borders;
        }
      }

      // Include textRuns for mixed formatting
      if (cell.textFormatRuns && cell.textFormatRuns.length > 0) {
        cellData.textRuns = cell.textFormatRuns.map(run => {
          const format = {};
          if (run.format?.fontFamily) format.fontFamily = run.format.fontFamily;
          if (run.format?.fontSize) format.fontSize = run.format.fontSize;
          if (run.format?.bold) format.bold = true;
          if (run.format?.italic) format.italic = true;
          if (run.format?.fgColor) format.foregroundColor = formatColor(run.format.fgColor);
          return {
            startIndex: run.startIndex || 0,
            format
          };
        });
      }
    }

    cells.push(cellData);
  }

  rows.push({
    row: r,
    height,
    cells
  });
}

// Generate TypeScript file content
let output = `/**
 * PaymentDetailsPage - Cell data from Google Sheets scheme
 * Generated from tmp/payment-details-sheet.json
 * Sheet: gid=403093960 (Classic Single-Item Invoice (Instruction))
 * Rows: ${START_ROW}-${END_ROW}
 * Generated: ${new Date().toISOString()}
 */

import type { SchemeRowData, SchemeMerge } from '../../grid';

export const ROW_HEIGHTS = [
`;

rowHeights.forEach((h, i) => {
  output += `  ${h}, // Row ${i + 1} (Sheet ${START_ROW + i})\n`;
});

output += `];

export const TOTAL_HEIGHT = ${rowHeights.reduce((a, b) => a + b, 0)}; // ${rowHeights.length} rows

export const MERGES: SchemeMerge[] = [
`;

merges.forEach(m => {
  output += `  { startRow: ${m.startRow}, endRow: ${m.endRow}, startCol: '${m.startCol}', endCol: '${m.endCol}', rowSpan: ${m.rowSpan}, colSpan: ${m.colSpan} },\n`;
});

output += `];

export const ROWS: SchemeRowData[] = [
`;

rows.forEach((row, idx) => {
  output += `  // Row ${idx + 1} (Sheet ${row.row}): ${row.height}px\n`;
  output += `  {\n`;
  output += `    row: ${row.row},\n`;
  output += `    height: ${row.height},\n`;
  output += `    cells: [\n`;

  row.cells.forEach(cell => {
    const props = [];
    props.push(`col: '${cell.col}'`);
    props.push(`colNum: ${cell.colNum}`);
    if (cell.value) props.push(`value: ${JSON.stringify(cell.value)}`);
    if (cell.fontFamily) props.push(`fontFamily: '${cell.fontFamily}'`);
    if (cell.fontSize) props.push(`fontSize: ${cell.fontSize}`);
    if (cell.bold) props.push(`bold: true`);
    if (cell.italic) props.push(`italic: true`);
    if (cell.textColor) props.push(`textColor: '${cell.textColor}'`);
    if (cell.backgroundColor) props.push(`backgroundColor: '${cell.backgroundColor}'`);
    if (cell.hAlign) props.push(`hAlign: '${cell.hAlign}'`);
    if (cell.vAlign) props.push(`vAlign: '${cell.vAlign}'`);
    if (cell.wrapStrategy) props.push(`wrapStrategy: '${cell.wrapStrategy}'`);
    if (cell.borders) props.push(`borders: ${JSON.stringify(cell.borders)}`);
    if (cell.textRuns) props.push(`textRuns: ${JSON.stringify(cell.textRuns)}`);

    output += `      { ${props.join(', ')} },\n`;
  });

  output += `    ],\n`;
  output += `  },\n`;
});

output += `];
`;

// Write the file
const outputPath = path.join(__dirname, '..', 'lib', 'invoice', 'components', 'pages', 'PaymentDetailsData.ts');
fs.writeFileSync(outputPath, output, 'utf8');

console.log(`✓ Generated PaymentDetailsData.ts`);
console.log(`  - Rows: ${START_ROW}-${END_ROW} (${rowHeights.length} rows)`);
console.log(`  - Total height: ${rowHeights.reduce((a, b) => a + b, 0)}px`);
console.log(`  - Merges: ${merges.length}`);
console.log(`  - Output: ${outputPath}`);
