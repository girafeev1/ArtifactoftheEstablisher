/**
 * Analyze rows 169-170 (Payment is due text) from gid=403093960
 */

const fs = require('fs');
const path = require('path');

const schemePath = path.join(__dirname, '..', 'tmp', 'payment-details-sheet.json');
const scheme = JSON.parse(fs.readFileSync(schemePath, 'utf8'));

const cols = 'ABCDEFGHIJKLMN'.split('');
const colName = (idx) => cols[idx - 1] || 'Col' + idx;

function analyzeRows(startRow, endRow) {
  console.log(`\n=== ROWS ${startRow}-${endRow} ANALYSIS ===\n`);

  // Row heights
  console.log('--- ROW HEIGHTS (px) ---');
  for (let r = startRow; r <= endRow; r++) {
    const height = scheme.rowHeightsPx[r - 1] || 21;
    console.log(`Row ${r}: ${height}px`);
  }

  // Merges for the range
  console.log('\n--- MERGES ---');
  const merges = scheme.merges
    .filter(m => m.r1 >= startRow && m.r1 <= endRow)
    .map(m => ({
      startRow: m.r1,
      endRow: m.r2,
      startCol: colName(m.c1),
      endCol: colName(m.c2),
      rowSpan: m.r2 - m.r1,
      colSpan: m.c2 - m.c1,
      content: scheme.cells[`${m.r1}:${m.c1}`]?.value?.substring(0, 100) || ''
    }));

  merges.forEach(m => {
    console.log(`Row ${m.startRow}: Merge ${m.startCol}-${m.endCol} (${m.rowSpan}r x ${m.colSpan}c) | "${m.content}"`);
  });

  // Detailed row-by-row analysis
  console.log('\n--- ROW BY ROW DETAILS ---');
  for (let r = startRow; r <= endRow; r++) {
    const height = scheme.rowHeightsPx[r - 1] || 21;
    console.log(`\n=== ROW ${r}: ${height}px ===`);

    for (let c = 1; c <= 14; c++) {
      const cellKey = `${r}:${c}`;
      const cell = scheme.cells[cellKey];
      if (cell && (cell.value || cell.bold || cell.fontFamily)) {
        let info = `  ${colName(c)} (col ${c}):`;
        if (cell.value) info += ` "${cell.value.substring(0, 80)}${cell.value.length > 80 ? '...' : ''}"`;
        if (cell.fontFamily) info += ` | font: ${cell.fontFamily}`;
        if (cell.fontSize) info += ` ${cell.fontSize}pt`;
        if (cell.bold) info += ' BOLD';
        if (cell.italic) info += ' italic';
        if (cell.hAlign) info += ` | hAlign: ${cell.hAlign}`;
        if (cell.vAlign) info += ` | vAlign: ${cell.vAlign}`;
        if (cell.fgColor) info += ` | color: rgb(${Math.round((cell.fgColor.red||0)*255)},${Math.round((cell.fgColor.green||0)*255)},${Math.round((cell.fgColor.blue||0)*255)})`;
        if (cell.textFormatRuns) info += ` | textRuns: ${JSON.stringify(cell.textFormatRuns)}`;
        console.log(info);
      }
    }
  }
}

// Analyze rows 169-170
analyzeRows(169, 170);
