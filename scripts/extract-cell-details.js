/**
 * Extract detailed cell information from Google Sheets scheme for supplementary pages (rows 106-200)
 * This includes: merges, borders, backgrounds, fonts, colors, alignment
 */

const fs = require('fs');
const path = require('path');

const schemePath = path.join(__dirname, '..', 'tmp', 'paginated-invoice-scheme.json');
const scheme = JSON.parse(fs.readFileSync(schemePath, 'utf8'));

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

// Helper to format border
function formatBorder(border) {
  if (!border) return null;
  const style = border.style || 'SOLID';
  const width = border.width || 1;
  const color = formatColor(border.color) || '#000';
  return { style, width, color };
}

function analyzeRow(rowNum) {
  const rowData = {
    row: rowNum,
    height: scheme.rowHeightsPx[rowNum - 1],
    cells: []
  };

  for (let c = 1; c <= 14; c++) {
    const cellKey = `${rowNum}:${c}`;
    const cell = scheme.cells[cellKey];

    if (cell) {
      const cellInfo = {
        col: colName(c),
        colNum: c
      };

      // Value
      if (cell.value) {
        cellInfo.value = cell.value.substring(0, 100);
      }

      // Font properties
      if (cell.fontFamily) cellInfo.fontFamily = cell.fontFamily;
      if (cell.fontSize) cellInfo.fontSize = cell.fontSize;
      if (cell.bold) cellInfo.bold = true;
      if (cell.italic) cellInfo.italic = true;
      if (cell.underline) cellInfo.underline = true;
      if (cell.strikethrough) cellInfo.strikethrough = true;

      // Text color (fgColor in scheme)
      if (cell.fgColor) {
        cellInfo.textColor = formatColor(cell.fgColor);
      }

      // Background color (bgColor in scheme) - include even white backgrounds for consistency
      if (cell.bgColor) {
        cellInfo.backgroundColor = formatColor(cell.bgColor);
      }

      // Alignment
      if (cell.hAlign) cellInfo.hAlign = cell.hAlign;
      if (cell.vAlign) cellInfo.vAlign = cell.vAlign;
      if (cell.wrapStrategy) cellInfo.wrapStrategy = cell.wrapStrategy;

      // Borders (border in scheme, not borders)
      if (cell.border && Object.keys(cell.border).length > 0) {
        cellInfo.borders = {};
        if (cell.border.top) cellInfo.borders.top = formatBorder(cell.border.top);
        if (cell.border.bottom) cellInfo.borders.bottom = formatBorder(cell.border.bottom);
        if (cell.border.left) cellInfo.borders.left = formatBorder(cell.border.left);
        if (cell.border.right) cellInfo.borders.right = formatBorder(cell.border.right);
      }

      // Text runs (for mixed formatting within a cell)
      if (cell.textFormatRuns && cell.textFormatRuns.length > 0) {
        cellInfo.textRuns = cell.textFormatRuns.map(run => ({
          startIndex: run.startIndex,
          format: {
            fontFamily: run.format?.fontFamily,
            fontSize: run.format?.fontSize,
            bold: run.format?.bold,
            italic: run.format?.italic,
            // fgColor is the field name from the fetch script
            foregroundColor: run.format?.fgColor ? formatColor(run.format.fgColor) : null
          }
        }));
      }

      // Include cell if it has ANY styling beyond just col/colNum
      // This ensures cells with background colors, borders, or alignment are captured
      rowData.cells.push(cellInfo);
    }
  }

  return rowData;
}

// Get merges for supplementary pages
function getMergesForRange(startRow, endRow) {
  return scheme.merges.filter(m => m.r1 >= startRow && m.r1 <= endRow)
    .map(m => ({
      startRow: m.r1,
      endRow: m.r2,
      startCol: colName(m.c1),
      endCol: colName(m.c2),
      rowSpan: m.r2 - m.r1 + 1,
      colSpan: m.c2 - m.c1 + 1,
      // Get content from the merge start cell
      content: scheme.cells[`${m.r1}:${m.c1}`]?.value?.substring(0, 50) || ''
    }))
    .sort((a, b) => a.startRow - b.startRow || a.startCol.localeCompare(b.startCol));
}

