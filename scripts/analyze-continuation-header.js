/**
 * Analyze continuation header rows 52-58 from gid=403093960
 */

const fs = require('fs');
const path = require('path');

const schemePath = path.join(__dirname, '..', 'tmp', 'payment-details-sheet.json');
const scheme = JSON.parse(fs.readFileSync(schemePath, 'utf8'));

const cols = 'ABCDEFGHIJKLMN'.split('');
const colName = (idx) => cols[idx - 1] || 'Col' + idx;

function analyzeRows(startRow, endRow) {
  console.log(`\n=== ROWS ${startRow}-${endRow} DETAILED ANALYSIS ===\n`);

  // Row heights
  console.log('--- ROW HEIGHTS (px) ---');
  const rowHeights = [];
  for (let r = startRow; r <= endRow; r++) {
    const height = scheme.rowHeightsPx[r - 1] || 21;
    rowHeights.push(height);
    console.log(`Row ${r}: ${height}px`);
  }
  console.log(`\nTotal: ${rowHeights.reduce((a, b) => a + b, 0)}px`);
  console.log(`\nconst ROW_HEIGHTS = [${rowHeights.join(', ')}];`);

  // Merges for the range
  console.log('\n--- MERGES ---');
  const merges = scheme.merges
    .filter(m => m.r1 >= startRow && m.r1 <= endRow)
    .sort((a, b) => a.r1 - b.r1 || a.c1 - b.c1);

  merges.forEach(m => {
    const content = scheme.cells[`${m.r1}:${m.c1}`]?.value?.substring(0, 50) || '';
    console.log(`Row ${m.r1}: ${colName(m.c1)}-${colName(m.c2)} (r1:${m.r1} r2:${m.r2} = ${m.r2 - m.r1 + 1} rows, c1:${m.c1} c2:${m.c2} = ${m.c2 - m.c1} cols) | "${content}"`);
  });

  // Detailed row-by-row analysis
  console.log('\n--- CELL BY CELL DETAILS ---');
  for (let r = startRow; r <= endRow; r++) {
    const height = scheme.rowHeightsPx[r - 1] || 21;
    console.log(`\n=== ROW ${r}: ${height}px ===`);

    for (let c = 1; c <= 14; c++) {
      const cellKey = `${r}:${c}`;
      const cell = scheme.cells[cellKey];
      if (cell && (cell.value || cell.fontFamily)) {
        let info = `  ${colName(c)}:`;
        if (cell.value) info += ` "${cell.value.substring(0, 60)}"`;
        if (cell.fontFamily) info += ` | ${cell.fontFamily}`;
        if (cell.fontSize) info += ` ${cell.fontSize}pt`;
        if (cell.bold) info += ' BOLD';
        if (cell.italic) info += ' italic';
        if (cell.hAlign) info += ` | ${cell.hAlign}`;
        if (cell.vAlign) info += ` | ${cell.vAlign}`;
        console.log(info);
      }
    }
  }
}

// Analyze rows 52-58 for continuation header
analyzeRows(52, 58);