console.log('=== PAYMENT DETAILS (Rows 106-146) ===\n');

console.log('--- Merges ---');
const pdMerges = getMergesForRange(106, 146);
pdMerges.forEach(m => {
  console.log(`Row ${m.startRow}: ${m.startCol}-${m.endCol} (${m.rowSpan}r x ${m.colSpan}c) "${m.content}"`);
});

console.log('\n--- Row by Row Details ---');
for (let r = 106; r <= 146; r++) {
  const rowData = analyzeRow(r);
  const localRow = r - 105;
  console.log(`\nRow ${localRow} (Sheet ${r}): ${rowData.height}px`);

  rowData.cells.forEach(cell => {
    let output = `  ${cell.col}:`;
    if (cell.value) output += ` "${cell.value.substring(0, 40)}"`;
    if (cell.fontFamily) output += ` | ${cell.fontFamily}`;
    if (cell.fontSize) output += ` ${cell.fontSize}px`;
    if (cell.bold) output += ' bold';
    if (cell.italic) output += ' italic';
    if (cell.textColor) output += ` | color:${cell.textColor}`;
    if (cell.backgroundColor) output += ` | bg:${cell.backgroundColor}`;
    if (cell.hAlign) output += ` | hAlign:${cell.hAlign}`;
    if (cell.vAlign) output += ` | vAlign:${cell.vAlign}`;
    if (cell.borders) {
      const borderStr = Object.entries(cell.borders)
        .map(([side, b]) => `${side}:${b.style}/${b.color}`)
        .join(',');
      output += ` | borders:[${borderStr}]`;
    }
    console.log(output);
  });
}

console.log('\n\n=== PAYMENT INSTRUCTIONS (Rows 147-200) ===\n');

console.log('--- Merges ---');
const piMerges = getMergesForRange(147, 200);
piMerges.forEach(m => {
  console.log(`Row ${m.startRow}: ${m.startCol}-${m.endCol} (${m.rowSpan}r x ${m.colSpan}c) "${m.content}"`);
});

console.log('\n--- Row by Row Details ---');
for (let r = 147; r <= 200; r++) {
  const rowData = analyzeRow(r);
  const localRow = r - 146;
  console.log(`\nRow ${localRow} (Sheet ${r}): ${rowData.height}px`);

  rowData.cells.forEach(cell => {
    let output = `  ${cell.col}:`;
    if (cell.value) output += ` "${cell.value.substring(0, 40)}"`;
    if (cell.fontFamily) output += ` | ${cell.fontFamily}`;
    if (cell.fontSize) output += ` ${cell.fontSize}px`;
    if (cell.bold) output += ' bold';
    if (cell.italic) output += ' italic';
    if (cell.textColor) output += ` | color:${cell.textColor}`;
    if (cell.backgroundColor) output += ` | bg:${cell.backgroundColor}`;
    if (cell.hAlign) output += ` | hAlign:${cell.hAlign}`;
    if (cell.vAlign) output += ` | vAlign:${cell.vAlign}`;
    if (cell.borders) {
      const borderStr = Object.entries(cell.borders)
        .map(([side, b]) => `${side}:${b.style}/${b.color}`)
        .join(',');
      output += ` | borders:[${borderStr}]`;
    }
    console.log(output);
  });
}

// Output as JSON for programmatic use
const output = {
  paymentDetails: {
    rows: [],
    merges: pdMerges
  },
  paymentInstructions: {
    rows: [],
    merges: piMerges
  }
};

for (let r = 106; r <= 146; r++) {
  output.paymentDetails.rows.push(analyzeRow(r));
}

for (let r = 147; r <= 200; r++) {
  output.paymentInstructions.rows.push(analyzeRow(r));
}

fs.writeFileSync(
  path.join(__dirname, '..', 'tmp', 'supplementary-cells.json'),
  JSON.stringify(output, null, 2)
);

console.log('\n\nJSON output saved to tmp/supplementary-cells.json');
